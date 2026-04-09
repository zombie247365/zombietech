import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { C } from '../../lib/colors';
import { api, Settlement } from '../../lib/api';
import { formatDate, formatZAR, statusLabel } from '../../lib/format';
import { Card, Row, Pill, statusPillColor } from '../../components/ui';

export default function SettlementDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.settlements.get(id!).then((r) => setSettlement(r.data)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  if (!settlement) return <View style={{ flex: 1, backgroundColor: C.bg, padding: 20 }}><Text style={{ color: C.red }}>Settlement not found</Text></View>;

  const waterfall = [
    { label: 'Gross revenue', value: settlement.gross_revenue_cents, deduction: false },
    { label: 'Platform fee (10%)', value: settlement.platform_fee_cents, deduction: true },
    { label: 'Site fees', value: settlement.site_fees_cents, deduction: true },
    { label: 'Landlord share', value: settlement.landlord_share_cents, deduction: true },
    { label: 'Activation deduction', value: settlement.activation_deduction_cents, deduction: true },
    { label: 'Penalty deductions', value: settlement.penalty_deductions_cents, deduction: true },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={S.container}>
      {/* Header */}
      <View style={S.header}>
        <Text style={S.ref}>{settlement.settlement_ref}</Text>
        <Pill label={statusLabel(settlement.status)} color={statusPillColor(settlement.status)} />
      </View>
      <Text style={S.period}>{formatDate(settlement.period_start)} – {formatDate(settlement.period_end)}</Text>

      {/* Payout highlight */}
      <View style={S.payoutCard}>
        <Text style={S.payoutLabel}>Your payout</Text>
        <Text style={S.payoutValue}>{formatZAR(settlement.operator_payout_cents)}</Text>
        {settlement.released_at && (
          <Text style={S.payoutDate}>Released {formatDate(settlement.released_at)}</Text>
        )}
      </View>

      {/* Waterfall */}
      <Card>
        <Text style={S.cardTitle}>Fee breakdown</Text>
        {waterfall.map(({ label, value, deduction }) => (
          <View key={label} style={S.wRow}>
            <Text style={S.wLabel}>{deduction ? '– ' : ''}{label}</Text>
            <Text style={[S.wValue, deduction && Number(value) > 0 && { color: C.red }]}>
              {deduction && Number(value) > 0 ? '-' : ''}{formatZAR(value)}
            </Text>
          </View>
        ))}
        <View style={S.wRowTotal}>
          <Text style={S.wTotalLabel}>Operator payout</Text>
          <Text style={S.wTotalValue}>{formatZAR(settlement.operator_payout_cents)}</Text>
        </View>
      </Card>

      {/* Line items */}
      {settlement.line_items && settlement.line_items.length > 0 && (
        <Card>
          <Text style={S.cardTitle}>Line items</Text>
          {settlement.line_items.map((li) => (
            <View key={li.id} style={S.wRow}>
              <Text style={S.wLabel} numberOfLines={1}>{li.description}</Text>
              <Text style={[S.wValue, Number(li.amount_cents) < 0 && { color: C.red }]}>{formatZAR(li.amount_cents)}</Text>
            </View>
          ))}
        </Card>
      )}

      {/* Meta */}
      <Card>
        <Row label="Status" value={statusLabel(settlement.status)} />
        <Row label="Released" value={settlement.released_at ? formatDate(settlement.released_at) : 'Pending'} />
      </Card>
    </ScrollView>
  );
}

const S = StyleSheet.create({
  container: { padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  ref: { fontSize: 18, fontWeight: '700', color: C.textPrimary, fontVariant: ['tabular-nums'] },
  period: { fontSize: 12, color: C.textMuted, marginBottom: 16 },
  payoutCard: { backgroundColor: C.greenBg, borderRadius: 16, padding: 20, borderWidth: 0.5, borderColor: C.greenBorder, alignItems: 'center', marginBottom: 12 },
  payoutLabel: { fontSize: 11, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  payoutValue: { fontSize: 36, fontWeight: '800', color: C.greenLight, marginBottom: 4 },
  payoutDate: { fontSize: 11, color: C.textMuted },
  cardTitle: { fontSize: 11, fontWeight: '600', color: C.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  wRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: '#1e1e1e' },
  wLabel: { fontSize: 12, color: C.textMuted, flex: 1, marginRight: 8 },
  wValue: { fontSize: 12, fontWeight: '500', color: C.textSec },
  wRowTotal: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8, marginTop: 4, borderTopWidth: 0.5, borderTopColor: C.border },
  wTotalLabel: { fontSize: 13, fontWeight: '700', color: C.textPrimary },
  wTotalValue: { fontSize: 14, fontWeight: '800', color: C.greenLight },
});
