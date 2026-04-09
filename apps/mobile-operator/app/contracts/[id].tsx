import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { C } from '../../lib/colors';
import { api, Contract } from '../../lib/api';
import { formatDate, formatZAR, statusLabel } from '../../lib/format';
import { Card, Row, Pill, statusPillColor, Btn, ErrMsg } from '../../components/ui';

function formatPct(v: string | number | null | undefined) {
  if (v === null || v === undefined) return '—';
  return Number(v).toFixed(2).replace(/\.00$/, '') + '%';
}

export default function ContractDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState('');
  const [signErr, setSignErr] = useState('');
  const otpRef = useRef<TextInput>(null);

  async function load() {
    api.contracts.get(id!).then((r) => setContract(r.data)).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [id]);

  async function sign() {
    if (otp.length < 6) { setSignErr('Enter the 6-digit OTP sent to your mobile'); return; }
    setSigning(true); setSignErr('');
    try {
      await api.contracts.sign(id!, otp);
      Alert.alert('Signed!', 'Contract signed successfully. Sessions will be scheduled shortly.', [
        { text: 'OK', onPress: () => { setShowOtp(false); load(); } },
      ]);
    } catch (e: unknown) {
      setSignErr(e instanceof Error ? e.message : 'Signing failed');
    } finally { setSigning(false); }
  }

  if (loading) return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  if (!contract) return <View style={{ flex: 1, backgroundColor: C.bg, padding: 20 }}><Text style={{ color: C.red }}>Contract not found</Text></View>;

  const needsSign = !contract.operator_signed_at;
  const digits = otp.padEnd(6, ' ').split('');

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={S.container}>
      {/* Header */}
      <View style={S.header}>
        <View style={{ flex: 1 }}>
          <Text style={S.ref}>{contract.contract_ref}</Text>
          <Text style={S.site}>{contract.site_slot?.site?.trading_name ?? '—'} · {contract.site_slot?.day_of_week}</Text>
        </View>
        <Pill label={needsSign ? 'Awaiting your signature' : statusLabel(contract.status)} color={needsSign ? 'amber' : statusPillColor(contract.status)} />
      </View>

      {/* Terms */}
      <Card>
        <Text style={S.cardTitle}>Commercial terms — locked at signing</Text>
        <Row label="Hourly rate" value={`${formatZAR(contract.hourly_rate_cents)}/hr`} valueColor={C.greenLight} />
        <Row label="Upside model" value={`${contract.upside_model === 'fixed' ? 'Fixed' : 'Variable'} ${formatPct(contract.upside_pct)}`} />
        <Row label="Platform fee" value={formatPct(contract.platform_fee_pct)} />
        <Row label="Notice period" value={`${contract.notice_period_days} days`} />
      </Card>

      {/* Signatures */}
      <Card>
        <Text style={S.cardTitle}>Signatures</Text>
        <Row label="Site owner signed" value={formatDate(contract.site_owner_signed_at)} />
        <Row
          label="Operator signed"
          value={contract.operator_signed_at ? formatDate(contract.operator_signed_at) : 'Awaiting'}
          valueColor={contract.operator_signed_at ? C.greenLight : C.amber}
        />
        <Row label="Terminated" value={contract.terminated_at ? formatDate(contract.terminated_at) : '—'} />
      </Card>

      {/* Sign section */}
      {needsSign && !showOtp && (
        <View style={S.signPrompt}>
          <Text style={S.signPromptTitle}>Ready to sign?</Text>
          <Text style={S.signPromptText}>
            By signing you agree to the commercial terms above and the ZombieTech Zombie Services Agreement.
            These terms are locked from the moment you sign.
          </Text>
          <Btn label="Sign with OTP →" onPress={() => { setShowOtp(true); setTimeout(() => otpRef.current?.focus(), 300); }} />
        </View>
      )}

      {needsSign && showOtp && (
        <Card tint="green">
          <Text style={S.cardTitle}>Enter your OTP to sign</Text>
          <Text style={{ fontSize: 12, color: C.textMuted, marginBottom: 12 }}>We sent a code to your registered mobile number.</Text>

          <ErrMsg msg={signErr} />

          <TextInput
            ref={otpRef}
            style={S.hiddenInput}
            value={otp}
            onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
          />

          <TouchableOpacity style={S.otpRow} onPress={() => otpRef.current?.focus()}>
            {digits.map((d, i) => (
              <View key={i} style={[S.otpBox, otp.length === i && S.otpBoxActive, otp.length > i && S.otpBoxFilled]}>
                <Text style={S.otpDigit}>{d.trim()}</Text>
              </View>
            ))}
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity style={[S.cancelBtn, { flex: 1 }]} onPress={() => { setShowOtp(false); setOtp(''); setSignErr(''); }}>
              <Text style={{ color: C.textMuted, fontSize: 13, textAlign: 'center' }}>Cancel</Text>
            </TouchableOpacity>
            <Btn label={signing ? 'Signing…' : 'Confirm signature'} onPress={sign} loading={signing} style={{ flex: 2 }} />
          </View>
        </Card>
      )}
    </ScrollView>
  );
}

const S = StyleSheet.create({
  container: { padding: 16 },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, gap: 10 },
  ref: { fontSize: 18, fontWeight: '700', color: C.textPrimary, fontVariant: ['tabular-nums'], marginBottom: 2 },
  site: { fontSize: 12, color: C.textMuted },
  cardTitle: { fontSize: 11, fontWeight: '600', color: C.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  signPrompt: { backgroundColor: C.amberBg, borderRadius: 14, padding: 16, borderWidth: 0.5, borderColor: C.amberBorder, marginBottom: 10 },
  signPromptTitle: { fontSize: 16, fontWeight: '700', color: C.amber, marginBottom: 8 },
  signPromptText: { fontSize: 12, color: C.textSec, lineHeight: 20, marginBottom: 16 },
  hiddenInput: { height: 0, opacity: 0, position: 'absolute' },
  otpRow: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: 16 },
  otpBox: { width: 40, height: 50, borderRadius: 10, backgroundColor: C.card, borderWidth: 0.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  otpBoxActive: { borderColor: C.green, borderWidth: 1.5, backgroundColor: C.greenBg },
  otpBoxFilled: { backgroundColor: '#1a2e1a', borderColor: C.greenBorder },
  otpDigit: { fontSize: 20, fontWeight: '600', color: C.greenLight },
  cancelBtn: { borderRadius: 12, padding: 14, backgroundColor: C.card, borderWidth: 0.5, borderColor: C.border },
});
