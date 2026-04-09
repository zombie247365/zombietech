import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { C } from '../../lib/colors';
import { api, Operator, Session, Contract } from '../../lib/api';
import { formatDate, formatDateTime, formatZAR, statusLabel } from '../../lib/format';
import { Card, Pill, statusPillColor, ErrMsg } from '../../components/ui';

export default function HomeScreen() {
  const router = useRouter();
  const [operator, setOperator] = useState<Operator | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState('');

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    setErr('');
    try {
      const [opRes, sessRes, contRes] = await Promise.allSettled([
        api.operator.me(),
        api.sessions.list(),
        api.contracts.list(),
      ]);
      if (opRes.status === 'fulfilled') setOperator(opRes.value.data);
      if (sessRes.status === 'fulfilled') setSessions(sessRes.value.data);
      if (contRes.status === 'fulfilled') setContracts(contRes.value.data);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to load');
    } finally { setRefreshing(false); }
  }

  useEffect(() => { load(); }, []);

  const activeSession = sessions.find((s) => s.status === 'active');
  const nextSession = sessions.find((s) => s.status === 'scheduled');
  const activeContracts = contracts.filter((c) => c.status === 'active');

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={S.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={C.green} />}
    >
      {/* Greeting */}
      <View style={S.greeting}>
        <Text style={S.greetingName}>Hi, {operator?.user?.full_name?.split(' ')[0] ?? 'Operator'} 👋</Text>
        <Text style={S.greetingSub}>
          {operator?.vetting_status === 'approved' ? 'Vetting approved — you are ready to trade.' : `Vetting: ${statusLabel(operator?.vetting_status ?? 'pending')}`}
        </Text>
      </View>

      <ErrMsg msg={err} />

      {/* Active session banner */}
      {activeSession && (
        <TouchableOpacity onPress={() => router.push(`/sessions/${activeSession.id}` as never)} style={S.activeBanner}>
          <View style={S.liveRing} />
          <Text style={S.activeBannerText}>Session live — {activeSession.contract?.site_slot?.site?.trading_name ?? 'Active site'}</Text>
          <Text style={S.activeBannerArrow}>→</Text>
        </TouchableOpacity>
      )}

      {/* Stats grid */}
      <View style={S.statsGrid}>
        <Card tint="green" style={{ flex: 1 }}>
          <Text style={S.statLabel}>Active contracts</Text>
          <Text style={S.statValue}>{activeContracts.length}</Text>
        </Card>
        <Card tint="blue" style={{ flex: 1 }}>
          <Text style={S.statLabel}>Sessions total</Text>
          <Text style={S.statValue}>{sessions.length}</Text>
        </Card>
      </View>
      <View style={S.statsGrid}>
        <Card style={{ flex: 1 }}>
          <Text style={S.statLabel}>Trust score</Text>
          <Text style={[S.statValue, { color: C.greenLight }]}>{operator?.trust_score ?? 0}/100</Text>
        </Card>
        <Card style={{ flex: 1 }}>
          <Text style={S.statLabel}>Activation fee</Text>
          <Text style={S.statValue}>{formatZAR(operator?.activation_fee_balance ?? 0)}</Text>
        </Card>
      </View>

      {/* Next session */}
      {nextSession && (
        <>
          <Text style={S.sectionTitle}>Next session</Text>
          <TouchableOpacity onPress={() => router.push(`/sessions/${nextSession.id}` as never)}>
            <Card tint="green">
              <Text style={S.sessionSite}>{nextSession.contract?.site_slot?.site?.trading_name ?? '—'}</Text>
              <Text style={S.sessionDate}>{formatDateTime(nextSession.scheduled_start)} → {formatDateTime(nextSession.scheduled_end)}</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                <Pill label={statusLabel(nextSession.status)} color={statusPillColor(nextSession.status)} />
              </View>
            </Card>
          </TouchableOpacity>
        </>
      )}

      {/* Active contracts */}
      {activeContracts.length > 0 && (
        <>
          <Text style={S.sectionTitle}>Active contracts</Text>
          {activeContracts.slice(0, 3).map((c) => (
            <TouchableOpacity key={c.id} onPress={() => router.push(`/contracts/${c.id}` as never)}>
              <Card>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={S.contractRef}>{c.contract_ref}</Text>
                    <Text style={S.contractSite}>{c.site_slot?.site?.trading_name ?? '—'} · {c.site_slot?.day_of_week}</Text>
                  </View>
                  <Pill label={statusLabel(c.status)} color={statusPillColor(c.status)} />
                </View>
              </Card>
            </TouchableOpacity>
          ))}
        </>
      )}

      {/* Quick actions */}
      <Text style={S.sectionTitle}>Quick actions</Text>
      <View style={S.quickActions}>
        {[
          { label: '🔍 Browse sites', onPress: () => router.push('/(tabs)/browse') },
          { label: '📋 My bookings', onPress: () => router.push('/(tabs)/bookings') },
          { label: '📝 My contracts', onPress: () => router.push('/(tabs)/contracts') },
          { label: '💰 My earnings', onPress: () => router.push('/(tabs)/financials') },
        ].map(({ label, onPress }) => (
          <TouchableOpacity key={label} style={S.quickBtn} onPress={onPress}>
            <Text style={S.quickBtnText}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const S = StyleSheet.create({
  container: { padding: 16 },
  greeting: { marginBottom: 16 },
  greetingName: { fontSize: 22, fontWeight: '700', color: C.textPrimary, marginBottom: 2 },
  greetingSub: { fontSize: 12, color: C.textMuted },
  activeBanner: { backgroundColor: C.greenBg, borderRadius: 12, borderWidth: 1, borderColor: C.greenBorder, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  liveRing: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.green },
  activeBannerText: { flex: 1, fontSize: 13, fontWeight: '600', color: C.greenLight },
  activeBannerArrow: { color: C.greenLight, fontSize: 16 },
  statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 0 },
  statLabel: { fontSize: 10, color: C.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: 22, fontWeight: '700', color: C.textPrimary },
  sectionTitle: { fontSize: 11, fontWeight: '600', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10, marginTop: 16 },
  sessionSite: { fontSize: 15, fontWeight: '600', color: C.textPrimary, marginBottom: 2 },
  sessionDate: { fontSize: 11, color: C.textMuted },
  contractRef: { fontSize: 12, fontWeight: '600', color: C.textPrimary, fontVariant: ['tabular-nums'], marginBottom: 2 },
  contractSite: { fontSize: 11, color: C.textMuted },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickBtn: { backgroundColor: C.card, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 0.5, borderColor: C.border },
  quickBtnText: { fontSize: 12, color: C.textSec, fontWeight: '500' },
});
