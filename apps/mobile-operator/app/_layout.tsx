import { Stack } from 'expo-router';
import { StatusBar } from 'react-native';
import { AuthProvider } from '../lib/AuthContext';
import { C } from '../lib/colors';

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar barStyle="light-content" backgroundColor={C.card} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: C.card },
          headerTintColor: C.textPrimary,
          headerTitleStyle: { fontSize: 15, fontWeight: '600' },
          contentStyle: { backgroundColor: C.bg },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="auth/register" options={{ headerShown: false }} />
        <Stack.Screen name="auth/otp" options={{ headerShown: false }} />
        <Stack.Screen name="auth/documents" options={{ title: 'Upload Documents', headerBackTitle: '' }} />
        <Stack.Screen name="auth/vetting" options={{ title: 'Vetting Status', headerBackTitle: '' }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="sites/[id]" options={{ title: 'Site Detail', headerBackTitle: '' }} />
        <Stack.Screen name="sites/[id]/book" options={{ title: 'Request Booking', headerBackTitle: '' }} />
        <Stack.Screen name="bookings/[id]" options={{ title: 'Booking', headerBackTitle: '' }} />
        <Stack.Screen name="contracts/[id]" options={{ title: 'Contract', headerBackTitle: '' }} />
        <Stack.Screen name="sessions/[id]" options={{ title: 'Session', headerBackTitle: '' }} />
        <Stack.Screen name="sessions/[id]/photos" options={{ title: 'Take Photo', headerBackTitle: '' }} />
        <Stack.Screen name="sessions/[id]/handover" options={{ title: 'Handover Sign', headerBackTitle: '' }} />
        <Stack.Screen name="sessions/[id]/checklist" options={{ title: 'Pre-Session Checklist', headerBackTitle: '' }} />
        <Stack.Screen name="sessions/[id]/live" options={{ title: 'Trading Live', headerBackTitle: '' }} />
        <Stack.Screen name="settlements/[id]" options={{ title: 'Settlement', headerBackTitle: '' }} />
      </Stack>
    </AuthProvider>
  );
}
