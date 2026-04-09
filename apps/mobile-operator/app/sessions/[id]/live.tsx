/**
 * Trading live screen.
 * Shown when session status = 'active' and before-photos are complete.
 * Operator is actively trading. Shows elapsed time, revenue entry, and what comes next.
 */
import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { C } from '../../../lib/colors';
import { api, Session } from '../../../lib/api';
import { formatDateTime, formatZAR } from '../../../lib/format';
import { Btn, ErrMsg, Card } from '../../../components/ui';

function elapsed(start: string | null): string {
  if (!start) return '0:00:00';
  const diff = Date.now() - new Date(start).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function TradingLiveScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [time, setTime] = useState('0:00:00');
  const [grossRevenue, setGrossRevenue] = useState('');
  const [closing, setClosing] = useState(false);
  const [err, setErr] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await api.sessions.get(id!);
      setSession(res.data);
    } catch { /* ignore */ }
    finally { setRefreshing(false); }
  }

  useEffect(() => {
    load();
    timerRef.current = setInterval(() => {
      setTime((prev) => {
        // Will be recalculated based on session actual_start once loaded
        return prev;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [id]);

  useEffect(() => {
    if (!session?.actual_start) return;
    const start = session.actual_start;
    const tick = () => setTime(elapsed(start));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [session?.actual_start]);

  async function closeSession() {
    const cents = Math.round(parseFloat(grossRevenue.replace(/[^0-9.]/g, '')) * 100);
    if (!grossRevenue || isNaN(cents) || cents < 0) {
      setErr('Enter your gross revenue for the night (R0 if no sales)');
      return;
    }
    setClosing(true); setErr('');
    try {
      await api.sessions.closeSession(id!, cents);
      router.replace(`/sessions/${id}` as never);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to close session');
    } finally { setClosing(false); }
  }

  const site = session?.contract?.site_slot?.site?.trading_name ?? '—';
  const isActive = session?.status === 'active';
  const afterPhotosDone = session?.after_photos_complete;
  const lockupDone = session?.lockup_complete;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={S.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={C.green} />}
    >
      {/* Live banner */}
      <View style={S.liveBanner}>
        <View style={S.liveRing} />
        <Text style={S.liveText}>Trading live at {site}</Text>
      </View>

      {/* Timer */}
      <Card tint="green" style={{ alignItems: 'center' }}>
        <Text style={S.timerLabel}>Elapsed time</Text>
        <Text style={S.timer}>{time}</Text>
        <Text style={S.timerSub}>
          Started {formatDateTime(session?.actual_start)} · Ends {formatDateTime(session?.scheduled_end)}
        </Text>
      </Card>

      <ErrMsg msg={err} />

      {/* What to do next */}
      <Text style={S.sectionTitle}>Next steps</Text>
      {[
        { label: 'Before photos', done: session?.before_photos_complete, required: true },
        { label: 'After photos', done: session?.after_photos_complete, required: true },
        { label: 'Lock-up photos', done: session?.lockup_complete, required: true },
      ].map(({ label, done }) => (
        <View key={label} style={[S.step, done && S.stepDone]}>
          <Text style={{ fontSize: 14 }}>{done ? '✅' : '⬜'}</Text>
          <Text style={[S.stepText, done && { color: C.greenLight, textDecorationLine: 'line-through' }]}>{label}</Text>
        </View>
      ))}

      {/* After photos prompt */}
      {!afterPhotosDone && (
        <Btn
          label="Take after photos →"
          onPress={() => router.push({ pathname: `/sessions/${id}/photos`, params: { type: 'after' } } as never)}
          style={{ marginTop: 16 }}
        />
      )}

      {/* Lock-up prompt */}
      {afterPhotosDone && !lockupDone && (
        <Btn
          label="Complete lock-up sequence →"
          onPress={() => router.push({ pathname: `/sessions/${id}/photos`, params: { type: 'lockup' } } as never)}
          style={{ marginTop: 16 }}
        />
      )}

      {/* Close session */}
      {isActive && afterPhotosDone && lockupDone && (
        <Card style={{ marginTop: 16 }}>
          <Text style={S.closeTitle}>Close session</Text>
          <Text style={S.closeDesc}>Enter your total gross revenue for tonight (before any deductions).</Text>
          <View style={S.revenueRow}>
            <Text style={S.revenuePrefix}>R</Text>
            <TextInput
              style={S.revenueInput}
              placeholder="0.00"
              placeholderTextColor={C.textMuted}
              value={grossRevenue}
              onChangeText={setGrossRevenue}
              keyboardType="decimal-pad"
            />
          </View>
          <Btn
            label={closing ? 'Closing…' : 'Submit and close session →'}
            onPress={closeSession}
            loading={closing}
            style={{ marginTop: 12 }}
          />
        </Card>
      )}

      <View style={S.infoBox}>
        <Text style={S.infoText}>
          Pull down to refresh. Once all photos are done and session is closed, your handover report is generated automatically.
        </Text>
      </View>
    </ScrollView>
  );
}

const S = StyleSheet.create({
  container: { padding: 16 },
  liveBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.greenBg, borderRadius: 12, padding: 12,
    borderWidth: 0.5, borderColor: C.greenBorder, marginBottom: 12,
  },
  liveRing: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.green },
  liveText: { fontSize: 14, fontWeight: '600', color: C.greenLight },
  timerLabel: { fontSize: 10, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  timer: { fontSize: 42, fontWeight: '800', color: C.greenLight, fontVariant: ['tabular-nums'] },
  timerSub: { fontSize: 11, color: C.textMuted, marginTop: 4, textAlign: 'center' },
  sectionTitle: {
    fontSize: 11, fontWeight: '600', color: C.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8, marginTop: 16,
  },
  step: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.card, borderRadius: 10, padding: 12,
    borderWidth: 0.5, borderColor: C.border, marginBottom: 6,
  },
  stepDone: { backgroundColor: C.greenBg, borderColor: C.greenBorder },
  stepText: { fontSize: 13, color: C.textSec },
  closeTitle: { fontSize: 16, fontWeight: '700', color: C.textPrimary, marginBottom: 4 },
  closeDesc: { fontSize: 12, color: C.textMuted, lineHeight: 18, marginBottom: 12 },
  revenueRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#111', borderRadius: 10, borderWidth: 0.5, borderColor: C.border,
    paddingHorizontal: 14, height: 52,
  },
  revenuePrefix: { fontSize: 22, fontWeight: '700', color: C.textMuted, marginRight: 4 },
  revenueInput: { flex: 1, fontSize: 28, fontWeight: '700', color: C.textPrimary },
  infoBox: {
    backgroundColor: '#111', borderRadius: 10, padding: 12,
    marginTop: 16, borderWidth: 0.5, borderColor: C.border,
  },
  infoText: { fontSize: 11, color: C.textMuted, textAlign: 'center', lineHeight: 18 },
});
