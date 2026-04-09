import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { C } from '../../lib/colors';
import { api, Contract } from '../../lib/api';
import { formatDate, formatZAR, statusLabel } from '../../lib/format';
import { Pill, statusPillColor, Empty } from '../../components/ui';

function formatPct(v: string | number | null | undefined) {
  if (v === null || v === undefined) return '—';
  return Number(v).toFixed(2).replace(/\.00$/, '') + '%';
}

export default function ContractsScreen() {
  const router = useRouter();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await api.contracts.list();
      setContracts(res.data);
    } catch { /* silently fail */ }
    finally { setLoading(false); setRefreshing(false); }
  }

  useEffect(() => { load(); }, []);

  const active = contracts.filter((c) => c.status === 'active' || c.status === 'in_notice');
  const past = contracts.filter((c) => c.status === 'terminated' || c.status === 'expired');
  const pending = contracts.filter((c) => !c.operator_signed_at);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={S.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={C.green} />}
    >
      {loading && <Text style={{ color: C.textMuted, textAlign: 'center', paddingVertical: 32 }}>Loading...</Text>}
      {!loading && contracts.length === 0 && <Empty message="No contracts yet. Book a site to get started." />}

      {pending.length > 0 && (
        <>
          <Text style={S.sectionLabel}>Awaiting your signature ({pending.length})</Text>
          {pending.map((c) => <ContractCard key={c.id} contract={c} onPress={() => router.push(`/contracts/${c.id}` as never)} />)}
        </>
      )}

      {active.length > 0 && (
        <>
          <Text style={S.sectionLabel}>Active ({active.length})</Text>
          {active.map((c) => <ContractCard key={c.id} contract={c} onPress={() => router.push(`/contracts/${c.id}` as never)} />)}
        </>
      )}

      {past.length > 0 && (
        <>
          <Text style={S.sectionLabel}>Past</Text>
          {past.map((c) => <ContractCard key={c.id} contract={c} onPress={() => router.push(`/contracts/${c.id}` as never)} />)}
        </>
      )}
    </ScrollView>
  );
}

function ContractCard({ contract: c, onPress }: { contract: Contract; onPress: () => void }) {
  const unsigned = !c.operator_signed_at;
  return (
    <TouchableOpacity style={[S.card, unsigned && S.cardUnsigned]} onPress={onPress}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={S.ref}>{c.contract_ref}</Text>
          <Text style={S.site}>{c.site_slot?.site?.trading_name ?? '—'} · {c.site_slot?.day_of_week}</Text>
        </View>
        <Pill label={unsigned ? 'Sign needed' : statusLabel(c.status)} color={unsigned ? 'amber' : statusPillColor(c.status)} />
      </View>
      <View style={S.terms}>
        <View style={S.termItem}>
          <Text style={S.termLabel}>Rate</Text>
          <Text style={S.termValue}>{formatZAR(c.hourly_rate_cents)}/hr</Text>
        </View>
        <View style={S.termItem}>
          <Text style={S.termLabel}>Upside</Text>
          <Text style={S.termValue}>{c.upside_model === 'fixed' ? 'F' : 'V'} {formatPct(c.upside_pct)}</Text>
        </View>
        <View style={S.termItem}>
          <Text style={S.termLabel}>Signed</Text>
          <Text style={S.termValue}>{formatDate(c.site_owner_signed_at)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const S = StyleSheet.create({
  container: { padding: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '600', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8, marginTop: 8 },
  card: { backgroundColor: C.card, borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: C.border, marginBottom: 10 },
  cardUnsigned: { backgroundColor: C.amberBg, borderColor: C.amberBorder },
  ref: { fontSize: 13, fontWeight: '700', color: C.textPrimary, fontVariant: ['tabular-nums'], marginBottom: 2 },
  site: { fontSize: 11, color: C.textMuted },
  terms: { flexDirection: 'row', gap: 12 },
  termItem: { flex: 1 },
  termLabel: { fontSize: 9, color: C.textMuted, marginBottom: 2, textTransform: 'uppercase' },
  termValue: { fontSize: 12, fontWeight: '600', color: C.textPrimary },
});
