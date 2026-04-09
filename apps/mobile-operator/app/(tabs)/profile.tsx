/**
 * Trust & Profile screen.
 * Shows operator trust score, vetting status, score history, and account settings.
 * Screen 17 from CLAUDE.md: Trust & profile
 */
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { C } from '../../lib/colors';
import { api, Operator } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';
import { formatDate, statusLabel } from '../../lib/format';
import { Card, Row, Pill, statusPillColor } from '../../components/ui';

function ScoreBar({ score }: { score: number }) {
  const colour = score >= 80 ? C.greenLight : score >= 60 ? C.amber : C.red;
  return (
    <View style={SB.wrap}>
      <View style={SB.bar}>
        <View style={[SB.fill, { width: `${score}%` as `${number}%`, backgroundColor: colour }]} />
      </View>
      <Text style={[SB.label, { color: colour }]}>{score}/100</Text>
    </View>
  );
}
const SB = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  bar: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#222', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  label: { fontSize: 13, fontWeight: '700', minWidth: 44, textAlign: 'right' },
});

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [operator, setOperator] = useState<Operator | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await api.operator.me();
      setOperator(res.data);
    } catch { /* ignore */ }
    finally { setRefreshing(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out', style: 'destructive',
        onPress: async () => { await signOut(); router.replace('/'); },
      },
    ]);
  }

  const trustScore = operator?.trust_score ?? 0;
  const vettingStatus = operator?.vetting_status ?? 'pending';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={S.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={C.green} />}
    >
      {/* Profile header */}
      <View style={S.profileHeader}>
        <View style={S.avatar}>
          <Text style={S.avatarText}>
            {user?.full_name?.split(' ').map((w) => w[0]).slice(0, 2).join('') ?? 'ZO'}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={S.name}>{user?.full_name ?? '—'}</Text>
          <Text style={S.concept}>{operator?.trading_concept ?? 'Zombie Operator'}</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
            <Pill label={statusLabel(vettingStatus)} color={statusPillColor(vettingStatus)} />
            <Pill label={operator?.food_category ?? '—'} color="gray" />
          </View>
        </View>
      </View>

      {/* Trust score */}
      <Card tint="green">
        <Text style={S.cardTitle}>Trust score</Text>
        <ScoreBar score={trustScore} />
        <Text style={S.scoreDesc}>
          {trustScore >= 80
            ? 'Excellent — you are a trusted operator on the platform.'
            : trustScore >= 60
            ? 'Good standing. Keep completing clean sessions to grow your score.'
            : 'Building trust. Complete sessions cleanly to improve your score.'}
        </Text>

        {/* Score breakdown */}
        <View style={S.scoreLegend}>
          {[
            { label: '80+', desc: 'Platinum operator', colour: C.greenLight },
            { label: '60–79', desc: 'Silver operator', colour: C.blueLight },
            { label: '< 60', desc: 'Building trust', colour: C.amber },
          ].map(({ label, desc, colour }) => (
            <View key={label} style={S.legendItem}>
              <View style={[S.legendDot, { backgroundColor: colour }]} />
              <Text style={S.legendLabel}>{label}</Text>
              <Text style={S.legendDesc}>{desc}</Text>
            </View>
          ))}
        </View>
      </Card>

      {/* Account details */}
      <Card>
        <Text style={S.cardTitle}>Account</Text>
        <Row label="Full name" value={user?.full_name ?? '—'} />
        <Row label="Mobile" value={user?.mobile ?? '—'} />
        <Row label="Email" value={user?.email ?? '—'} />
        <Row label="Role" value={user?.role ?? '—'} />
      </Card>

      {/* Operator details */}
      <Card>
        <Text style={S.cardTitle}>Operator profile</Text>
        <Row label="Trading concept" value={operator?.trading_concept ?? '—'} />
        <Row label="Food category" value={operator?.food_category ?? '—'} />
        <Row label="Vetting status" value={statusLabel(vettingStatus)} />
        {operator?.vetting_approved_at && (
          <Row label="Approved" value={formatDate(operator.vetting_approved_at)} />
        )}
        <Row
          label="Activation fee remaining"
          value={operator?.activation_fee_balance
            ? `R${(operator.activation_fee_balance / 100).toFixed(2)}`
            : 'R0.00'}
        />
      </Card>

      {/* Actions */}
      <Card>
        <Text style={S.cardTitle}>Account actions</Text>
        <TouchableOpacity style={S.actionRow} onPress={() => router.push('/auth/documents')}>
          <Text style={S.actionText}>📄 Upload / update documents</Text>
          <Text style={S.actionArrow}>→</Text>
        </TouchableOpacity>
        <TouchableOpacity style={S.actionRow} onPress={() => router.push('/auth/vetting')}>
          <Text style={S.actionText}>🔍 View vetting status</Text>
          <Text style={S.actionArrow}>→</Text>
        </TouchableOpacity>
        <TouchableOpacity style={S.actionRow} onPress={() => router.push('/(tabs)/financials')}>
          <Text style={S.actionText}>💰 My earnings</Text>
          <Text style={S.actionArrow}>→</Text>
        </TouchableOpacity>
      </Card>

      {/* Sign out */}
      <TouchableOpacity style={S.signOutBtn} onPress={handleSignOut}>
        <Text style={S.signOutText}>Sign out</Text>
      </TouchableOpacity>

      <Text style={S.version}>ZombieTech Operator App · v1.0.0</Text>
    </ScrollView>
  );
}

const S = StyleSheet.create({
  container: { padding: 16 },
  profileHeader: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 16,
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: C.greenBg, borderWidth: 1.5, borderColor: C.greenBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: '700', color: C.greenLight },
  name: { fontSize: 20, fontWeight: '700', color: C.textPrimary, marginBottom: 2 },
  concept: { fontSize: 12, color: C.textMuted },
  cardTitle: {
    fontSize: 11, fontWeight: '600', color: C.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
  },
  scoreDesc: { fontSize: 12, color: C.textMuted, lineHeight: 18, marginTop: 8 },
  scoreLegend: { flexDirection: 'row', gap: 10, marginTop: 12 },
  legendItem: { flex: 1, alignItems: 'center', gap: 3 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 10, fontWeight: '700', color: C.textPrimary },
  legendDesc: { fontSize: 9, color: C.textMuted, textAlign: 'center' },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#1e1e1e',
  },
  actionText: { fontSize: 13, color: C.textSec },
  actionArrow: { fontSize: 16, color: C.textMuted },
  signOutBtn: {
    backgroundColor: C.redBg, borderRadius: 12, padding: 14,
    alignItems: 'center', borderWidth: 0.5, borderColor: C.redBorder, marginTop: 8,
  },
  signOutText: { color: C.red, fontSize: 14, fontWeight: '600' },
  version: { textAlign: 'center', fontSize: 10, color: C.textDim, marginTop: 20, marginBottom: 8 },
});
