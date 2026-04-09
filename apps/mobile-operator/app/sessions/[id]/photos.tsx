/**
 * Photo capture screen — SESSION PHOTOS ONLY.
 *
 * CRITICAL RULES (enforced here):
 *  1. Expo Camera ONLY — no gallery picker, no file upload.
 *  2. GPS location is captured via expo-location BEFORE each shot.
 *     If GPS is unavailable, the shot is blocked.
 *  3. Photos are uploaded immediately after capture with GPS metadata + server timestamp.
 *  4. Lock-up photos must be taken in sort_order — out-of-order is rejected by the API.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView, Dimensions } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { C } from '../../../lib/colors';
import { api, ChecklistItem, SessionPhoto } from '../../../lib/api';

const { width: SCREEN_W } = Dimensions.get('window');

type PhotoType = 'before' | 'after' | 'lockup';

export default function PhotoCaptureScreen() {
  const { id: sessionId, type } = useLocalSearchParams<{ id: string; type: PhotoType }>();
  const router = useRouter();
  const photoType: PhotoType = (type as PhotoType) ?? 'before';

  const [permission, requestPermission] = useCameraPermissions();
  const [locationPermission, requestLocationPermission] = Location.useForegroundPermissions();

  const cameraRef = useRef<CameraView>(null);

  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [uploadedPhotos, setUploadedPhotos] = useState<SessionPhoto[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [capturing, setCapturing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<string | null>(null);
  const [err, setErr] = useState('');

  const currentItem = checklist[currentIdx];
  const allDone = currentIdx >= checklist.length && checklist.length > 0;

  async function init() {
    setLoading(true);
    try {
      // Request permissions upfront
      if (!permission?.granted) await requestPermission();
      if (!locationPermission?.granted) await requestLocationPermission();

      const [checkRes, photoRes] = await Promise.all([
        api.sessions.checklist(sessionId!),
        api.sessions.photos(sessionId!),
      ]);

      const items = checkRes.data.filter((item) => item.is_required || true).sort((a, b) => a.sort_order - b.sort_order);
      setChecklist(items);

      const existing = photoRes.data.filter((p) => p.photo_type === photoType);
      setUploadedPhotos(existing);

      // Find first item without a photo
      const coveredIds = new Set(existing.map((p) => p.checklist_item_id));
      const firstUncovered = items.findIndex((item) => !coveredIds.has(item.id));
      setCurrentIdx(firstUncovered === -1 ? items.length : firstUncovered);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to load checklist');
    } finally { setLoading(false); }
  }

  useEffect(() => { init(); }, [sessionId, photoType]);

  async function captureAndUpload() {
    if (!cameraRef.current) return;
    if (!permission?.granted) {
      Alert.alert('Camera permission required', 'Grant camera access in Settings.');
      return;
    }
    if (!locationPermission?.granted) {
      Alert.alert('Location required', 'GPS location is required for session photos. Grant location access in Settings.');
      return;
    }

    setCapturing(true); setGpsLoading(true); setErr('');

    let location: Location.LocationObject | null = null;
    try {
      location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeInterval: 1000,
      });
    } catch {
      setCapturing(false); setGpsLoading(false);
      setErr('Unable to get GPS location. Move to an area with better signal and try again.');
      return;
    } finally { setGpsLoading(false); }

    let photo;
    try {
      photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: false,
        exif: false,
      });
    } catch (e: unknown) {
      setCapturing(false);
      setErr('Failed to take photo: ' + (e instanceof Error ? e.message : 'unknown error'));
      return;
    }

    if (!photo) { setCapturing(false); return; }
    setPreview(photo.uri);
    setCapturing(false);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('photo', { uri: photo.uri, type: 'image/jpeg', name: `${photoType}_${currentItem.id}.jpg` } as unknown as Blob);
      formData.append('checklist_item_id', currentItem.id);
      formData.append('photo_type', photoType);
      formData.append('latitude', String(location.coords.latitude));
      formData.append('longitude', String(location.coords.longitude));
      formData.append('device_timestamp', new Date().toISOString());

      const res = await api.sessions.uploadPhoto(sessionId!, formData);
      setUploadedPhotos((prev) => [...prev, res.data]);
      setCurrentIdx((i) => i + 1);
      setPreview(null);
    } catch (e: unknown) {
      setErr('Upload failed: ' + (e instanceof Error ? e.message : 'unknown error'));
      setPreview(null);
    } finally { setUploading(false); }
  }

  function finish() {
    router.back();
  }

  if (loading) {
    return <View style={[S.screen, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator color={C.green} /></View>;
  }

  if (!permission?.granted) {
    return (
      <View style={[S.screen, S.center]}>
        <Text style={S.permTitle}>Camera access required</Text>
        <Text style={S.permSub}>ZombieTech needs camera access to take session photos.</Text>
        <TouchableOpacity style={S.permBtn} onPress={requestPermission}>
          <Text style={S.permBtnText}>Grant camera access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (allDone) {
    return (
      <View style={[S.screen, S.center]}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>✅</Text>
        <Text style={S.doneTitle}>All {photoType} photos captured!</Text>
        <Text style={S.doneSub}>{checklist.length} items documented with GPS timestamps.</Text>
        <TouchableOpacity style={S.doneBtn} onPress={finish}>
          <Text style={S.doneBtnText}>Done →</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const coveredIds = new Set(uploadedPhotos.map((p) => p.checklist_item_id));
  const typeLabel = photoType === 'before' ? 'Before' : photoType === 'after' ? 'After' : 'Lock-up';

  return (
    <View style={S.screen}>
      {/* Camera viewfinder */}
      <View style={S.cameraContainer}>
        <CameraView ref={cameraRef} style={S.camera} facing="back">
          {/* GPS indicator overlay */}
          <View style={S.gpsIndicator}>
            <Text style={S.gpsText}>{gpsLoading ? '📡 Getting GPS...' : locationPermission?.granted ? '📍 GPS ready' : '⚠️ No GPS'}</Text>
          </View>
          {/* Item label overlay */}
          <View style={S.itemOverlay}>
            <Text style={S.itemOverlayLabel}>{typeLabel} photo</Text>
            <Text style={S.itemOverlayName}>{currentItem?.area_name ?? '—'}</Text>
            <Text style={S.itemOverlayDesc}>{currentItem?.description ?? ''}</Text>
          </View>
        </CameraView>
      </View>

      {/* Error */}
      {err ? (
        <View style={S.errBox}>
          <Text style={S.errText}>{err}</Text>
        </View>
      ) : null}

      {/* Checklist strip */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={S.checklistStrip} contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}>
        {checklist.map((item, idx) => {
          const done = coveredIds.has(item.id);
          const active = idx === currentIdx;
          return (
            <View key={item.id} style={[S.checkChip, done && S.checkChipDone, active && S.checkChipActive]}>
              <Text style={[S.checkChipText, done && { color: C.greenLight }, active && { color: '#fff' }]}>
                {done ? '✓ ' : ''}{item.area_name}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      {/* Progress */}
      <View style={S.progress}>
        <Text style={S.progressText}>{Math.min(currentIdx, checklist.length)}/{checklist.length} captured</Text>
        <View style={S.progressBar}>
          <View style={[S.progressFill, { width: `${Math.min(currentIdx / checklist.length, 1) * 100}%` as `${number}%` }]} />
        </View>
      </View>

      {/* Capture button */}
      <View style={S.captureRow}>
        {uploading ? (
          <View style={[S.captureBtn, { backgroundColor: '#2a2a2a' }]}>
            <ActivityIndicator color={C.greenLight} />
          </View>
        ) : (
          <TouchableOpacity
            style={[S.captureBtn, capturing && { opacity: 0.5 }]}
            onPress={captureAndUpload}
            disabled={capturing || uploading}
          >
            <View style={S.captureBtnInner} />
          </TouchableOpacity>
        )}
      </View>

      {/* No-gallery warning */}
      <View style={S.noGalleryNotice}>
        <Text style={S.noGalleryText}>📷 In-app camera only · No gallery upload · GPS required</Text>
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  center: { justifyContent: 'center', alignItems: 'center', padding: 24 },
  cameraContainer: { width: SCREEN_W, height: SCREEN_W * 1.2 },
  camera: { flex: 1 },
  gpsIndicator: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  gpsText: { fontSize: 10, color: '#fff', fontWeight: '600' },
  itemOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.7)', padding: 12 },
  itemOverlayLabel: { fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  itemOverlayName: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 2 },
  itemOverlayDesc: { fontSize: 11, color: 'rgba(255,255,255,0.6)' },
  errBox: { backgroundColor: C.redBg, borderBottomWidth: 0.5, borderBottomColor: C.redBorder, padding: 10 },
  errText: { fontSize: 12, color: C.red, textAlign: 'center' },
  checklistStrip: { maxHeight: 52, backgroundColor: '#000', paddingVertical: 8 },
  checkChip: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#1a1a1a', borderWidth: 0.5, borderColor: '#333', justifyContent: 'center' },
  checkChipDone: { backgroundColor: C.greenBg, borderColor: C.greenBorder },
  checkChipActive: { borderColor: C.green, borderWidth: 1.5, backgroundColor: '#0d2e1e' },
  checkChipText: { fontSize: 10, color: C.textMuted, fontWeight: '500' },
  progress: { backgroundColor: '#111', paddingHorizontal: 16, paddingVertical: 8 },
  progressText: { fontSize: 10, color: C.textMuted, marginBottom: 4 },
  progressBar: { height: 3, borderRadius: 2, backgroundColor: '#222', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2, backgroundColor: C.green },
  captureRow: { height: 100, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  captureBtn: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#444' },
  captureBtnInner: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#fff' },
  noGalleryNotice: { backgroundColor: '#000', paddingVertical: 6, alignItems: 'center' },
  noGalleryText: { fontSize: 9, color: '#555', letterSpacing: 0.3 },
  permTitle: { fontSize: 20, fontWeight: '700', color: C.textPrimary, marginBottom: 8, textAlign: 'center' },
  permSub: { fontSize: 13, color: C.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  permBtn: { backgroundColor: C.green, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  permBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  doneTitle: { fontSize: 22, fontWeight: '700', color: C.textPrimary, marginBottom: 8, textAlign: 'center' },
  doneSub: { fontSize: 13, color: C.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  doneBtn: { backgroundColor: C.green, borderRadius: 12, paddingHorizontal: 32, paddingVertical: 14 },
  doneBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
