/**
 * Shared UI primitives for the ZombieTech operator app.
 * Dark-mode only. All StyleSheet-based (no NativeWind dependency).
 */
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { C } from '../lib/colors';

// ── Card ────────────────────────────────────────────────────────────────────
export function Card({ children, style, tint }: { children: React.ReactNode; style?: ViewStyle; tint?: 'green' | 'blue' | 'amber' | 'purple' }) {
  const tintStyles: ViewStyle = tint === 'green' ? { backgroundColor: C.greenBg, borderColor: C.greenBorder }
    : tint === 'blue' ? { backgroundColor: C.blueBg, borderColor: C.blueBorder }
    : tint === 'amber' ? { backgroundColor: C.amberBg, borderColor: C.amberBorder }
    : tint === 'purple' ? { backgroundColor: C.purpleBg, borderColor: C.purpleBorder }
    : {};
  return <View style={[S.card, tintStyles, style]}>{children}</View>;
}

// ── Row ─────────────────────────────────────────────────────────────────────
export function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={S.row}>
      <Text style={S.rowLabel}>{label}</Text>
      <Text style={[S.rowValue, valueColor ? { color: valueColor } : {}]}>{value}</Text>
    </View>
  );
}

// ── Button ──────────────────────────────────────────────────────────────────
interface BtnProps {
  label: string; onPress: () => void; disabled?: boolean; loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'amber'; style?: ViewStyle;
}
export function Btn({ label, onPress, disabled, loading, variant = 'primary', style }: BtnProps) {
  const bg = variant === 'primary' ? C.green
    : variant === 'secondary' ? C.card
    : variant === 'danger' ? C.redBg
    : C.amber;
  const textColor = variant === 'secondary' ? C.textSec
    : variant === 'danger' ? C.red
    : variant === 'amber' ? '#111'
    : '#fff';
  return (
    <TouchableOpacity
      style={[S.btn, { backgroundColor: bg, opacity: disabled || loading ? 0.5 : 1 }, style]}
      onPress={onPress} disabled={disabled || loading}
    >
      {loading ? <ActivityIndicator color={textColor} size="small" /> : <Text style={[S.btnText, { color: textColor }]}>{label}</Text>}
    </TouchableOpacity>
  );
}

// ── Pill / Badge ─────────────────────────────────────────────────────────────
export function Pill({ label, color = 'gray' }: { label: string; color?: 'green' | 'blue' | 'amber' | 'red' | 'purple' | 'gray' }) {
  const bg = color === 'green' ? C.greenBg : color === 'blue' ? C.blueBg : color === 'amber' ? C.amberBg
    : color === 'red' ? C.redBg : color === 'purple' ? C.purpleBg : '#222';
  const textColor = color === 'green' ? C.greenLight : color === 'blue' ? C.blueLight : color === 'amber' ? C.amber
    : color === 'red' ? C.red : color === 'purple' ? C.purple : C.textMuted;
  return (
    <View style={[S.pill, { backgroundColor: bg }]}>
      <Text style={[S.pillText, { color: textColor }]}>{label}</Text>
    </View>
  );
}

export function statusPillColor(status: string): 'green' | 'blue' | 'amber' | 'red' | 'purple' | 'gray' {
  const map: Record<string, 'green' | 'blue' | 'amber' | 'red' | 'purple' | 'gray'> = {
    active: 'green', completed: 'green', released: 'green', approved: 'green', pass: 'green',
    open: 'amber', pending: 'amber', in_notice: 'amber',
    scheduled: 'blue', ready: 'blue', under_review: 'blue',
    flagged: 'red', failed: 'red', rejected: 'red', declined: 'red', disputed: 'red',
    held: 'purple',
    cancelled: 'gray', terminated: 'gray', expired: 'gray', suspended: 'gray',
  };
  return map[status] ?? 'gray';
}

// ── Section header ───────────────────────────────────────────────────────────
export function SectionHeader({ title }: { title: string }) {
  return <Text style={S.sectionHeader}>{title}</Text>;
}

// ── Empty state ──────────────────────────────────────────────────────────────
export function Empty({ message }: { message: string }) {
  return (
    <View style={S.empty}>
      <Text style={S.emptyText}>{message}</Text>
    </View>
  );
}

// ── Error message ────────────────────────────────────────────────────────────
export function ErrMsg({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <View style={S.errBox}>
      <Text style={S.errText}>{msg}</Text>
    </View>
  );
}

// ── Screen wrapper ───────────────────────────────────────────────────────────
export function Screen({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[S.screen, style]}>{children}</View>;
}

const S = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: C.border, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 0.5, borderBottomColor: '#222' },
  rowLabel: { fontSize: 11, color: C.textMuted },
  rowValue: { fontSize: 11, fontWeight: '500', color: C.textPrimary },
  btn: { borderRadius: 12, padding: 14, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 14, fontWeight: '600' },
  pill: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  pillText: { fontSize: 9, fontWeight: '600' },
  sectionHeader: { fontSize: 11, fontWeight: '600', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8, marginTop: 4 },
  empty: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { fontSize: 13, color: C.textMuted },
  errBox: { backgroundColor: C.redBg, borderRadius: 10, padding: 10, marginBottom: 8 },
  errText: { fontSize: 12, color: C.red },
  screen: { flex: 1, backgroundColor: C.bg },
});
