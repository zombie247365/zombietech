import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { C } from '../../../lib/colors';
import { api } from '../../../lib/api';
import { Btn, ErrMsg } from '../../../components/ui';

export default function BookingFormScreen() {
  const { id: siteId, slotId } = useLocalSearchParams<{ id: string; slotId?: string }>();
  const router = useRouter();

  const [form, setForm] = useState({
    site_slot_id: slotId ?? '',
    concept_summary: '',
    requested_start_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    recurring: true,
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  function update(key: string, val: string | boolean) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function submit() {
    if (!form.site_slot_id) { setErr('No slot selected. Go back and pick a slot.'); return; }
    if (!form.concept_summary.trim()) { setErr('Please describe your trading concept'); return; }
    setLoading(true); setErr('');
    try {
      await api.bookings.create({
        site_slot_id: form.site_slot_id,
        concept_summary: form.concept_summary,
        requested_start_date: form.requested_start_date,
        recurring: form.recurring,
      });
      router.replace('/(tabs)/bookings');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Booking failed');
    } finally { setLoading(false); }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={S.container} keyboardShouldPersistTaps="handled">
        <Text style={S.title}>Request a booking</Text>
        <Text style={S.subtitle}>The site owner will review your request and respond within 48 hours.</Text>

        <ErrMsg msg={err} />

        <Label>Your trading concept *</Label>
        <TextInput
          style={[S.input, S.textArea]}
          placeholder="Describe your food concept, menu style, target customer, typical order value..."
          placeholderTextColor={C.textMuted}
          value={form.concept_summary}
          onChangeText={(v) => update('concept_summary', v)}
          multiline numberOfLines={5}
          textAlignVertical="top"
        />

        <Label>Preferred start date</Label>
        <TextInput
          style={S.input}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={C.textMuted}
          value={form.requested_start_date}
          onChangeText={(v) => update('requested_start_date', v)}
        />

        <Label>Booking type</Label>
        <View style={S.toggleRow}>
          {[{ label: 'Weekly recurring', val: true }, { label: 'One-off', val: false }].map(({ label, val }) => (
            <TouchableOpacity
              key={label}
              style={[S.toggleBtn, form.recurring === val && S.toggleBtnActive]}
              onPress={() => update('recurring', val)}
            >
              <Text style={[S.toggleBtnText, form.recurring === val && S.toggleBtnTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={S.infoBox}>
          <Text style={S.infoText}>
            By requesting a booking you agree to ZombieTech terms. A contract will be generated if approved. You will sign digitally via OTP.
          </Text>
        </View>

        <Btn label="Submit booking request" onPress={submit} loading={loading} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Label({ children }: { children: string }) {
  return <Text style={{ fontSize: 11, color: C.textMuted, marginBottom: 6, marginTop: 14 }}>{children}</Text>;
}

const S = StyleSheet.create({
  container: { padding: 20 },
  title: { fontSize: 22, fontWeight: '700', color: C.textPrimary, marginBottom: 6 },
  subtitle: { fontSize: 13, color: C.textMuted, lineHeight: 20, marginBottom: 16 },
  input: { backgroundColor: C.card, borderRadius: 10, borderWidth: 0.5, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: C.textPrimary, marginBottom: 4 },
  textArea: { height: 120, textAlignVertical: 'top' },
  toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  toggleBtn: { flex: 1, borderRadius: 10, padding: 12, alignItems: 'center', backgroundColor: C.card, borderWidth: 0.5, borderColor: C.border },
  toggleBtnActive: { backgroundColor: C.greenBg, borderColor: C.greenBorder },
  toggleBtnText: { fontSize: 13, color: C.textMuted, fontWeight: '500' },
  toggleBtnTextActive: { color: C.greenLight },
  infoBox: { backgroundColor: C.blueBg, borderRadius: 10, padding: 12, marginVertical: 16, borderWidth: 0.5, borderColor: C.blueBorder },
  infoText: { fontSize: 11, color: C.blueLight, lineHeight: 18 },
});
