import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { C } from '../../lib/colors';
import { api, BookingRequest } from '../../lib/api';
import { formatDate, statusLabel } from '../../lib/format';
import { Pill, statusPillColor, Empty } from '../../components/ui';

export default function BookingsScreen() {
  const router = useRouter();
  const [bookings, setBookings] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await api.bookings.list();
      setBookings(res.data);
    } catch { /* silently fail */ }
    finally { setLoading(false); setRefreshing(false); }
  }

  useEffect(() => { load(); }, []);

  const pending = bookings.filter((b) => b.status === 'pending');
  const rest = bookings.filter((b) => b.status !== 'pending');

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={S.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={C.green} />}
    >
      {loading && <Text style={{ color: C.textMuted, textAlign: 'center', paddingVertical: 32 }}>Loading...</Text>}

      {!loading && bookings.length === 0 && (
        <>
          <Empty message="No bookings yet" />
          <TouchableOpacity style={S.browseBtn} onPress={() => router.push('/(tabs)/browse')}>
            <Text style={S.browseBtnText}>Browse available sites →</Text>
          </TouchableOpacity>
        </>
      )}

      {pending.length > 0 && (
        <>
          <Text style={S.sectionLabel}>Awaiting response ({pending.length})</Text>
          {pending.map((b) => <BookingCard key={b.id} booking={b} onPress={() => router.push(`/bookings/${b.id}` as never)} />)}
        </>
      )}

      {rest.length > 0 && (
        <>
          <Text style={S.sectionLabel}>History</Text>
          {rest.map((b) => <BookingCard key={b.id} booking={b} onPress={() => router.push(`/bookings/${b.id}` as never)} />)}
        </>
      )}
    </ScrollView>
  );
}

function BookingCard({ booking: b, onPress }: { booking: BookingRequest; onPress: () => void }) {
  return (
    <TouchableOpacity style={S.card} onPress={onPress}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <View style={{ flex: 1 }}>
          <Text style={S.siteName}>{b.site_slot?.site?.trading_name ?? '—'}</Text>
          <Text style={S.meta}>{b.site_slot?.day_of_week} slot · Start {formatDate(b.requested_start_date)}</Text>
        </View>
        <Pill label={statusLabel(b.status)} color={statusPillColor(b.status)} />
      </View>
      <Text style={S.concept} numberOfLines={2}>{b.concept_summary}</Text>
      <Text style={S.expires}>Expires {formatDate(b.expires_at)}</Text>
    </TouchableOpacity>
  );
}

const S = StyleSheet.create({
  container: { padding: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '600', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8, marginTop: 8 },
  card: { backgroundColor: C.card, borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: C.border, marginBottom: 10 },
  siteName: { fontSize: 14, fontWeight: '600', color: C.textPrimary, marginBottom: 2 },
  meta: { fontSize: 11, color: C.textMuted },
  concept: { fontSize: 12, color: C.textSec, lineHeight: 18, marginBottom: 6 },
  expires: { fontSize: 10, color: C.textDim },
  browseBtn: { backgroundColor: C.greenBg, borderRadius: 12, borderWidth: 1, borderColor: C.greenBorder, padding: 14, alignItems: 'center', marginTop: 8 },
  browseBtnText: { color: C.greenLight, fontSize: 14, fontWeight: '600' },
});
