import { StyleSheet, View, TouchableOpacity, Platform } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function AIPlannerScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedText style={styles.title}>AI Seyahat Planlayıcı</ThemedText>
        <ThemedText style={styles.subtitle}>
          Yapay zeka destekli kişiselleştirilmiş seyahat planları
        </ThemedText>
      </View>

      <View style={styles.content}>
        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push('/plan-trip')}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.iconContainer, { backgroundColor: '#4c669f20' }]}>
              <MaterialCommunityIcons name="plus-circle-outline" size={40} color="#4c669f" />
            </View>
            <ThemedText style={styles.cardTitle}>
              Yeni Seyahat Planı Oluştur
            </ThemedText>
          </View>

          <ThemedText style={styles.cardDescription}>
            Tercihlerinize göre özelleştirilmiş, detaylı bir seyahat planı oluşturun.
            AI asistanımız size en uygun rotayı belirlemede yardımcı olacak.
          </ThemedText>

          <TouchableOpacity
            style={styles.cardButton}
            onPress={() => router.push('/plan-trip')}
          >
            <ThemedText style={styles.cardButtonText}>Başla</ThemedText>
            <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
          </TouchableOpacity>
        </TouchableOpacity>

        <View style={styles.featuresContainer}>
          <ThemedText style={styles.featuresTitle}>Özellikler</ThemedText>

          <View style={styles.featuresList}>
            <View style={styles.featureRow}>
              <View style={styles.featureItem}>
                <View style={[styles.featureIcon, { backgroundColor: '#4c669f20' }]}>
                  <MaterialCommunityIcons name="clock-outline" size={24} color="#4c669f" />
                </View>
                <ThemedText style={styles.featureText}>
                  Hızlı Plan Oluşturma
                </ThemedText>
              </View>

              <View style={styles.featureItem}>
                <View style={[styles.featureIcon, { backgroundColor: '#3b599820' }]}>
                  <MaterialCommunityIcons name="map-marker-outline" size={24} color="#3b5998" />
                </View>
                <ThemedText style={styles.featureText}>
                  Popüler Noktalar
                </ThemedText>
              </View>
            </View>

            <View style={styles.featureRow}>
              <View style={styles.featureItem}>
                <View style={[styles.featureIcon, { backgroundColor: '#192f6a20' }]}>
                  <MaterialCommunityIcons name="food" size={24} color="#192f6a" />
                </View>
                <ThemedText style={styles.featureText}>
                  Restoran Önerileri
                </ThemedText>
              </View>

              <View style={styles.featureItem}>
                <View style={[styles.featureIcon, { backgroundColor: '#4c669f20' }]}>
                  <MaterialCommunityIcons name="bed" size={24} color="#4c669f" />
                </View>
                <ThemedText style={styles.featureText}>
                  Konaklama Seçenekleri
                </ThemedText>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.infoCard}>
          <MaterialCommunityIcons name="information-outline" size={24} color="#4c669f" />
          <ThemedText style={styles.infoText}>
            AI seyahat planlayıcımız, tercihlerinize göre özelleştirilmiş seyahat planları oluşturur.
            Daha fazla bilgi için yardım bölümünü ziyaret edin.
          </ThemedText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 30,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    fontFamily: 'SpaceMono',
  },
  subtitle: {
    fontSize: 16,
    color: '#999',
    fontFamily: 'SpaceMono',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  card: {
    backgroundColor: '#111',
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.1)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.3)',
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
    fontFamily: 'SpaceMono',
  },
  cardDescription: {
    fontSize: 14,
    color: '#999',
    marginBottom: 24,
    lineHeight: 22,
    fontFamily: 'SpaceMono',
  },
  cardButton: {
    backgroundColor: '#4c669f',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4c669f',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  cardButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
    fontFamily: 'SpaceMono',
  },
  featuresContainer: {
    backgroundColor: '#111',
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.1)',
  },
  featuresTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 20,
    fontFamily: 'SpaceMono',
  },
  featuresList: {
    gap: 20,
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  featureItem: {
    flexDirection: 'column',
    alignItems: 'center',
    width: '48%',
    backgroundColor: 'rgba(17, 17, 17, 0.6)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.1)',
  },
  featureIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.2)',
  },
  featureText: {
    fontSize: 14,
    color: '#fff',
    fontFamily: 'SpaceMono',
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: 'rgba(76, 102, 159, 0.1)',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.2)',
  },
  infoText: {
    fontSize: 14,
    color: '#ccc',
    fontFamily: 'SpaceMono',
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
});