import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { requestCameraPermission, requestGalleryPermission } from '../../hooks/useMediaPermissions';
import { analyzePrescription } from '../../services/ai';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { usePrescriptions, type Medicine } from '../../hooks/usePrescriptions';

const FREQUENCIES = ['Once daily', 'Twice daily', 'Thrice daily', 'Every 6 hours', 'As needed'];

type Mode = 'list' | 'detail' | 'scan' | 'manual';

export default function PrescriptionScreen() {
  const {
    prescriptions,
    loading,
    addPrescription,
    addMedicineToPrescription,
    removeMedicine,
    deletePrescription,
  } = usePrescriptions();

  const [mode, setMode] = useState<Mode>('list');
  const [activePrescriptionId, setActivePrescriptionId] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [manualEntry, setManualEntry] = useState<Omit<Medicine, 'id'>>({
    medicine: '',
    dosage: '',
    frequency: FREQUENCIES[0],
    times: 'Morning',
    duration: '7 days',
  });

  // Always derive detail from live prescriptions state using the ID
  const detail = prescriptions.find((p) => p.id === activePrescriptionId) ?? null;

  // ─── Scan ──────────────────────────────────────────────────────────────────

  async function handleScanPrescription() {
    if (!(await requestCameraPermission())) return;
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (!result.canceled) await runAnalysis(result.assets[0].uri);
  }

  async function handlePickFromGallery() {
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
      setActivePrescriptionId(saved.id);
      setMode('detail');
    } catch (e: any) {
      Alert.alert('Analysis Failed', e.message ?? 'Could not read prescription. Try a clearer photo or enter manually.');
    } finally {
      setAnalyzing(false);
    }
  }

  // ─── Manual ────────────────────────────────────────────────────────────────

  async function handleAddManual() {
    if (!manualEntry.medicine.trim()) {
      Alert.alert('Required', 'Please enter the medicine name.');
      return;
    }
    const medicine: Medicine = { ...manualEntry, id: Date.now().toString() };

    if (activePrescriptionId) {
      await addMedicineToPrescription(activePrescriptionId, medicine);
    } else {
      const saved = await addPrescription([medicine]);
      setActivePrescriptionId(saved.id);
    }

    setManualEntry({ medicine: '', dosage: '', frequency: FREQUENCIES[0], times: 'Morning', duration: '7 days' });
    setMode('detail');
  }

  async function handleDelete(id: string) {
    Alert.alert('Delete Prescription', 'Are you sure you want to delete this prescription?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await deletePrescription(id);
          setActivePrescriptionId(null);
          setMode('list');
        },
      },
    ]);
  }

  // ─── List View ─────────────────────────────────────────────────────────────

  if (mode === 'list') {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.pageTitle}>💊 Prescriptions</Text>
          <Text style={styles.pageSubtitle}>Your saved prescriptions and medicine schedules.</Text>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: Colors.primary }]}
              onPress={() => { setActivePrescriptionId(null); setMode('scan'); }}
            >
              <Text style={styles.actionBtnText}>📷  Scan</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: Colors.primaryLight, borderWidth: 1, borderColor: Colors.primary + '40' }]}
              onPress={() => { setActivePrescriptionId(null); setMode('manual'); }}
            >
              <Text style={[styles.actionBtnText, { color: Colors.primary }]}>✏️  Manual</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <Text style={styles.emptyText}>Loading...</Text>
          ) : prescriptions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>📋</Text>
              <Text style={styles.emptyTitle}>No prescriptions yet</Text>
              <Text style={styles.emptyText}>Scan or manually add your first prescription to get started.</Text>
            </View>
          ) : (
            prescriptions.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={styles.prescriptionCard}
                onPress={() => { setActivePrescriptionId(p.id); setMode('detail'); }}
                activeOpacity={0.8}
              >
                <View style={styles.prescriptionCardRow}>
                  {p.imageUri ? (
                    <Image source={{ uri: p.imageUri }} style={styles.prescriptionThumb} />
                  ) : (
                    <View style={[styles.prescriptionThumb, styles.prescriptionThumbPlaceholder]}>
                      <Text style={{ fontSize: 22 }}>📋</Text>
                    </View>
                  )}
                  <View style={styles.prescriptionCardInfo}>
                    <Text style={styles.prescriptionCardTitle} numberOfLines={1}>{p.label}</Text>
                    <Text style={styles.prescriptionCardDate}>
                      {new Date(p.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </Text>
                    <Text style={styles.prescriptionCardCount}>
                      {p.medicines.length} medicine{p.medicines.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Scan View ─────────────────────────────────────────────────────────────

  if (mode === 'scan') {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content}>
          <TouchableOpacity onPress={() => setMode('list')} style={styles.back}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.pageTitle}>📷 Scan Prescription</Text>

          {analyzing ? (
            <View style={styles.analyzing}>
              <Text style={styles.analyzingEmoji}>🔬</Text>
              <Text style={styles.analyzingText}>Analyzing prescription...</Text>
              <Text style={styles.analyzingSubText}>AI is reading your prescription</Text>
            </View>
          ) : (
            <>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleScanPrescription}>
                <Text style={styles.primaryBtnText}>📷  Open Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={handlePickFromGallery}>
                <Text style={styles.secondaryBtnText}>🖼️  Choose from Gallery</Text>
              </TouchableOpacity>
              <View style={styles.infoBox}>
                <Text style={styles.infoText}>📸 AI will automatically extract medicines, dosages, and create a schedule from your prescription photo.</Text>
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Manual Entry View ─────────────────────────────────────────────────────

  if (mode === 'manual') {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content}>
          <TouchableOpacity onPress={() => setMode(activePrescriptionId ? 'detail' : 'list')} style={styles.back}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.pageTitle}>✏️ Add Medicine</Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Medicine Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Paracetamol"
              value={manualEntry.medicine}
              onChangeText={(v) => setManualEntry((p) => ({ ...p, medicine: v }))}
            />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Dosage</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 500mg"
              value={manualEntry.dosage}
              onChangeText={(v) => setManualEntry((p) => ({ ...p, dosage: v }))}
            />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Frequency</Text>
            <View style={styles.chips}>
              {FREQUENCIES.map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.chip, manualEntry.frequency === f && styles.chipActive]}
                  onPress={() => setManualEntry((p) => ({ ...p, frequency: f }))}
                >
                  <Text style={[styles.chipText, manualEntry.frequency === f && styles.chipTextActive]}>{f}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>When to take</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. After meals / Morning"
              value={manualEntry.times}
              onChangeText={(v) => setManualEntry((p) => ({ ...p, times: v }))}
            />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Duration</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 7 days"
              value={manualEntry.duration}
              onChangeText={(v) => setManualEntry((p) => ({ ...p, duration: v }))}
            />
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={handleAddManual}>
            <Text style={styles.primaryBtnText}>✅  Save Medicine</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Detail View ───────────────────────────────────────────────────────────

  if (!detail) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.content}>
          <TouchableOpacity onPress={() => setMode('list')} style={styles.back}>
            <Text style={styles.backText}>← All Prescriptions</Text>
          </TouchableOpacity>
          <Text style={styles.emptyText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => setMode('list')} style={styles.back}>
          <Text style={styles.backText}>← All Prescriptions</Text>
        </TouchableOpacity>

        <View style={styles.detailHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.pageTitle}>{detail.label}</Text>
            <Text style={styles.detailDate}>
              {new Date(detail.createdAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </Text>
          </View>
          <TouchableOpacity onPress={() => handleDelete(detail.id)} style={styles.deleteBtn}>
            <Text style={styles.deleteBtnText}>🗑️</Text>
          </TouchableOpacity>
        </View>

        {detail.imageUri && (
          <Image source={{ uri: detail.imageUri }} style={styles.prescriptionImage} resizeMode="contain" />
        )}

        <View style={styles.reminderRow}>
          <Text style={styles.reminderLabel}>Enable reminders</Text>
          <Switch
            value={remindersEnabled}
            onValueChange={setRemindersEnabled}
            trackColor={{ false: Colors.border, true: Colors.primary }}
            thumbColor={Colors.white}
          />
        </View>

        {detail.medicines.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No medicines added yet. Tap below to add one.</Text>
          </View>
        ) : (
          detail.medicines.map((entry) => (
            <View key={entry.id} style={styles.scheduleCard}>
              <View style={styles.scheduleHeader}>
                <Text style={styles.medicineName}>💊 {entry.medicine}</Text>
                <TouchableOpacity onPress={() => removeMedicine(detail.id, entry.id)}>
                  <Text style={styles.removeBtn}>✕</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.scheduleDetails}>
                <SchedulePill label="Dosage" value={entry.dosage} />
                <SchedulePill label="Frequency" value={entry.frequency} />
                <SchedulePill label="When" value={entry.times} />
                <SchedulePill label="Duration" value={entry.duration} />
              </View>
            </View>
          ))
        )}

        <TouchableOpacity style={styles.secondaryBtn} onPress={() => setMode('manual')}>
          <Text style={styles.secondaryBtnText}>+ Add Medicine</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function SchedulePill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillLabel}>{label}</Text>
      <Text style={styles.pillValue}>{value || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 40 },
  back: { marginBottom: 16 },
  backText: { color: Colors.primary, fontSize: 15, fontWeight: '600' },
  pageTitle: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  pageSubtitle: { fontSize: 14, color: Colors.textSecondary, marginBottom: 20, lineHeight: 20 },
  actionRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  actionBtn: { flex: 1, borderRadius: 14, padding: 15, alignItems: 'center' },
  actionBtnText: { color: Colors.white, fontSize: 15, fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6 },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  prescriptionCard: {
    backgroundColor: Colors.white, borderRadius: 16, padding: 14,
    marginBottom: 12, borderWidth: 1, borderColor: Colors.border,
  },
  prescriptionCardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  prescriptionThumb: { width: 56, height: 56, borderRadius: 10, backgroundColor: Colors.border },
  prescriptionThumbPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primaryLight },
  prescriptionCardInfo: { flex: 1 },
  prescriptionCardTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  prescriptionCardDate: { fontSize: 12, color: Colors.textMuted, marginBottom: 2 },
  prescriptionCardCount: { fontSize: 12, color: Colors.primary, fontWeight: '600' },
  chevron: { fontSize: 24, color: Colors.textMuted },
  detailHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  detailDate: { fontSize: 13, color: Colors.textMuted, marginBottom: 4 },
  deleteBtn: { padding: 6 },
  deleteBtnText: { fontSize: 20 },
  primaryBtn: { backgroundColor: Colors.primary, borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 12 },
  primaryBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  secondaryBtn: { backgroundColor: Colors.primaryLight, borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: Colors.primary + '40' },
  secondaryBtnText: { color: Colors.primary, fontSize: 16, fontWeight: '600' },
  infoBox: { marginTop: 8, backgroundColor: Colors.primaryLight, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.primary + '30' },
  infoText: { fontSize: 13, color: Colors.primary, lineHeight: 19 },
  analyzing: { alignItems: 'center', paddingVertical: 60 },
  analyzingEmoji: { fontSize: 56, marginBottom: 16 },
  analyzingText: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  analyzingSubText: { fontSize: 13, color: Colors.textSecondary, marginTop: 6 },
  prescriptionImage: { width: '100%', height: 180, borderRadius: 14, marginBottom: 16, backgroundColor: Colors.border },
  reminderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.white, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  reminderLabel: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  formGroup: { marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 14, fontSize: 15, color: Colors.textPrimary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  chipTextActive: { color: Colors.white, fontWeight: '700' },
  scheduleCard: { backgroundColor: Colors.white, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  scheduleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  medicineName: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  removeBtn: { fontSize: 16, color: Colors.danger, fontWeight: '600', padding: 4 },
  scheduleDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { backgroundColor: Colors.primaryLight, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  pillLabel: { fontSize: 10, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  pillValue: { fontSize: 13, color: Colors.primary, fontWeight: '600', marginTop: 1 },
});
