import { Tabs } from 'expo-router';
import { C } from '../../lib/colors';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: C.card },
        headerTintColor: C.textPrimary,
        headerTitleStyle: { fontSize: 15, fontWeight: '600' },
        headerShadowVisible: false,
        tabBarStyle: { backgroundColor: C.card, borderTopColor: C.border, borderTopWidth: 0.5 },
        tabBarActiveTintColor: C.green,
        tabBarInactiveTintColor: C.textMuted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarLabel: 'Home', tabBarIcon: ({ color }) => <TabIcon emoji="🏠" color={color} /> }} />
      <Tabs.Screen name="browse" options={{ title: 'Browse', tabBarLabel: 'Browse', tabBarIcon: ({ color }) => <TabIcon emoji="🔍" color={color} /> }} />
      <Tabs.Screen name="bookings" options={{ title: 'Bookings', tabBarLabel: 'Bookings', tabBarIcon: ({ color }) => <TabIcon emoji="📋" color={color} /> }} />
      <Tabs.Screen name="contracts" options={{ title: 'Contracts', tabBarLabel: 'Contracts', tabBarIcon: ({ color }) => <TabIcon emoji="📝" color={color} /> }} />
      <Tabs.Screen name="financials" options={{ title: 'Earnings', tabBarLabel: 'Earnings', tabBarIcon: ({ color }) => <TabIcon emoji="💰" color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarLabel: 'Profile', tabBarIcon: ({ color }) => <TabIcon emoji="👤" color={color} /> }} />
    </Tabs>
  );
}

import { Text } from 'react-native';
function TabIcon({ emoji, color }: { emoji: string; color: string }) {
  return <Text style={{ fontSize: 18, opacity: color === C.green ? 1 : 0.5 }}>{emoji}</Text>;
}
