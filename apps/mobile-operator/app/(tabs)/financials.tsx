import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { C } from '../../lib/colors';
import { api, Settlement } from '../../lib/api';
import { formatDate, formatZAR, statusLabel } from '../../lib/format';
import { Pill, statusPillColor, Empty, Card } from '../../components/ui';

export default function FinancialsScreen() {
  const router = useRouter();
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await api.settlements.list();
      setSettlements(res.data);
    } catch { /* silently fail */ }
    finally { setLoading(false); setRefreshing(false); }
  }

  useEffect(() => { load(); }, []);

  const totalPaid = settlements.filter((s) => s.status === 'released')
    .reduce((acc, s) => acc + Number(s.operator_payout_cents), 0);
  const pending = settlements.filter((s) => s.status !== 'released');

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={S.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={C.green} />}
    >
      {/* Summary cards */}
      <Card tint="green" style={{ marginBottom: 10 }}>
        <Text style={S.bigLabel}>Total earned</Text>
        <Text style={S.bigValue}>{formatZAR(totalPaid)}</Text>
        <Text style={S.bigSub}>Released to bank account</Text>
      </Card>

      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
        <Card tint="blue" style={{ flex: 1 }}>
          <Text style={S.smallLabel}>Pending</Text>
          <Text style={S.smallValue}>{pending.length}</Text>
        </Card>
        <Card style={{ flex: 1 }}>
          <Text style={S.smallLabel}>Settlements</Text>
          <Text style={S.smallValue}>{settlements.length}</Text>
        </Card>
      </View>

      {loading && <Text style={{ color: C.textMuted, textAlign: 'center' }}>Loading...</Text>}
      {!loading && settlements.length === 0 && <Empty message="No settlements yet. Complete a session to earn." />}

      {/* Settlement list */}
      {settlements.length > 0 && (
        <>
          <Text style={S.sectionLabel}>Settlement history</Text>
          {settlements.map((s) => (
            <TouchableOpacity key={s.id} style={S.card} onPress={() => router.push(`/settlements/${s.id}` as never)}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={S.ref}>{s.settlement_ref}</Text>
                  <Text style={S.period}>{formatDate(s.period_start)} – {formatDate(s.period_end)}</Text>
                </View>
                <Pill label={statusLabel(s.status)} color={statusPillColor(s.status)} />
              </View>

              {/* Mini waterfall */}
              <View style={S.waterfall}>
                <View style={S.wRow}>
                  <Text style={S.wLabel}>Gross revenue</Text>
                  <Text style={S.wValue}>{formatZAR(s.gross_revenue_cents)}</Text>
                </View>
                <View style={S.wRow}>
                  <Text style={S.wLabel}>Platform fee</Text>
                  <Text style={[S.wValue, { color: C.red }]}>-{formatZAR(s.platform_fee_cents)}</Text>
                </View>
                <View style={S.wRow}>
                  <Text style={S.wLabel}>Site fees</Text>
                  <Text style={[S.wValue, { color: C.red }]}>-{formatZAR(s.site_fees_cents)}</Text>
                </View>
                <View style={[S.wRow, S.wRowTotal]}>
                  <Text style={S.wTotalLabel}>Your payout</Text>
                  <Text style={S.wTotalValue}>{formatZAR(s.operator_payout_cents)}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const S = StyleSheet.create({
  container: { padding: 16 },
  bigLabel: { fontSize: 10, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  bigValue: { fontSize: 32, fontWeight: '700', color: C.textPrimary, marginBottom: 2 },
  bigSub: { fontSize: 11, color: C.textMuted },
  smallLabel: { fontSize: 10, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  smallValue: { fontSize: 22, fontWeight: '700', color: C.textPrimary },
  sectionLabel: { fontSize: 11, fontWeight: '600', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 },
  card: { backgroundColor: C.card, borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: C.border, marginBottom: 10 },
  ref: { fontSize: 13, fontWeight: '700', color: C.textPrimary, fontVariant: ['tabular-nums'], marginBottom: 2 },
  period: { fontSize: 11, color: C.textMuted },
  waterfall: { borderTopWidth: 0.5, borderTopColor: C.border, paddingTop: 8 },
  wRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  wLabel: { fontSize: 11, color: C.textMuted },
  wValue: { fontSize: 11, color: C.textSec, fontWeight: '500' },
  wRowTotal: { borderTopWidth: 0.5, borderTopColor: C.border, paddingTop: 6, marginTop: 2 },
  wTotalLabel: { fontSize: 12, fontWeight: '700', color: C.textPrimary },
  wTotalValue: { fontSize: 13, fontWeight: '700', color: C.greenLight },
});
