import { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/AuthContext';
import { C } from '../lib/colors';

export default function SplashScreen() {
  const router = useRouter();
  const { token, loading } = useAuth();

  useEffect(() => {
    if (!loading && token) {
      router.replace('/(tabs)/home');
    }
  }, [loading, token]);

  if (loading) {
    return <View style={[S.container, { justifyContent: 'center', alignItems: 'center' }]} />;
  }

  return (
    <View style={S.container}>
      <View style={S.hero}>
        <Text style={S.emoji}>🧟</Text>
        <Text style={S.brand}>ZombieTech</Text>
        <Text style={S.tagline}>Reanimate dead kitchens.{'\n'}Trade tonight. Zero capital.</Text>
      </View>

      <View style={S.features}>
        {[
          { icon: '🍳', title: 'Fully equipped kitchens', desc: 'Access commercial-grade equipment during off-hours' },
          { icon: '📋', title: 'Digital contracts', desc: 'Sign, manage and track everything in-app' },
          { icon: '💰', title: 'Weekly settlements', desc: 'Automatic payouts after every trading week' },
        ].map(({ icon, title, desc }) => (
          <View key={title} style={S.featureRow}>
            <Text style={S.featureIcon}>{icon}</Text>
            <View style={S.featureText}>
              <Text style={S.featureTitle}>{title}</Text>
              <Text style={S.featureDesc}>{desc}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={S.actions}>
        <TouchableOpacity style={S.btnPrimary} onPress={() => router.push('/auth/register')}>
          <Text style={S.btnPrimaryText}>Get started — it is free</Text>
        </TouchableOpacity>
        <TouchableOpacity style={S.btnSecondary} onPress={() => router.push('/auth/otp')}>
          <Text style={S.btnSecondaryText}>Already registered? Sign in</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/(tabs)/browse')}>
          <Text style={S.browseLink}>Browse available kitchens first →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 24 },
  hero: { alignItems: 'center', paddingTop: 80, paddingBottom: 32 },
  emoji: { fontSize: 56, marginBottom: 12 },
  brand: { fontSize: 32, fontWeight: '700', color: C.textPrimary, letterSpacing: -0.5, marginBottom: 8 },
  tagline: { fontSize: 16, color: C.textSec, textAlign: 'center', lineHeight: 24 },
  features: { marginBottom: 32 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  featureIcon: { fontSize: 24, width: 36, textAlign: 'center' },
  featureText: { flex: 1 },
  featureTitle: { fontSize: 13, fontWeight: '600', color: C.textPrimary, marginBottom: 2 },
  featureDesc: { fontSize: 11, color: C.textMuted, lineHeight: 16 },
  actions: { gap: 10 },
  btnPrimary: { backgroundColor: C.green, borderRadius: 14, padding: 15, alignItems: 'center' },
  btnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  btnSecondary: { backgroundColor: C.card, borderRadius: 14, padding: 15, alignItems: 'center', borderWidth: 0.5, borderColor: C.border },
  btnSecondaryText: { color: C.textSec, fontSize: 14, fontWeight: '500' },
  browseLink: { textAlign: 'center', color: C.greenLight, fontSize: 13, paddingVertical: 8 },
});
