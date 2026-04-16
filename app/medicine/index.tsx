import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { requestCameraPermission, requestGalleryPermission } from '../../hooks/useMediaPermissions';
import {
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { getMedicineInfo, identifyMedicine, type MedicineInfoResult } from '../../services/ai';

type MedicineInfo = MedicineInfoResult & {
  nearbyStores: { name: string; distance: string; inStock: boolean }[];
};


export default function MedicineScreen() {
  const [mode, setMode] = useState<'home' | 'result'>('home');
  const [scannedImage, setScannedImage] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [medicine, setMedicine] = useState<MedicineInfo | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'sideeffects' | 'alternatives' | 'nearby'>('overview');

  async function loadMedicineInfo(info: MedicineInfoResult) {
    setMedicine({
      ...info,
      nearbyStores: [], // Nearby stores require a location/maps API — placeholder for now
    });
    setMode('result');
  }

  async function handleCamera() {
    if (!(await requestCameraPermission())) return;
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (!result.canceled) {
      setScannedImage(result.assets[0].uri);
      setAnalyzing(true);
      try {
        const info = await identifyMedicine(result.assets[0].uri);
        await loadMedicineInfo(info);
      } catch (e: any) {
        Alert.alert('Could not identify medicine', e.message ?? 'Try a clearer photo or search by name.');
      } finally {
        setAnalyzing(false);
      }
    }
  }

  async function handleGallery() {
    if (!(await requestGalleryPermission())) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (!result.canceled) {
      setScannedImage(result.assets[0].uri);
      setAnalyzing(true);
      try {
        const info = await identifyMedicine(result.assets[0].uri);
        await loadMedicineInfo(info);
      } catch (e: any) {
        Alert.alert('Could not identify medicine', e.message ?? 'Try a clearer photo or search by name.');
      } finally {
        setAnalyzing(false);
      }
    }
  }

  async function handleSearch() {
    if (!searchText.trim()) return;
    setAnalyzing(true);
    try {
      const info = await getMedicineInfo(searchText.trim());
      await loadMedicineInfo(info);
    } catch (e: any) {
      Alert.alert('Not found', e.message ?? 'Could not find medicine. Check the spelling and try again.');
    } finally {
      setAnalyzing(false);
    }
  }

  if (mode === 'home') {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.pageTitle}>🔍 Know Your Medicine</Text>
          <Text style={styles.pageSubtitle}>
            Scan or search a medicine to get detailed info — side effects, price, ingredients, and more.
          </Text>

          {/* Search */}
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search medicine name..."
              value={searchText}
              onChangeText={setSearchText}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
              <Text style={styles.searchBtnText}>Search</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.orDivider}>— OR —</Text>

          <TouchableOpacity style={styles.primaryBtn} onPress={handleCamera}>
            <Text style={styles.primaryBtnText}>📷  Scan Medicine Package</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={handleGallery}>
            <Text style={styles.secondaryBtnText}>🖼️  Pick from Gallery</Text>
          </TouchableOpacity>

          {analyzing && (
            <View style={styles.analyzing}>
              <Text style={styles.analyzingEmoji}>🔬</Text>
              <Text style={styles.analyzingText}>Identifying medicine...</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!medicine) return null;

  const TABS = ['overview', 'sideeffects', 'alternatives', 'nearby'] as const;
  const TAB_LABELS: Record<typeof TABS[number], string> = {
    overview: 'Overview',
    sideeffects: 'Side Effects',
    alternatives: 'Alternatives',
    nearby: 'Nearby',
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => setMode('home')} style={styles.back}>
          <Text style={styles.backText}>← Search again</Text>
        </TouchableOpacity>

        {/* Medicine Header */}
        <View style={styles.medicineHeader}>
          {scannedImage && (
            <Image source={{ uri: scannedImage }} style={styles.medicineImage} resizeMode="contain" />
          )}
          <View style={styles.medicineHeaderInfo}>
            <Text style={styles.medicineName}>{medicine.name}</Text>
            <Text style={styles.medicineGeneric}>{medicine.genericName}</Text>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{medicine.category}</Text>
            </View>
            <Text style={styles.price}>{medicine.price}</Text>
          </View>
        </View>

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
          <View style={styles.tabs}>
            {TABS.map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab && styles.tabActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {TAB_LABELS[tab]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.description}>{medicine.description}</Text>
            <Text style={styles.sectionTitle}>Ingredients</Text>
            {medicine.ingredients.map((ing, i) => (
              <View key={i} style={styles.listItem}>
                <Text style={styles.listDot}>•</Text>
                <Text style={styles.listText}>{ing}</Text>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'sideeffects' && (
          <View style={styles.tabContent}>
            <View style={styles.warningBanner}>
              <Text style={styles.warningText}>
                ⚠️ Side effects vary by individual. Consult your doctor if you experience any unusual symptoms.
              </Text>
            </View>
            {medicine.sideEffects.map((se, i) => (
              <View key={i} style={styles.sideEffectItem}>
                <Text style={styles.sideEffectText}>⚡ {se}</Text>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'alternatives' && (
          <View style={styles.tabContent}>
            <Text style={styles.altNote}>These medicines contain the same or similar active ingredient:</Text>
            {medicine.alternatives.map((alt, i) => (
              <View key={i} style={styles.altCard}>
                <Text style={styles.altName}>💊 {alt}</Text>
                <Text style={styles.altGeneric}>{medicine.genericName}</Text>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'nearby' && (
          <View style={styles.tabContent}>
            {medicine.nearbyStores.map((store, i) => (
              <TouchableOpacity
                key={i}
                style={styles.storeCard}
                onPress={() => Linking.openURL('https://maps.google.com/?q=' + encodeURIComponent(store.name))}
              >
                <View>
                  <Text style={styles.storeName}>🏪 {store.name}</Text>
                  <Text style={styles.storeDistance}>{store.distance} away</Text>
                </View>
                <View style={[styles.stockBadge, !store.inStock && styles.stockBadgeOut]}>
                  <Text style={[styles.stockText, !store.inStock && styles.stockTextOut]}>
                    {store.inStock ? 'In Stock' : 'Out of Stock'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 40 },
  back: { marginBottom: 16 },
  backText: { color: Colors.primary, fontSize: 15, fontWeight: '600' },
  pageTitle: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, marginBottom: 6 },
  pageSubtitle: { fontSize: 14, color: Colors.textSecondary, marginBottom: 24, lineHeight: 20 },
  searchRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  searchInput: {
    flex: 1,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 13,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  searchBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  searchBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
  orDivider: { textAlign: 'center', color: Colors.textMuted, fontSize: 13, marginVertical: 16 },
  primaryBtn: {
    backgroundColor: Colors.secondary,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  secondaryBtn: {
    backgroundColor: Colors.secondaryLight,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.secondary + '40',
  },
  secondaryBtnText: { color: Colors.secondary, fontSize: 16, fontWeight: '600' },
  analyzing: { alignItems: 'center', paddingVertical: 40 },
  analyzingEmoji: { fontSize: 48, marginBottom: 12 },
  analyzingText: { fontSize: 16, fontWeight: '600', color: Colors.textSecondary },
  medicineHeader: { marginBottom: 20 },
  medicineImage: {
    width: '100%',
    height: 160,
    borderRadius: 14,
    marginBottom: 14,
    backgroundColor: Colors.border,
  },
  medicineHeaderInfo: {},
  medicineName: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary },
  medicineGeneric: { fontSize: 14, color: Colors.textSecondary, marginTop: 2, marginBottom: 8 },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.secondaryLight,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
  },
  categoryText: { fontSize: 12, color: Colors.secondary, fontWeight: '600' },
  price: { fontSize: 16, fontWeight: '700', color: Colors.primary },
  tabScroll: { marginBottom: 16 },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabActive: { backgroundColor: Colors.secondary, borderColor: Colors.secondary },
  tabText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  tabTextActive: { color: Colors.white },
  tabContent: {},
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 10, marginTop: 8 },
  description: { fontSize: 14, color: Colors.textSecondary, lineHeight: 21 },
  listItem: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  listDot: { color: Colors.secondary, fontSize: 16, lineHeight: 22 },
  listText: { fontSize: 14, color: Colors.textSecondary, flex: 1, lineHeight: 22 },
  warningBanner: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 14,
  },
  warningText: { fontSize: 13, color: '#92400E', lineHeight: 18 },
  sideEffectItem: {
    backgroundColor: '#FFF1F2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FFE4E6',
  },
  sideEffectText: { fontSize: 14, color: '#9F1239', fontWeight: '500' },
  altNote: { fontSize: 13, color: Colors.textSecondary, marginBottom: 14 },
  altCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  altName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  altGeneric: { fontSize: 12, color: Colors.textMuted, marginTop: 3 },
  storeCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  storeName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  storeDistance: { fontSize: 12, color: Colors.textMuted, marginTop: 3 },
  stockBadge: {
    backgroundColor: Colors.secondaryLight,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.secondary + '40',
  },
  stockBadgeOut: { backgroundColor: '#FFF1F2', borderColor: '#FFE4E6' },
  stockText: { fontSize: 12, color: Colors.secondary, fontWeight: '600' },
  stockTextOut: { color: Colors.danger },
});
