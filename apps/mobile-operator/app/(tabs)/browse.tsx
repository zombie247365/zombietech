import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, RefreshControl, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { C } from '../../lib/colors';
import { api, Site } from '../../lib/api';
import { formatZAR, formatZARShort } from '../../lib/format';
import { Pill, ErrMsg } from '../../components/ui';

// Monthly revenue forecast based on site fee and slot hours
function forecast(site: Site) {
  const hourlyRate = Number(site.hourly_rate_cents);
  const sessions = 4; // 4 sessions per month (weekly)
  // Conservative: 60% of capacity, Base: 80%, Optimistic: 110%
  return {
    low: hourlyRate * sessions * 0.6 * 8,
    mid: hourlyRate * sessions * 0.8 * 8,
    high: hourlyRate * sessions * 1.1 * 8,
  };
}

export default function BrowseScreen() {
  const router = useRouter();
  const [sites, setSites] = useState<Site[]>([]);
  const [filtered, setFiltered] = useState<Site[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState('');

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setErr('');
    try {
      const res = await api.sites.list({ listed: 'true' });
      setSites(res.data);
      setFiltered(res.data);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to load sites');
    } finally { setLoading(false); setRefreshing(false); }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    if (!q) { setFiltered(sites); return; }
    setFiltered(sites.filter((s) =>
      s.trading_name.toLowerCase().includes(q) ||
      s.suburb.toLowerCase().includes(q) ||
      s.city.toLowerCase().includes(q) ||
      s.business_category.toLowerCase().includes(q)
    ));
  }, [search, sites]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={S.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={C.green} />}
    >
      {/* Search */}
      <View style={S.searchBar}>
        <Text style={S.searchIcon}>🔍</Text>
        <TextInput
          style={S.searchInput}
          placeholder="Suburb or area..."
          placeholderTextColor={C.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Pill label="Landlord verified" color="green" />
          <Pill label="Fri/Sat slots" color="blue" />
          <Pill label="Food" color="gray" />
          <Pill label="< R4k/mth" color="gray" />
        </View>
      </ScrollView>

      <ErrMsg msg={err} />

      {loading && <Text style={{ color: C.textMuted, textAlign: 'center', paddingVertical: 32 }}>Loading sites...</Text>}

      {!loading && filtered.length === 0 && (
        <Text style={{ color: C.textMuted, textAlign: 'center', paddingVertical: 32 }}>No sites found</Text>
      )}

      {filtered.map((site, idx) => {
        const fc = forecast(site);
        const verified = site.consent_status === 'landlord_verified';
        return (
          <TouchableOpacity key={site.id} onPress={() => router.push(`/sites/${site.id}` as never)} style={[S.siteCard, idx === 0 && verified && S.siteCardFeatured]}>
            <View style={S.siteCardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={S.siteName}>{site.trading_name}</Text>
                <Text style={S.siteMeta}>{site.suburb}, {site.city} · {site.business_category}</Text>
              </View>
              <Pill label={verified ? 'Verified' : 'Consent uploaded'} color={verified ? 'green' : 'amber'} />
            </View>

            {/* Slots */}
            {site.site_slots && site.site_slots.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', gap: 5 }}>
                  {site.site_slots.slice(0, 3).map((slot) => (
                    <View key={slot.id} style={S.slotChip}>
                      <Text style={S.slotChipText}>{slot.day_of_week} {slot.slot_start_time?.slice(0, 5)}–{slot.slot_end_time?.slice(0, 5)}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}

            {/* Revenue forecast */}
            <Text style={S.forecastLabel}>Revenue forecast — base case</Text>
            <View style={S.forecastRow}>
              <View style={[S.fcBand, { backgroundColor: C.blueBg }]}>
                <Text style={[S.fcBandLabel, { color: '#378add' }]}>Conservative</Text>
                <Text style={[S.fcBandValue, { color: C.blueLight }]}>{formatZARShort(fc.low)}</Text>
              </View>
              <View style={[S.fcBand, { backgroundColor: C.greenBg, borderWidth: 0.5, borderColor: C.greenBorder }]}>
                <Text style={[S.fcBandLabel, { color: C.green }]}>Base case</Text>
                <Text style={[S.fcBandValue, { color: C.greenLight }]}>{formatZARShort(fc.mid)}</Text>
              </View>
              <View style={[S.fcBand, { backgroundColor: C.amberBg }]}>
                <Text style={[S.fcBandLabel, { color: '#ba7517' }]}>Optimistic</Text>
                <Text style={[S.fcBandValue, { color: C.amber }]}>{formatZARShort(fc.high)}</Text>
              </View>
            </View>

            <View style={S.siteFooter}>
              <Text style={S.siteFooterText}>Site fee: {formatZAR(site.hourly_rate_cents)}/hr</Text>
              <Text style={S.siteFooterText}>Score: {site.site_score}/100</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const S = StyleSheet.create({
  container: { padding: 14 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 10, borderWidth: 0.5, borderColor: C.border, paddingHorizontal: 12, height: 38, marginBottom: 10 },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 13, color: C.textPrimary },
  siteCard: { backgroundColor: C.card, borderRadius: 14, padding: 12, borderWidth: 0.5, borderColor: C.border, marginBottom: 10 },
  siteCardFeatured: { backgroundColor: C.greenBg, borderColor: C.greenBorder },
  siteCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  siteName: { fontSize: 14, fontWeight: '600', color: C.textPrimary, marginBottom: 2 },
  siteMeta: { fontSize: 10, color: C.textMuted },
  slotChip: { backgroundColor: C.blueBg, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  slotChipText: { fontSize: 9, color: C.blueLight, fontWeight: '500' },
  forecastLabel: { fontSize: 9, color: C.textDim, marginBottom: 5 },
  forecastRow: { flexDirection: 'row', gap: 5, marginBottom: 8 },
  fcBand: { flex: 1, borderRadius: 6, padding: 6, alignItems: 'center' },
  fcBandLabel: { fontSize: 8, fontWeight: '500', marginBottom: 2 },
  fcBandValue: { fontSize: 12, fontWeight: '600' },
  siteFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  siteFooterText: { fontSize: 9, color: C.textDim },
});
