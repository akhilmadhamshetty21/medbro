import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';

const features = [
  {
    emoji: '💊',
    title: 'Prescription',
    subtitle: 'Scan or manually enter your prescriptions and auto-generate a medicine schedule.',
    route: '/prescription' as const,
    bg: Colors.primaryLight,
    accent: Colors.primary,
  },
  {
    emoji: '🔍',
    title: 'Know Your Medicine',
    subtitle: 'Scan a medicine to get side effects, price, ingredients, and nearby availability.',
    route: '/medicine' as const,
    bg: Colors.secondaryLight,
    accent: Colors.secondary,
  },
  {
    emoji: '🤖',
    title: 'Talk to AI',
    subtitle: 'Ask any health or medicine question. Get guidance and know when to see a doctor.',
    route: '/chat' as const,
    bg: '#FFF7ED',
    accent: Colors.accent,
  },
];

export default function HomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good day 👋</Text>
            <Text style={styles.title}>Welcome to Medbro</Text>
            <Text style={styles.subtitle}>Your AI-powered medicine companion</Text>
          </View>
        </View>

        {/* Feature Cards */}
        <Text style={styles.sectionLabel}>WHAT WOULD YOU LIKE TO DO?</Text>
        {features.map((f) => (
          <TouchableOpacity
            key={f.title}
            style={[styles.card, { backgroundColor: f.bg, borderColor: f.accent + '40' }]}
            onPress={() => router.push(f.route)}
            activeOpacity={0.85}
          >
            <View style={styles.cardRow}>
              <View style={[styles.iconCircle, { backgroundColor: f.accent + '20' }]}>
                <Text style={styles.icon}>{f.emoji}</Text>
              </View>
              <View style={styles.cardText}>
                <Text style={[styles.cardTitle, { color: f.accent }]}>{f.title}</Text>
                <Text style={styles.cardSubtitle}>{f.subtitle}</Text>
              </View>
              <Text style={[styles.arrow, { color: f.accent }]}>›</Text>
            </View>
          </TouchableOpacity>
        ))}

        {/* Disclaimer */}
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            ⚠️ Medbro is an informational tool only. Always consult a qualified healthcare professional for medical decisions.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 32 },
  header: {
    marginBottom: 28,
    marginTop: 8,
  },
  greeting: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 26 },
  cardText: { flex: 1 },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  arrow: {
    fontSize: 28,
    fontWeight: '300',
    marginLeft: 4,
  },
  disclaimer: {
    marginTop: 16,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  disclaimerText: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 17,
  },
});
