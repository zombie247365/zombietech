import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { C } from '../../lib/colors';
import { api, Site } from '../../lib/api';
import { formatZAR, formatZARShort } from '../../lib/format';
import { Card, Row, Pill, Btn, ErrMsg } from '../../components/ui';

function forecastMonthly(site: Site) {
  const hr = Number(site.hourly_rate_cents);
  return {
    low: Math.round(hr * 8 * 4 * 0.6),
    mid: Math.round(hr * 8 * 4 * 0.85),
    high: Math.round(hr * 8 * 4 * 1.15),
  };
}

export default function SiteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [site, setSite] = useState<Site | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.sites.get(id!).then((r) => setSite(r.data)).catch((e) => setErr(e.message)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  if (!site) return <View style={{ flex: 1, backgroundColor: C.bg, padding: 20 }}><Text style={{ color: C.red }}>Site not found</Text></View>;

  const fc = forecastMonthly(site);
  const verified = site.consent_status === 'landlord_verified';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={S.container}>
      {/* Header */}
      <View style={S.hero}>
        <View style={{ flex: 1 }}>
          <Text style={S.name}>{site.trading_name}</Text>
          <Text style={S.address}>{site.address_line1}, {site.suburb}, {site.city}</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
            <Pill label={verified ? 'Landlord verified' : 'Consent uploaded'} color={verified ? 'green' : 'amber'} />
            <Pill label={`Score: ${site.site_score}`} color="blue" />
            <Pill label={site.score_tier} color="gray" />
          </View>
        </View>
      </View>

      <ErrMsg msg={err} />

      {/* Revenue forecast */}
      <Card tint="green">
        <Text style={S.cardTitle}>Monthly revenue forecast</Text>
        <View style={S.fcRow}>
          <View style={[S.fcBand, { backgroundColor: C.blueBg }]}>
            <Text style={[S.fcLabel, { color: '#378add' }]}>Conservative</Text>
            <Text style={[S.fcVal, { color: C.blueLight }]}>{formatZARShort(fc.low)}</Text>
          </View>
          <View style={[S.fcBand, { backgroundColor: '#0d2e1e', borderWidth: 1, borderColor: C.greenBorder }]}>
            <Text style={[S.fcLabel, { color: C.green }]}>Base case</Text>
            <Text style={[S.fcVal, { color: C.greenLight }]}>{formatZARShort(fc.mid)}</Text>
          </View>
          <View style={[S.fcBand, { backgroundColor: C.amberBg }]}>
            <Text style={[S.fcLabel, { color: '#ba7517' }]}>Optimistic</Text>
            <Text style={[S.fcVal, { color: C.amber }]}>{formatZARShort(fc.high)}</Text>
          </View>
        </View>
        <Text style={S.fcNote}>Based on 4 sessions/mth × 8hr avg at current hourly rate</Text>
      </Card>

      {/* Site details */}
      <Card>
        <Text style={S.cardTitle}>Site details</Text>
        <Row label="Category" value={site.business_category} />
        <Row label="Hourly rate" value={`${formatZAR(site.hourly_rate_cents)}/hr`} valueColor={C.greenLight} />
        <Row label="Opens" value={site.site_opens_time ?? '—'} />
        <Row label="Closes" value={site.site_closes_time ?? '—'} />
        <Row label="Zombie end time" value={site.zombie_end_time ?? '—'} />
      </Card>

      {/* Available slots */}
      {site.site_slots && site.site_slots.length > 0 && (
        <Card>
          <Text style={S.cardTitle}>Available slots</Text>
          {site.site_slots.filter((s) => s.status === 'open').map((slot) => (
            <View key={slot.id} style={S.slotRow}>
              <View style={{ flex: 1 }}>
                <Text style={S.slotDay}>{slot.day_of_week}</Text>
                <Text style={S.slotTime}>{slot.slot_start_time?.slice(0, 5)} – {slot.slot_end_time?.slice(0, 5)} ({slot.slot_hours}hrs)</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={S.slotFee}>{formatZAR(slot.base_fee_cents_per_session)}</Text>
                <Text style={S.slotFeeLabel}>per session</Text>
              </View>
              <TouchableOpacity
                style={S.bookBtn}
                onPress={() => router.push({ pathname: `/sites/${site.id}/book`, params: { slotId: slot.id } } as never)}
              >
                <Text style={S.bookBtnText}>Book</Text>
              </TouchableOpacity>
            </View>
          ))}
          {site.site_slots.every((s) => s.status !== 'open') && (
            <Text style={{ color: C.textMuted, fontSize: 12 }}>No open slots at this site</Text>
          )}
        </Card>
      )}

      <Btn
        label="Request a booking"
        onPress={() => router.push(`/sites/${site.id}/book` as never)}
        style={{ marginTop: 8 }}
      />
    </ScrollView>
  );
}

const S = StyleSheet.create({
  container: { padding: 16 },
  hero: { flexDirection: 'row', marginBottom: 16 },
  name: { fontSize: 22, fontWeight: '700', color: C.textPrimary, marginBottom: 4 },
  address: { fontSize: 12, color: C.textMuted, lineHeight: 18 },
  cardTitle: { fontSize: 12, fontWeight: '600', color: C.textSec, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  fcRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  fcBand: { flex: 1, borderRadius: 8, padding: 8, alignItems: 'center' },
  fcLabel: { fontSize: 9, fontWeight: '500', marginBottom: 3 },
  fcVal: { fontSize: 14, fontWeight: '700' },
  fcNote: { fontSize: 9, color: C.textDim, textAlign: 'center' },
  slotRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#222' },
  slotDay: { fontSize: 13, fontWeight: '600', color: C.textPrimary, textTransform: 'capitalize', marginBottom: 2 },
  slotTime: { fontSize: 11, color: C.textMuted },
  slotFee: { fontSize: 13, fontWeight: '700', color: C.greenLight },
  slotFeeLabel: { fontSize: 9, color: C.textMuted },
  bookBtn: { backgroundColor: C.green, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  bookBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
