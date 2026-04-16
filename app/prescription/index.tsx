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

interface ScheduleEntry {
  id: string;
  medicine: string;
  dosage: string;
  frequency: string;
  times: string;
  duration: string;
}

const FREQUENCIES = ['Once daily', 'Twice daily', 'Thrice daily', 'Every 6 hours', 'As needed'];

export default function PrescriptionScreen() {
  const [mode, setMode] = useState<'home' | 'scan' | 'manual' | 'schedule'>('home');
  const [scannedImage, setScannedImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [remindersEnabled, setRemindersEnabled] = useState(false);

  // Manual entry state
  const [manualEntry, setManualEntry] = useState<Omit<ScheduleEntry, 'id'>>({
    medicine: '',
    dosage: '',
    frequency: FREQUENCIES[0],
    times: 'Morning',
    duration: '7 days',
  });

  async function handleScanPrescription() {
    if (!(await requestCameraPermission())) return;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (!result.canceled) {
      await runPrescriptionAnalysis(result.assets[0].uri);
    }
  }

  async function handlePickFromGallery() {
    if (!(await requestGalleryPermission())) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (!result.canceled) {
      await runPrescriptionAnalysis(result.assets[0].uri);
    }
  }

  async function runPrescriptionAnalysis(uri: string) {
    setScannedImage(uri);
    setAnalyzing(true);
    try {
      const result = await analyzePrescription(uri);
      setSchedule(
        result.medicines.map((m, i) => ({
          id: String(Date.now() + i),
          medicine: m.name,
          dosage: m.dosage,
          frequency: m.frequency,
          times: m.instructions,
          duration: m.duration,
        }))
      );
      setMode('schedule');
    } catch (e: any) {
      Alert.alert('Analysis Failed', e.message ?? 'Could not read prescription. Please try a clearer photo or enter manually.');
    } finally {
      setAnalyzing(false);
    }
  }

  function handleAddManual() {
    if (!manualEntry.medicine.trim()) {
      Alert.alert('Required', 'Please enter the medicine name.');
      return;
    }
    setSchedule((prev) => [...prev, { ...manualEntry, id: Date.now().toString() }]);
    setManualEntry({ medicine: '', dosage: '', frequency: FREQUENCIES[0], times: 'Morning', duration: '7 days' });
    Alert.alert('Added', `${manualEntry.medicine} added to your schedule.`);
  }

  function removeEntry(id: string) {
    setSchedule((prev) => prev.filter((e) => e.id !== id));
  }

  if (mode === 'home') {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.pageTitle}>💊 Prescription</Text>
          <Text style={styles.pageSubtitle}>Add your doctor's prescription and we'll build your medicine schedule.</Text>

          <TouchableOpacity style={styles.primaryBtn} onPress={() => setMode('scan')}>
            <Text style={styles.primaryBtnText}>📷  Scan Prescription</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={() => setMode('manual')}>
            <Text style={styles.secondaryBtnText}>✏️  Enter Manually</Text>
          </TouchableOpacity>

          {schedule.length > 0 && (
            <TouchableOpacity style={styles.outlineBtn} onPress={() => setMode('schedule')}>
              <Text style={styles.outlineBtnText}>📋  View My Schedule ({schedule.length})</Text>
            </TouchableOpacity>
          )}

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              📸 Scan your prescription and our AI will automatically extract medicine names, dosages, and create a personalized schedule for you.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (mode === 'scan') {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content}>
          <TouchableOpacity onPress={() => setMode('home')} style={styles.back}>
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
              {scannedImage && (
                <Image source={{ uri: scannedImage }} style={styles.prescriptionImage} resizeMode="contain" />
              )}
              <TouchableOpacity style={styles.primaryBtn} onPress={handleScanPrescription}>
                <Text style={styles.primaryBtnText}>📷  Open Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={handlePickFromGallery}>
                <Text style={styles.secondaryBtnText}>🖼️  Choose from Gallery</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (mode === 'manual') {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content}>
          <TouchableOpacity onPress={() => setMode('home')} style={styles.back}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.pageTitle}>✏️ Manual Entry</Text>

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
            <Text style={styles.primaryBtnText}>✅  Add to Schedule</Text>
          </TouchableOpacity>

          {schedule.length > 0 && (
            <TouchableOpacity style={styles.outlineBtn} onPress={() => setMode('schedule')}>
              <Text style={styles.outlineBtnText}>📋  View Schedule ({schedule.length})</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Schedule view
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => setMode('home')} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.pageTitle}>📋 My Schedule</Text>

        <View style={styles.reminderRow}>
          <Text style={styles.reminderLabel}>Enable reminders</Text>
          <Switch
            value={remindersEnabled}
            onValueChange={setRemindersEnabled}
            trackColor={{ false: Colors.border, true: Colors.primary }}
            thumbColor={Colors.white}
          />
        </View>

        {schedule.map((entry) => (
          <View key={entry.id} style={styles.scheduleCard}>
            <View style={styles.scheduleHeader}>
              <Text style={styles.medicineName}>💊 {entry.medicine}</Text>
              <TouchableOpacity onPress={() => removeEntry(entry.id)}>
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
        ))}

        <TouchableOpacity style={styles.secondaryBtn} onPress={() => setMode('manual')}>
          <Text style={styles.secondaryBtnText}>+ Add Another Medicine</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function SchedulePill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillLabel}>{label}</Text>
      <Text style={styles.pillValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 40 },
  back: { marginBottom: 16 },
  backText: { color: Colors.primary, fontSize: 15, fontWeight: '600' },
  pageTitle: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, marginBottom: 6 },
  pageSubtitle: { fontSize: 14, color: Colors.textSecondary, marginBottom: 28, lineHeight: 20 },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  secondaryBtn: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.primary + '40',
  },
  secondaryBtnText: { color: Colors.primary, fontSize: 16, fontWeight: '600' },
  outlineBtn: {
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  outlineBtnText: { color: Colors.textSecondary, fontSize: 15, fontWeight: '600' },
  infoBox: {
    marginTop: 16,
    backgroundColor: Colors.primaryLight,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  infoText: { fontSize: 13, color: Colors.primary, lineHeight: 19 },
  analyzing: { alignItems: 'center', paddingVertical: 60 },
  analyzingEmoji: { fontSize: 56, marginBottom: 16 },
  analyzingText: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  analyzingSubText: { fontSize: 13, color: Colors.textSecondary, marginTop: 6 },
  prescriptionImage: {
    width: '100%',
    height: 200,
    borderRadius: 14,
    marginBottom: 16,
    backgroundColor: Colors.border,
  },
  formGroup: { marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  chipTextActive: { color: Colors.white, fontWeight: '700' },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  reminderLabel: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  scheduleCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  scheduleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  medicineName: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  removeBtn: { fontSize: 16, color: Colors.danger, fontWeight: '600', padding: 4 },
  scheduleDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pillLabel: { fontSize: 10, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  pillValue: { fontSize: 13, color: Colors.primary, fontWeight: '600', marginTop: 1 },
});
