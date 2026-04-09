import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { C } from '../../lib/colors';
import { api } from '../../lib/api';
import { Btn, ErrMsg } from '../../components/ui';

export default function RegisterScreen() {
  const router = useRouter();
  const [form, setForm] = useState({
    full_name: '', email: '', mobile: '',
    trading_concept: '', food_category: '',
  });
  const [step, setStep] = useState<'account' | 'operator'>('account');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  function update(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function submitAccount() {
    if (!form.full_name || !form.mobile) { setErr('Name and mobile number are required'); return; }
    const mobile = form.mobile.startsWith('+27') ? form.mobile : '+27' + form.mobile.replace(/^0/, '');
    setLoading(true); setErr('');
    try {
      await api.auth.register({ mobile, full_name: form.full_name, email: form.email });
      update('mobile', mobile);
      setStep('operator');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Registration failed');
    } finally { setLoading(false); }
  }

  async function submitOperator() {
    if (!form.trading_concept || !form.food_category) { setErr('Trading concept and food category are required'); return; }
    setLoading(true); setErr('');
    try {
      // Send OTP to complete registration via verify-otp flow
      await api.auth.requestOtp(form.mobile);
      router.push({ pathname: '/auth/otp', params: { mobile: form.mobile, next: '/auth/documents' } });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to send OTP');
    } finally { setLoading(false); }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={S.container} keyboardShouldPersistTaps="handled">
        <View style={S.header}>
          <Text style={S.title}>{step === 'account' ? 'Create your account' : 'Your operation'}</Text>
          <Text style={S.subtitle}>
            {step === 'account'
              ? 'Join ZombieTech and start trading from commercial kitchens tonight.'
              : 'Tell us about what you will be cooking and selling.'}
          </Text>
        </View>

        {/* Step indicator */}
        <View style={S.steps}>
          {['Account', 'Operation', 'Verify', 'Documents'].map((s, i) => (
            <View key={s} style={S.stepItem}>
              <View style={[S.stepDot, (step === 'account' ? i <= 0 : i <= 1) && S.stepDotActive]}>
                <Text style={S.stepDotText}>{i + 1}</Text>
              </View>
              <Text style={S.stepLabel}>{s}</Text>
            </View>
          ))}
        </View>

        <ErrMsg msg={err} />

        {step === 'account' ? (
          <View style={S.form}>
            <Label>Full name</Label>
            <TextInput style={S.input} placeholder="Your full name" placeholderTextColor={C.textMuted}
              value={form.full_name} onChangeText={(v) => update('full_name', v)} autoCapitalize="words" />

            <Label>Email address</Label>
            <TextInput style={S.input} placeholder="name@example.com" placeholderTextColor={C.textMuted}
              value={form.email} onChangeText={(v) => update('email', v)} keyboardType="email-address" autoCapitalize="none" />

            <Label>Mobile number</Label>
            <TextInput style={S.input} placeholder="+27 or 0xx" placeholderTextColor={C.textMuted}
              value={form.mobile} onChangeText={(v) => update('mobile', v)} keyboardType="phone-pad" />

            <Btn label="Continue" onPress={submitAccount} loading={loading} style={{ marginTop: 8 }} />
          </View>
        ) : (
          <View style={S.form}>
            <Label>Trading concept</Label>
            <TextInput style={[S.input, { height: 80, textAlignVertical: 'top', paddingTop: 12 }]}
              placeholder="Describe your food business concept..." placeholderTextColor={C.textMuted}
              value={form.trading_concept} onChangeText={(v) => update('trading_concept', v)}
              multiline numberOfLines={3} />

            <Label>Food category</Label>
            <TextInput style={S.input} placeholder="e.g. Pizza, Asian, Burgers..." placeholderTextColor={C.textMuted}
              value={form.food_category} onChangeText={(v) => update('food_category', v)} />

            <Btn label="Send verification OTP" onPress={submitOperator} loading={loading} style={{ marginTop: 8 }} />
            <TouchableOpacity onPress={() => setStep('account')} style={{ marginTop: 12, alignItems: 'center' }}>
              <Text style={{ color: C.textMuted, fontSize: 13 }}>← Back</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={S.loginLink} onPress={() => router.push('/auth/otp')}>
          <Text style={S.loginLinkText}>Already have an account? Sign in</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Label({ children }: { children: string }) {
  return <Text style={{ fontSize: 11, color: C.textMuted, marginBottom: 4, marginTop: 12 }}>{children}</Text>;
}

const S = StyleSheet.create({
  container: { padding: 24, paddingTop: 60 },
  header: { marginBottom: 24 },
  title: { fontSize: 26, fontWeight: '700', color: C.textPrimary, marginBottom: 6 },
  subtitle: { fontSize: 13, color: C.textMuted, lineHeight: 20 },
  steps: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  stepItem: { alignItems: 'center', gap: 4 },
  stepDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.card, borderWidth: 0.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  stepDotActive: { backgroundColor: C.greenBg, borderColor: C.greenBorder },
  stepDotText: { fontSize: 9, fontWeight: '600', color: C.textMuted },
  stepLabel: { fontSize: 9, color: C.textMuted },
  form: {},
  input: { height: 46, backgroundColor: C.card, borderRadius: 10, borderWidth: 0.5, borderColor: C.border, paddingHorizontal: 14, fontSize: 14, color: C.textPrimary, marginBottom: 4 },
  loginLink: { alignItems: 'center', paddingTop: 24 },
  loginLinkText: { color: C.textMuted, fontSize: 13 },
});
