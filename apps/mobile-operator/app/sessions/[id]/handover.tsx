import { useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { C } from '../../../lib/colors';
import { api } from '../../../lib/api';
import { Btn, ErrMsg } from '../../../components/ui';

export default function HandoverSignScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const otpRef = useRef<TextInput>(null);
  const digits = otp.padEnd(6, ' ').split('');

  async function sign() {
    if (otp.length < 6) { setErr('Enter the 6-digit OTP from the site owner'); return; }
    setLoading(true); setErr('');
    try {
      await api.sessions.handoverSign(id!, otp);
      Alert.alert(
        'Handover complete!',
        'Both signatures confirmed. Session is now live. Start your before-photos checklist.',
        [{ text: 'Start photos →', onPress: () => router.replace(`/sessions/${id}` as never) }]
      );
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Handover sign failed');
    } finally { setLoading(false); }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={S.container}>
      {/* Header */}
      <View style={S.hero}>
        <Text style={S.heroEmoji}>🤝</Text>
        <Text style={S.title}>Dual OTP handover</Text>
        <Text style={S.subtitle}>
          The site owner will receive an OTP on their phone. They show it to you — enter it below to confirm both parties are present and the site is ready.
        </Text>
      </View>

      {/* Steps */}
      <View style={S.steps}>
        {[
          { n: '1', label: 'Site owner receives OTP on their app', done: true },
          { n: '2', label: 'Site owner shows you their 6-digit code', done: true },
          { n: '3', label: 'You enter the code below to confirm handover', done: false },
        ].map(({ n, label, done }) => (
          <View key={n} style={S.step}>
            <View style={[S.stepNum, done && S.stepNumDone]}>
              <Text style={[S.stepNumText, done && { color: C.greenLight }]}>{done ? '✓' : n}</Text>
            </View>
            <Text style={[S.stepLabel, !done && { color: C.textPrimary, fontWeight: '500' }]}>{label}</Text>
          </View>
        ))}
      </View>

      <ErrMsg msg={err} />

      {/* OTP input */}
      <View style={S.otpSection}>
        <Text style={S.otpLabel}>Enter the site owner OTP</Text>
        <TextInput
          ref={otpRef}
          style={S.hiddenInput}
          value={otp}
          onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
        />
        <TouchableOpacity style={S.otpRow} onPress={() => otpRef.current?.focus()}>
          {digits.map((d, i) => (
            <View key={i} style={[S.otpBox, otp.length === i && S.otpBoxActive, otp.length > i && S.otpBoxFilled]}>
              <Text style={S.otpDigit}>{d.trim()}</Text>
            </View>
          ))}
        </TouchableOpacity>
      </View>

      <Btn label={loading ? 'Confirming…' : 'Confirm handover →'} onPress={sign} loading={loading} />

      <View style={S.warningBox}>
        <Text style={S.warningText}>
          By confirming you acknowledge that the site has been inspected and accepted in its current condition.
          Before-photo documentation begins immediately after this step.
        </Text>
      </View>
    </ScrollView>
  );
}

const S = StyleSheet.create({
  container: { padding: 20 },
  hero: { alignItems: 'center', marginBottom: 24 },
  heroEmoji: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '700', color: C.textPrimary, marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 13, color: C.textMuted, textAlign: 'center', lineHeight: 20 },
  steps: { marginBottom: 24, gap: 12 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.card, borderWidth: 0.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  stepNumDone: { backgroundColor: C.greenBg, borderColor: C.greenBorder },
  stepNumText: { fontSize: 10, fontWeight: '700', color: C.textMuted },
  stepLabel: { fontSize: 13, color: C.textMuted, flex: 1, lineHeight: 18 },
  otpSection: { marginBottom: 20 },
  otpLabel: { fontSize: 12, color: C.textMuted, marginBottom: 12, textAlign: 'center' },
  hiddenInput: { height: 0, opacity: 0, position: 'absolute' },
  otpRow: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: 8 },
  otpBox: { width: 42, height: 54, borderRadius: 10, backgroundColor: C.card, borderWidth: 0.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  otpBoxActive: { borderColor: C.green, borderWidth: 1.5, backgroundColor: C.greenBg },
  otpBoxFilled: { backgroundColor: '#1a2e1a', borderColor: C.greenBorder },
  otpDigit: { fontSize: 22, fontWeight: '600', color: C.greenLight },
  warningBox: { backgroundColor: '#111', borderRadius: 10, padding: 12, marginTop: 16, borderWidth: 0.5, borderColor: C.border },
  warningText: { fontSize: 11, color: C.textMuted, textAlign: 'center', lineHeight: 18 },
});
