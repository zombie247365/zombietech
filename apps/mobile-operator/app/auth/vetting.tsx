import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { C } from '../../lib/colors';
import { api, Operator } from '../../lib/api';
import { Btn, Card, ErrMsg } from '../../components/ui';
import { formatDate } from '../../lib/format';

const CHECKS = [
  { key: 'id_biometric', label: 'ID & biometric check' },
  { key: 'address', label: 'Address verification' },
  { key: 'criminal', label: 'Criminal record check' },
  { key: 'cipc', label: 'CIPC business check' },
  { key: 'aml_pep', label: 'AML / PEP screening' },
  { key: 'food_cert', label: 'Food certificate validation' },
];

const STATUS_ICON: Record<string, string> = {
  pass: '✓', fail: '✗', flag: '⚑', pending: '○',
};
const STATUS_COLOR: Record<string, string> = {
  pass: C.greenLight, fail: C.red, flag: C.amber, pending: C.textMuted,
};

export default function VettingScreen() {
  const router = useRouter();
  const [operator, setOperator] = useState<Operator | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState('');

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setErr('');
    try {
      const res = await api.operator.me();
      setOperator(res.data);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to load status');
    } finally { setLoading(false); setRefreshing(false); }
  }

  useEffect(() => { load(); }, []);

  const status = operator?.vetting_status ?? 'pending';
  const approved = status === 'approved';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={S.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={C.green} />}
    >
      <Text style={S.title}>Vetting status</Text>
      <ErrMsg msg={err} />

      {/* Status card */}
      <View style={[S.statusCard,
        approved ? { backgroundColor: C.greenBg, borderColor: C.greenBorder }
        : status === 'rejected' ? { backgroundColor: C.redBg, borderColor: C.redBorder }
        : { backgroundColor: C.blueBg, borderColor: C.blueBorder }
      ]}>
        <Text style={S.statusEmoji}>
          {approved ? '✅' : status === 'rejected' ? '❌' : status === 'suspended' ? '⛔' : '⏳'}
        </Text>
        <Text style={[S.statusLabel, { color: approved ? C.greenLight : status === 'rejected' ? C.red : C.blueLight }]}>
          {approved ? 'Vetting approved' : status === 'rejected' ? 'Vetting rejected' : status === 'suspended' ? 'Account suspended' : 'Vetting in progress'}
        </Text>
        <Text style={S.statusDesc}>
          {approved
            ? `Approved on ${formatDate(operator?.vetting_approved_at)}. You can now browse and book sites.`
            : status === 'rejected'
            ? 'Your vetting was unsuccessful. Contact support for more information.'
            : 'We are running background checks on your documents. This usually takes 24–48 hours.'}
        </Text>
      </View>

      {/* Check breakdown */}
      <Text style={S.sectionLabel}>Check breakdown</Text>
      <View style={S.checksCard}>
        {CHECKS.map((check) => {
          // Without real data we show pending for all if not approved
          const result = approved ? 'pass' : 'pending';
          return (
            <View key={check.key} style={S.checkRow}>
              <Text style={S.checkLabel}>{check.label}</Text>
              <View style={S.checkRight}>
                <Text style={{ color: STATUS_COLOR[result], fontWeight: '600', fontSize: 13 }}>
                  {STATUS_ICON[result]}
                </Text>
                <Text style={{ color: STATUS_COLOR[result], fontSize: 10, marginLeft: 4, textTransform: 'capitalize' }}>
                  {result}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* Info */}
      <View style={S.infoBox}>
        <Text style={S.infoText}>
          Pull down to refresh. Once approved, you will be notified by SMS and push notification.
        </Text>
      </View>

      {/* Actions */}
      {approved && (
        <Btn label="Browse available kitchens →" onPress={() => router.replace('/(tabs)/browse')} style={{ marginTop: 8 }} />
      )}
      {!approved && (
        <>
          <Btn label="Upload more documents" onPress={() => router.push('/auth/documents')} variant="secondary" style={{ marginBottom: 10 }} />
          <TouchableOpacity onPress={() => router.replace('/(tabs)/browse')} style={{ alignItems: 'center' }}>
            <Text style={{ color: C.textMuted, fontSize: 12 }}>Browse sites while you wait</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const S = StyleSheet.create({
  container: { padding: 20 },
  title: { fontSize: 22, fontWeight: '700', color: C.textPrimary, marginBottom: 16 },
  statusCard: { borderRadius: 14, padding: 20, borderWidth: 1, alignItems: 'center', marginBottom: 20 },
  statusEmoji: { fontSize: 36, marginBottom: 10 },
  statusLabel: { fontSize: 17, fontWeight: '700', marginBottom: 6 },
  statusDesc: { fontSize: 12, color: C.textSec, textAlign: 'center', lineHeight: 18 },
  sectionLabel: { fontSize: 11, fontWeight: '600', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  checksCard: { backgroundColor: C.card, borderRadius: 12, borderWidth: 0.5, borderColor: C.border, overflow: 'hidden', marginBottom: 16 },
  checkRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 0.5, borderBottomColor: '#222' },
  checkLabel: { fontSize: 12, color: C.textSec },
  checkRight: { flexDirection: 'row', alignItems: 'center' },
  infoBox: { backgroundColor: '#111', borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 0.5, borderColor: C.border },
  infoText: { fontSize: 11, color: C.textMuted, lineHeight: 18, textAlign: 'center' },
});
