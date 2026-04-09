import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { C } from '../../lib/colors';
import { api, Session, ChecklistItem } from '../../lib/api';
import { formatDateTime, formatZAR, statusLabel } from '../../lib/format';
import { Card, Row, Pill, statusPillColor, Btn, ErrMsg } from '../../components/ui';

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState('');

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    setErr('');
    try {
      const [sessRes, checkRes] = await Promise.allSettled([
        api.sessions.get(id!),
        api.sessions.checklist(id!),
      ]);
      if (sessRes.status === 'fulfilled') setSession(sessRes.value.data);
      if (checkRes.status === 'fulfilled') setChecklist(checkRes.value.data);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to load session');
    } finally { setLoading(false); setRefreshing(false); }
  }

  useEffect(() => { load(); }, [id]);

  if (loading) return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  if (!session) return <View style={{ flex: 1, backgroundColor: C.bg, padding: 20 }}><Text style={{ color: C.red }}>Session not found</Text></View>;

  const status = session.status;
  const isScheduled = status === 'scheduled';
  const isActive = status === 'active';
  const isCompleted = status === 'completed';

  const scoreColour = !session.ai_handover_score ? C.textMuted
    : session.ai_handover_score >= 80 ? C.greenLight
    : session.ai_handover_score >= 60 ? C.amber : C.red;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={S.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={C.green} />}
    >
      {/* Status bar */}
      <View style={[S.statusBanner,
        isActive ? { backgroundColor: C.greenBg, borderColor: C.greenBorder }
        : isScheduled ? { backgroundColor: C.blueBg, borderColor: C.blueBorder }
        : {}
      ]}>
        {isActive && <View style={S.liveRing} />}
        <Text style={{ fontSize: 13, fontWeight: '600', color: isActive ? C.greenLight : isScheduled ? C.blueLight : C.textSec }}>
          {isActive ? 'Session live' : isScheduled ? 'Upcoming session' : statusLabel(status)}
        </Text>
        <Pill label={statusLabel(status)} color={statusPillColor(status)} />
      </View>

      <ErrMsg msg={err} />

      {/* Core info */}
      <Card>
        <Text style={S.sessionRef}>{session.session_ref}</Text>
        <Text style={S.siteName}>{session.contract?.site_slot?.site?.trading_name ?? '—'}</Text>
        <View style={{ marginTop: 10 }}>
          <Row label="Scheduled start" value={formatDateTime(session.scheduled_start)} />
          <Row label="Scheduled end" value={formatDateTime(session.scheduled_end)} />
          {session.actual_start && <Row label="Actual start" value={formatDateTime(session.actual_start)} />}
          {session.actual_end && <Row label="Actual end" value={formatDateTime(session.actual_end)} />}
          {session.gross_revenue_cents && <Row label="Gross revenue" value={formatZAR(session.gross_revenue_cents)} valueColor={C.greenLight} />}
        </View>
      </Card>

      {/* Checklist progress */}
      <Card>
        <Text style={S.cardTitle}>Checklist progress</Text>
        {[
          { label: 'Before photos', done: session.before_photos_complete, type: 'before' },
          { label: 'After photos', done: session.after_photos_complete, type: 'after' },
          { label: 'Lock-up', done: session.lockup_complete, type: 'lockup' },
        ].map(({ label, done, type }) => (
          <TouchableOpacity
            key={type}
            style={[S.checkItem, done && S.checkItemDone, isActive && !done && S.checkItemActive]}
            onPress={() => isActive && router.push({ pathname: `/sessions/${id}/photos`, params: { type } } as never)}
            disabled={!isActive || done}
          >
            <View style={[S.checkBox, done && S.checkBoxDone, isActive && !done && S.checkBoxActive]}>
              <Text style={{ fontSize: 10, color: done ? '#fff' : isActive ? C.green : C.textMuted }}>
                {done ? '✓' : isActive ? '→' : '○'}
              </Text>
            </View>
            <Text style={[S.checkLabel, done && { color: C.greenLight }, isActive && !done && { color: '#fff', fontWeight: '600' }]}>
              {label}
            </Text>
            {isActive && !done && <Text style={{ color: C.green, fontSize: 11 }}>Take photos →</Text>}
          </TouchableOpacity>
        ))}
      </Card>

      {/* AI score */}
      {session.ai_handover_score !== null && (
        <Card>
          <Text style={S.cardTitle}>AI handover score</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={S.scoreBar}>
              <View style={[S.scoreBarFill, { width: `${session.ai_handover_score}%` as `${number}%`, backgroundColor: scoreColour }]} />
            </View>
            <Text style={{ color: scoreColour, fontWeight: '700', fontSize: 16 }}>{session.ai_handover_score}/100</Text>
          </View>
          {session.ai_flags_count !== null && (
            <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 6 }}>{session.ai_flags_count} flag{session.ai_flags_count !== 1 ? 's' : ''} raised</Text>
          )}
        </Card>
      )}

      {/* Actions */}
      {isScheduled && (
        <Btn
          label="Start handover (dual OTP) →"
          onPress={() => router.push(`/sessions/${id}/handover` as never)}
          style={{ marginTop: 8 }}
        />
      )}

      {isActive && (
        <View style={{ gap: 10, marginTop: 8 }}>
          {!session.before_photos_complete && (
            <Btn label="Take before photos →" onPress={() => router.push({ pathname: `/sessions/${id}/photos`, params: { type: 'before' } } as never)} />
          )}
          {session.before_photos_complete && !session.after_photos_complete && (
            <Btn label="Take after photos →" onPress={() => router.push({ pathname: `/sessions/${id}/photos`, params: { type: 'after' } } as never)} />
          )}
          {session.before_photos_complete && session.after_photos_complete && !session.lockup_complete && (
            <Btn label="Complete lock-up photos →" onPress={() => router.push({ pathname: `/sessions/${id}/photos`, params: { type: 'lockup' } } as never)} />
          )}
        </View>
      )}
    </ScrollView>
  );
}

const S = StyleSheet.create({
  container: { padding: 16 },
  statusBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12, borderWidth: 0.5, borderColor: C.border, marginBottom: 12 },
  liveRing: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.green },
  sessionRef: { fontSize: 12, fontWeight: '700', color: C.textMuted, fontVariant: ['tabular-nums'], marginBottom: 2 },
  siteName: { fontSize: 18, fontWeight: '700', color: C.textPrimary },
  cardTitle: { fontSize: 11, fontWeight: '600', color: C.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  checkItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, borderWidth: 0.5, borderColor: C.border, backgroundColor: C.card, marginBottom: 8 },
  checkItemDone: { backgroundColor: C.greenBg, borderColor: C.greenBorder },
  checkItemActive: { borderColor: C.green, backgroundColor: '#0d2e1e' },
  checkBox: { width: 22, height: 22, borderRadius: 6, backgroundColor: '#222', borderWidth: 0.5, borderColor: '#333', alignItems: 'center', justifyContent: 'center' },
  checkBoxDone: { backgroundColor: C.green, borderColor: C.green },
  checkBoxActive: { borderWidth: 1.5, borderColor: C.green },
  checkLabel: { flex: 1, fontSize: 13, color: C.textMuted },
  scoreBar: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#222', overflow: 'hidden' },
  scoreBarFill: { height: '100%', borderRadius: 3 },
});
