import { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { C } from '../../lib/colors';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';
import { Btn, ErrMsg } from '../../components/ui';

export default function OtpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mobile?: string; next?: string }>();
  const { signIn } = useAuth();

  const [mobile, setMobile] = useState(params.mobile ?? '');
  const [otp, setOtp] = useState('');
  const [stage, setStage] = useState<'mobile' | 'otp'>(params.mobile ? 'otp' : 'mobile');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [err, setErr] = useState('');
  const otpRef = useRef<TextInput>(null);

  useEffect(() => {
    if (stage === 'otp') {
      setTimeout(() => otpRef.current?.focus(), 300);
      startCooldown();
    }
  }, [stage]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendCooldown]);

  function startCooldown() { setResendCooldown(30); }

  async function requestOtp() {
    if (!mobile) { setErr('Enter your mobile number'); return; }
    const normalised = mobile.startsWith('+27') ? mobile : '+27' + mobile.replace(/^0/, '');
    setLoading(true); setErr('');
    try {
      await api.auth.requestOtp(normalised);
      setMobile(normalised);
      setStage('otp');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to send OTP');
    } finally { setLoading(false); }
  }

  async function verifyOtp() {
    if (otp.length < 6) { setErr('Enter the 6-digit code'); return; }
    setLoading(true); setErr('');
    try {
      const res = await api.auth.verifyOtp(mobile, otp);
      await signIn(res.data.token, res.data.user);
      const next = params.next ?? '/(tabs)/home';
      router.replace(next as never);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Invalid OTP');
    } finally { setLoading(false); }
  }

  // Display OTP boxes
  const digits = otp.padEnd(6, ' ').split('');

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={S.container}>
        <View style={S.header}>
          <Text style={S.logo}>🧟</Text>
          <Text style={S.title}>{stage === 'mobile' ? 'Sign in to ZombieTech' : 'Verify your number'}</Text>
          <Text style={S.subtitle}>
            {stage === 'mobile'
              ? 'Enter your mobile number to receive a one-time code.'
              : `We sent a 6-digit code to ${mobile}`}
          </Text>
        </View>

        <ErrMsg msg={err} />

        {stage === 'mobile' ? (
          <>
            <TextInput
              style={S.input}
              placeholder="+27 or 0xx xxx xxxx"
              placeholderTextColor={C.textMuted}
              value={mobile}
              onChangeText={setMobile}
              keyboardType="phone-pad"
              autoFocus
            />
            <Btn label="Send code" onPress={requestOtp} loading={loading} />
          </>
        ) : (
          <>
            {/* Hidden real input */}
            <TextInput
              ref={otpRef}
              style={S.hiddenInput}
              value={otp}
              onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
            />

            {/* Visual OTP boxes */}
            <TouchableOpacity style={S.otpRow} onPress={() => otpRef.current?.focus()}>
              {digits.map((d, i) => (
                <View key={i} style={[
                  S.otpBox,
                  otp.length === i && S.otpBoxActive,
                  otp.length > i && S.otpBoxFilled,
                ]}>
                  <Text style={S.otpDigit}>{d.trim()}</Text>
                </View>
              ))}
            </TouchableOpacity>

            <Btn label="Verify" onPress={verifyOtp} loading={loading} style={{ marginBottom: 12 }} />

            <TouchableOpacity
              disabled={resendCooldown > 0}
              onPress={() => { setOtp(''); requestOtp(); }}
              style={{ alignItems: 'center' }}
            >
              <Text style={{ color: resendCooldown > 0 ? C.textMuted : C.greenLight, fontSize: 13 }}>
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setStage('mobile')} style={{ alignItems: 'center', marginTop: 12 }}>
              <Text style={{ color: C.textMuted, fontSize: 12 }}>← Change number</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 80 },
  header: { alignItems: 'center', marginBottom: 32 },
  logo: { fontSize: 40, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: C.textPrimary, marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 13, color: C.textMuted, textAlign: 'center', lineHeight: 20 },
  input: { height: 52, backgroundColor: C.card, borderRadius: 12, borderWidth: 0.5, borderColor: C.border, paddingHorizontal: 16, fontSize: 18, color: C.textPrimary, marginBottom: 16, letterSpacing: 2 },
  hiddenInput: { height: 0, opacity: 0, position: 'absolute' },
  otpRow: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: 24 },
  otpBox: { width: 42, height: 52, borderRadius: 10, backgroundColor: C.card, borderWidth: 0.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  otpBoxActive: { borderColor: C.green, borderWidth: 1.5, backgroundColor: C.greenBg },
  otpBoxFilled: { backgroundColor: '#1a2e1a', borderColor: C.greenBorder },
  otpDigit: { fontSize: 20, fontWeight: '600', color: C.greenLight },
});
