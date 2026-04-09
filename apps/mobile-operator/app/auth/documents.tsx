/**
 * Document upload screen.
 * Uses expo-camera to photograph documents in-app.
 * No gallery picker — users photograph documents directly for authenticity.
 */
import { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { C } from '../../lib/colors';
import { api } from '../../lib/api';
import { Btn, ErrMsg } from '../../components/ui';

const REQUIRED_DOCS = [
  { key: 'id_document', label: 'SA ID / Passport', desc: 'Open ID book or ID card, well-lit', required: true },
  { key: 'proof_of_address', label: 'Proof of address', desc: 'Utility bill or bank statement (< 3 months)', required: true },
  { key: 'food_cert', label: 'Food handler certificate', desc: 'Valid food safety certificate', required: true },
  { key: 'insurance', label: 'Public liability insurance', desc: 'Policy document or cover note', required: false },
  { key: 'bank_statement', label: 'Bank statement', desc: 'Last 3 months, showing trading activity', required: false },
];

interface UploadedDoc { key: string; uploaded: boolean }

export default function DocumentsScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [uploads, setUploads] = useState<Record<string, UploadedDoc>>({});
  const [activeDock, setActiveDoc] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [err, setErr] = useState('');

  const requiredDone = REQUIRED_DOCS.filter((d) => d.required).every((d) => uploads[d.key]?.uploaded);

  async function openCamera(docKey: string) {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert('Camera required', 'Grant camera access to photograph your documents.');
        return;
      }
    }
    setActiveDoc(docKey);
    setCameraOpen(true);
    setErr('');
  }

  async function captureDocument() {
    if (!cameraRef.current || !activeDock) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      if (!photo) return;
      setCameraOpen(false);
      setUploading(activeDock);

      const formData = new FormData();
      formData.append('document_type', activeDock);
      formData.append('file', {
        uri: photo.uri,
        type: 'image/jpeg',
        name: `${activeDock}.jpg`,
      } as unknown as Blob);

      await api.documents.upload(formData);
      setUploads((u) => ({ ...u, [activeDock]: { key: activeDock, uploaded: true } }));
    } catch (e: unknown) {
      setCameraOpen(false);
      setErr(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setCapturing(false);
      setUploading(null);
      setActiveDoc(null);
    }
  }

  return (
    <>
      <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={S.container}>
        <Text style={S.title}>Upload your documents</Text>
        <Text style={S.subtitle}>
          We verify all operators before they can book a site. Tap each document to photograph it. Required items marked with *.
        </Text>

        <ErrMsg msg={err} />

        {REQUIRED_DOCS.map((doc) => {
          const uploaded = uploads[doc.key]?.uploaded;
          const isUploading = uploading === doc.key;
          return (
            <TouchableOpacity
              key={doc.key}
              style={[S.docCard, uploaded && S.docCardDone]}
              onPress={() => openCamera(doc.key)}
              disabled={isUploading || uploaded}
            >
              <View style={S.docHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[S.docLabel, uploaded && { color: C.greenLight }]}>
                    {doc.label}{doc.required ? ' *' : ''}
                  </Text>
                  <Text style={S.docDesc}>{doc.desc}</Text>
                </View>
                <View style={[S.docStatus, uploaded && S.docStatusDone]}>
                  <Text style={{ fontSize: 14, color: uploaded ? '#fff' : C.textMuted }}>
                    {isUploading ? '⏳' : uploaded ? '✓' : '📷'}
                  </Text>
                </View>
              </View>
              {uploaded && (
                <Text style={S.uploadedLabel}>✓ Captured and uploaded</Text>
              )}
            </TouchableOpacity>
          );
        })}

        <View style={S.infoBox}>
          <Text style={S.infoText}>
            Documents are encrypted and stored securely. Used for FICA compliance and vetting only.
          </Text>
        </View>

        <Btn
          label={requiredDone ? 'Submit for vetting →' : 'Photograph all required documents first'}
          onPress={() => router.replace('/auth/vetting')}
          disabled={!requiredDone}
          style={{ marginTop: 8 }}
        />

        <TouchableOpacity onPress={() => router.replace('/auth/vetting')} style={{ alignItems: 'center', marginTop: 12 }}>
          <Text style={{ color: C.textMuted, fontSize: 12 }}>Skip for now (upload later in profile)</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Camera modal */}
      <Modal visible={cameraOpen} animationType="slide" statusBarTranslucent>
        <View style={S.cameraModal}>
          <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back">
            <View style={S.cameraHeader}>
              <Text style={S.cameraTitle}>
                {REQUIRED_DOCS.find((d) => d.key === activeDock)?.label ?? 'Document'}
              </Text>
              <Text style={S.cameraSub}>Position the document flat and well-lit</Text>
            </View>
            {/* Document frame guide */}
            <View style={S.docFrame} />
          </CameraView>

          <View style={S.cameraControls}>
            <TouchableOpacity style={S.cancelBtn} onPress={() => { setCameraOpen(false); setActiveDoc(null); }}>
              <Text style={S.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[S.captureBtn, capturing && { opacity: 0.5 }]}
              onPress={captureDocument}
              disabled={capturing}
            >
              <View style={S.captureBtnInner} />
            </TouchableOpacity>
            <View style={{ width: 60 }} />
          </View>
        </View>
      </Modal>
    </>
  );
}

const S = StyleSheet.create({
  container: { padding: 20 },
  title: { fontSize: 22, fontWeight: '700', color: C.textPrimary, marginBottom: 8 },
  subtitle: { fontSize: 13, color: C.textMuted, lineHeight: 20, marginBottom: 20 },
  docCard: {
    backgroundColor: C.card, borderRadius: 12, padding: 14,
    borderWidth: 1.5, borderColor: C.border, borderStyle: 'dashed', marginBottom: 10,
  },
  docCardDone: { borderStyle: 'solid', borderColor: C.greenBorder, backgroundColor: C.greenBg },
  docHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  docLabel: { fontSize: 13, fontWeight: '600', color: C.textSec, marginBottom: 2 },
  docDesc: { fontSize: 11, color: C.textMuted },
  docStatus: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#1e1e1e', alignItems: 'center', justifyContent: 'center',
  },
  docStatusDone: { backgroundColor: C.green },
  uploadedLabel: { fontSize: 10, color: C.greenLight, marginTop: 6 },
  infoBox: {
    backgroundColor: C.blueBg, borderRadius: 10, padding: 12,
    marginVertical: 16, borderWidth: 0.5, borderColor: C.blueBorder,
  },
  infoText: { fontSize: 11, color: C.blueLight, lineHeight: 18 },
  // Camera modal
  cameraModal: { flex: 1, backgroundColor: '#000' },
  cameraHeader: {
    position: 'absolute', top: 60, left: 0, right: 0, zIndex: 10,
    alignItems: 'center', paddingHorizontal: 20,
  },
  cameraTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 4 },
  cameraSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  docFrame: {
    position: 'absolute', top: '25%', left: '8%', right: '8%', bottom: '30%',
    borderWidth: 2, borderColor: C.green, borderRadius: 8,
  },
  cameraControls: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 120, backgroundColor: 'rgba(0,0,0,0.7)',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  captureBtn: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#555',
  },
  captureBtnInner: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#fff' },
  cancelBtn: { width: 60, alignItems: 'center' },
  cancelBtnText: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
});
