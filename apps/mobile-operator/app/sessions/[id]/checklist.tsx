/**
 * Pre-session checklist screen.
 * Shown before the session starts — operator reviews what they need to document.
 * Read-only view of the site checklist items grouped by category.
 */
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { C } from '../../../lib/colors';
import { api, ChecklistItem } from '../../../lib/api';
import { Btn } from '../../../components/ui';

const CATEGORY_ICONS: Record<string, string> = {
  kitchen: '🍳',
  equipment: '⚙️',
  security: '🔒',
  custom: '📋',
};

export default function PreSessionChecklistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.sessions.checklist(id!)
      .then((r) => setItems(r.data.sort((a, b) => a.sort_order - b.sort_order)))
      .finally(() => setLoading(false));
  }, [id]);

  // Group by category
  const grouped = items.reduce<Record<string, ChecklistItem[]>>((acc, item) => {
    const cat = item.area_category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={S.container}>
      <View style={S.hero}>
        <Text style={S.heroEmoji}>📋</Text>
        <Text style={S.title}>Pre-session checklist</Text>
        <Text style={S.subtitle}>
          Review what you will need to document tonight. Before photos are required for every item below.
          Take your time — good documentation protects you.
        </Text>
      </View>

      {loading && <Text style={{ color: C.textMuted, textAlign: 'center', paddingVertical: 24 }}>Loading checklist...</Text>}

      {Object.entries(grouped).map(([category, catItems]) => (
        <View key={category} style={S.group}>
          <Text style={S.groupHeader}>
            {CATEGORY_ICONS[category] ?? '📌'} {category.charAt(0).toUpperCase() + category.slice(1)} ({catItems.length})
          </Text>
          {catItems.map((item, idx) => (
            <View key={item.id} style={[S.item, idx === catItems.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={S.itemNum}>
                <Text style={S.itemNumText}>{item.sort_order}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={S.itemName}>
                  {item.area_name}
                  {item.is_required && <Text style={{ color: C.amber }}> *</Text>}
                </Text>
                {item.description ? <Text style={S.itemDesc}>{item.description}</Text> : null}
              </View>
            </View>
          ))}
        </View>
      ))}

      <View style={S.noteBox}>
        <Text style={S.noteText}>
          Items marked * are required. Photos must be taken in order during lock-up.
          You cannot move to the next item until the previous is captured.
        </Text>
      </View>

      <Btn
        label="Ready — start handover →"
        onPress={() => router.push(`/sessions/${id}/handover` as never)}
        style={{ marginTop: 8 }}
      />

      <Btn
        label="Go back to session"
        onPress={() => router.back()}
        variant="secondary"
        style={{ marginTop: 10 }}
      />
    </ScrollView>
  );
}

const S = StyleSheet.create({
  container: { padding: 16 },
  hero: { alignItems: 'center', marginBottom: 20 },
  heroEmoji: { fontSize: 40, marginBottom: 10 },
  title: { fontSize: 22, fontWeight: '700', color: C.textPrimary, marginBottom: 6, textAlign: 'center' },
  subtitle: { fontSize: 13, color: C.textMuted, textAlign: 'center', lineHeight: 20 },
  group: {
    backgroundColor: C.card, borderRadius: 12, borderWidth: 0.5,
    borderColor: C.border, overflow: 'hidden', marginBottom: 12,
  },
  groupHeader: {
    fontSize: 11, fontWeight: '700', color: C.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.6,
    backgroundColor: '#161616', paddingHorizontal: 14, paddingVertical: 8,
  },
  item: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 0.5, borderBottomColor: '#1e1e1e',
  },
  itemNum: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#222', alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  itemNumText: { fontSize: 9, fontWeight: '700', color: C.textMuted },
  itemName: { fontSize: 13, fontWeight: '600', color: C.textPrimary, marginBottom: 2 },
  itemDesc: { fontSize: 11, color: C.textMuted, lineHeight: 16 },
  noteBox: {
    backgroundColor: C.amberBg, borderRadius: 10, padding: 12,
    marginVertical: 16, borderWidth: 0.5, borderColor: C.amberBorder,
  },
  noteText: { fontSize: 11, color: C.amber, lineHeight: 18 },
});
