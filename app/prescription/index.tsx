import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { requestCameraPermission, requestGalleryPermission } from '../../hooks/useMediaPermissions';
import { analyzePrescription } from '../../services/ai';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { usePrescriptions, type Medicine } from '../../hooks/usePrescriptions';

const FREQUENCIES = ['Once daily', 'Twice daily', 'Thrice daily', 'Every 6 hours', 'As needed'];

const EMPTY_FORM = { medicine: '', dosage: '', frequency: FREQUENCIES[0], times: 'Morning', duration: '7 days' };

export default function PrescriptionScreen() {
  const { prescriptions, loading, addPrescription, addMedicineToPrescription, removeMedicine, deletePrescription } = usePrescriptions();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [addingToId, setAddingToId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [formError, setFormError] = useState('');

  function openNewForm() {
    setAddingToId(null);
    setFormData({ ...EMPTY_FORM });
    setFormError('');
    setFormVisible(true);
  }

  function openAddToForm(prescriptionId: string) {
    setAddingToId(prescriptionId);
    setFormData({ ...EMPTY_FORM });
    setFormError('');
    setFormVisible(true);
  }

  function closeForm() {
    setFormVisible(false);
    setFormError('');
  }

  async function handleSave() {
    if (!formData.medicine.trim()) {
      setFormError('Medicine name is required.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const medicine: Medicine = { ...formData, id: Date.now().toString() };
      if (addingToId) {
        await addMedicineToPrescription(addingToId, medicine);
        setExpandedId(addingToId);
      } else {
        const saved = await addPrescription([medicine]);
        setExpandedId(saved.id);
      }
      setFormData({ ...EMPTY_FORM });
      setFormVisible(false);
    } catch (e: any) {
      setFormError(e?.message ?? 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleScan() {
    if (!(await requestCameraPermission())) return;
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (!result.canceled) await runAnalysis(result.assets[0].uri);
  }

  async function handleGallery() {
    if (!(await requestGalleryPermission())) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (!result.canceled) await runAnalysis(result.assets[0].uri);
  }

  async function runAnalysis(uri: string) {
    setAnalyzing(true);
    try {
      const result = await analyzePrescription(uri);
      const medicines: Medicine[] = result.medicines.map((m, i) => ({
        id: String(Date.now() + i),
        medicine: m.name,
        dosage: m.dosage,
        frequency: m.frequency,
        times: m.instructions,
        duration: m.duration,
      }));
      const saved = await addPrescription(medicines, uri);
      setExpandedId(saved.id);
    } catch {
      // AI analysis failed — still save the image so the user can add medicines manually
      const saved = await addPrescription([], uri);
      setExpandedId(saved.id);
      setAddingToId(saved.id);
      setFormVisible(true);
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleDelete(id: string) {
    Alert.alert('Delete', 'Delete this prescription?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await deletePrescription(id);
          if (expandedId === id) setExpandedId(null);
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.pageTitle}>💊 Prescriptions</Text>
        <Text style={styles.pageSubtitle}>Scan or manually add your prescriptions.</Text>

        {/* ── Scan buttons ── */}
        {analyzing ? (
          <View style={styles.analyzingBox}>
            <ActivityIndicator color={Colors.primary} size="large" />
            <Text style={styles.analyzingText}>Analyzing prescription...</Text>
          </View>
        ) : (
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.primary }]} onPress={handleScan}>
              <Text style={styles.actionBtnText}>📷  Scan</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.primaryLight, borderWidth: 1, borderColor: Colors.primary + '40' }]} onPress={handleGallery}>
              <Text style={[styles.actionBtnText, { color: Colors.primary }]}>🖼️  Gallery</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Add Medicine form ── */}
        {formVisible ? (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>{addingToId ? '+ Add Medicine' : '✏️ New Prescription'}</Text>

            <Text style={styles.label}>Medicine Name *</Text>
            <TextInput
              style={[styles.input, formError ? styles.inputError : null]}
              placeholder="e.g. Paracetamol"
              value={formData.medicine}
              onChangeText={(v) => { setFormData((p) => ({ ...p, medicine: v })); setFormError(''); }}
              autoFocus
            />
            {formError ? <Text style={styles.errorText}>{formError}</Text> : null}

            <Text style={styles.label}>Dosage</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 500mg"
              value={formData.dosage}
              onChangeText={(v) => setFormData((p) => ({ ...p, dosage: v }))}
            />

            <Text style={styles.label}>Frequency</Text>
            <View style={styles.chips}>
              {FREQUENCIES.map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.chip, formData.frequency === f && styles.chipActive]}
                  onPress={() => setFormData((p) => ({ ...p, frequency: f }))}
                >
                  <Text style={[styles.chipText, formData.frequency === f && styles.chipTextActive]}>{f}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>When to take</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. After meals / Morning"
              value={formData.times}
              onChangeText={(v) => setFormData((p) => ({ ...p, times: v }))}
            />

            <Text style={styles.label}>Duration</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 7 days"
              value={formData.duration}
              onChangeText={(v) => setFormData((p) => ({ ...p, duration: v }))}
            />

            <View style={styles.formActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={closeForm} disabled={saving}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                {saving
                  ? <ActivityIndicator color={Colors.white} size="small" />
                  : <Text style={styles.saveBtnText}>✅  Save Medicine</Text>}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.addNewBtn} onPress={openNewForm}>
            <Text style={styles.addNewBtnText}>+ Add New Prescription</Text>
          </TouchableOpacity>
        )}

        {/* ── Prescription list ── */}
        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 32 }} />
        ) : prescriptions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyTitle}>No prescriptions yet</Text>
            <Text style={styles.emptyText}>Tap "Add New Prescription" or scan a photo to get started.</Text>
          </View>
        ) : (
          prescriptions.map((p) => {
            const expanded = expandedId === p.id;
            return (
              <View key={p.id} style={styles.prescriptionCard}>
                <TouchableOpacity
                  style={styles.cardHeader}
                  onPress={() => setExpandedId(expanded ? null : p.id)}
                  activeOpacity={0.7}
                >
                  {p.imageUri ? (
                    <Image source={{ uri: p.imageUri }} style={styles.thumb} />
                  ) : (
                    <View style={[styles.thumb, styles.thumbPlaceholder]}>
                      <Text style={{ fontSize: 20 }}>📋</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{p.label}</Text>
                    <Text style={styles.cardMeta}>
                      {new Date(p.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      {'  ·  '}{p.medicines.length} medicine{p.medicines.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <Text style={styles.chevron}>{expanded ? '∨' : '›'}</Text>
                </TouchableOpacity>

                {expanded && (
                  <View style={styles.cardBody}>
                    {p.medicines.length === 0 ? (
                      <Text style={styles.emptyText}>No medicines yet.</Text>
                    ) : (
                      p.medicines.map((m) => (
                        <View key={m.id} style={styles.medicineRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.medicineName}>💊 {m.medicine}</Text>
                            <Text style={styles.medicineMeta}>{m.dosage}  ·  {m.frequency}  ·  {m.times}  ·  {m.duration}</Text>
                          </View>
                          <TouchableOpacity onPress={() => removeMedicine(p.id, m.id)} style={styles.removeBtn}>
                            <Text style={styles.removeBtnText}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      ))
                    )}

                    {!(formVisible && addingToId === p.id) && (
                      <TouchableOpacity
                        style={styles.addMedicineBtn}
                        onPress={() => openAddToForm(p.id)}
                      >
                        <Text style={styles.addMedicineBtnText}>+ Add Medicine</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(p.id)}>
                      <Text style={styles.deleteBtnText}>🗑️  Delete Prescription</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 60 },
  pageTitle: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  pageSubtitle: { fontSize: 14, color: Colors.textSecondary, marginBottom: 20, lineHeight: 20 },
  actionRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  actionBtn: { flex: 1, borderRadius: 14, padding: 14, alignItems: 'center' },
  actionBtnText: { color: Colors.white, fontSize: 15, fontWeight: '700' },
  analyzingBox: { alignItems: 'center', paddingVertical: 24, gap: 12, marginBottom: 16 },
  analyzingText: { fontSize: 15, color: Colors.textSecondary },
  addNewBtn: {
    backgroundColor: Colors.primaryLight, borderRadius: 14, padding: 16,
    alignItems: 'center', marginBottom: 20,
    borderWidth: 1, borderColor: Colors.primary + '40', borderStyle: 'dashed',
  },
  addNewBtnText: { color: Colors.primary, fontSize: 15, fontWeight: '700' },
  formCard: {
    backgroundColor: Colors.white, borderRadius: 16, padding: 20,
    marginBottom: 20, borderWidth: 1, borderColor: Colors.border,
  },
  formTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, padding: 12, fontSize: 15, color: Colors.textPrimary, marginBottom: 14,
  },
  inputError: { borderColor: Colors.danger },
  errorText: { fontSize: 12, color: Colors.danger, marginTop: -10, marginBottom: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  chipTextActive: { color: Colors.white, fontWeight: '700' },
  formActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  cancelBtn: { flex: 1, borderRadius: 12, padding: 14, alignItems: 'center', backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border },
  cancelBtnText: { color: Colors.textSecondary, fontSize: 15, fontWeight: '600' },
  saveBtn: { flex: 2, borderRadius: 12, padding: 14, alignItems: 'center', backgroundColor: Colors.primary },
  saveBtnText: { color: Colors.white, fontSize: 15, fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6 },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  prescriptionCard: {
    backgroundColor: Colors.white, borderRadius: 16,
    marginBottom: 12, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  thumb: { width: 48, height: 48, borderRadius: 10, backgroundColor: Colors.border },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primaryLight },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  cardMeta: { fontSize: 12, color: Colors.textMuted },
  chevron: { fontSize: 20, color: Colors.textMuted, fontWeight: '600' },
  cardBody: { borderTopWidth: 1, borderTopColor: Colors.border, padding: 14, gap: 10 },
  medicineRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  medicineName: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary, marginBottom: 2 },
  medicineMeta: { fontSize: 12, color: Colors.textSecondary },
  removeBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  removeBtnText: { fontSize: 16, color: Colors.danger, fontWeight: '700' },
  addMedicineBtn: {
    borderRadius: 10, padding: 12, alignItems: 'center',
    backgroundColor: Colors.primaryLight, borderWidth: 1, borderColor: Colors.primary + '40',
  },
  addMedicineBtnText: { color: Colors.primary, fontSize: 14, fontWeight: '600' },
  deleteBtn: { alignItems: 'center', paddingVertical: 8 },
  deleteBtnText: { color: Colors.danger, fontSize: 13, fontWeight: '600' },
});
