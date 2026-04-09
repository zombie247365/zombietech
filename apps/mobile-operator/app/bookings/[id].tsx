import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { C } from '../../lib/colors';
import { api, BookingRequest } from '../../lib/api';
import { formatDate, statusLabel } from '../../lib/format';
import { Card, Row, Pill, statusPillColor } from '../../components/ui';

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [booking, setBooking] = useState<BookingRequest | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.bookings.get(id!).then((r) => setBooking(r.data)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  if (!booking) return <View style={{ flex: 1, backgroundColor: C.bg, padding: 20 }}><Text style={{ color: C.red }}>Booking not found</Text></View>;

  const statusColor = statusPillColor(booking.status);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={S.container}>
      <View style={S.header}>
        <Text style={S.site}>{booking.site_slot?.site?.trading_name ?? '—'}</Text>
        <Pill label={statusLabel(booking.status)} color={statusColor} />
      </View>

      <Card>
        <Row label="Slot" value={`${booking.site_slot?.day_of_week} · ${booking.site_slot?.slot_start_time?.slice(0, 5) ?? '—'} – ${booking.site_slot?.slot_end_time?.slice(0, 5) ?? '—'}`} />
        <Row label="Requested start" value={formatDate(booking.requested_start_date)} />
        <Row label="Recurring" value={booking.recurring ? 'Yes — weekly' : 'One-off'} />
        <Row label="Expires" value={formatDate(booking.expires_at)} />
        <Row label="Submitted" value={formatDate(booking.created_at)} />
      </Card>

      <Card>
        <Text style={S.conceptLabel}>Your concept</Text>
        <Text style={S.concept}>{booking.concept_summary}</Text>
      </Card>

      {/* Status info */}
      <View style={[S.statusBox,
        booking.status === 'approved' ? { backgroundColor: C.greenBg, borderColor: C.greenBorder }
        : booking.status === 'declined' ? { backgroundColor: C.redBg, borderColor: C.redBorder }
        : booking.status === 'expired' ? { borderColor: C.border }
        : { backgroundColor: C.blueBg, borderColor: C.blueBorder }
      ]}>
        <Text style={{ fontSize: 12, color: booking.status === 'approved' ? C.greenLight : booking.status === 'declined' ? C.red : C.blueLight, lineHeight: 18 }}>
          {booking.status === 'pending'
            ? 'Your request is awaiting the site owner\'s review. You will be notified when they respond.'
            : booking.status === 'approved'
            ? 'Booking approved! A contract has been generated. Check your Contracts tab to sign.'
            : booking.status === 'declined'
            ? 'This booking request was declined by the site owner.'
            : 'This booking request has expired.'}
        </Text>
      </View>
    </ScrollView>
  );
}

const S = StyleSheet.create({
  container: { padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  site: { fontSize: 20, fontWeight: '700', color: C.textPrimary, flex: 1, marginRight: 10 },
  conceptLabel: { fontSize: 11, fontWeight: '600', color: C.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  concept: { fontSize: 13, color: C.textSec, lineHeight: 20 },
  statusBox: { borderRadius: 12, padding: 14, borderWidth: 0.5, marginTop: 4 },
});
