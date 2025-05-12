import { StyleSheet, View, TouchableOpacity, Platform, ScrollView } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function AIPlannerScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedText style={styles.title}>Seyahat Planları</ThemedText>
        <ThemedText style={styles.subtitle}>
          Planlarınızı oluşturun veya mevcut planlarınızı görüntüleyin
        </ThemedText>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push('/plan-trip')}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.iconContainer, { backgroundColor: '#4c669f20' }]}>
              <MaterialCommunityIcons name="plus-circle-outline" size={40} color="#4c669f" />
            </View>
            <ThemedText style={styles.cardTitle}>
              Yeni Seyahat Planı
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

        <TouchableOpacity
          style={[styles.card, styles.secondaryCard]}
          onPress={() => router.push('/(tabs)/trip-details')}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.iconContainer, { backgroundColor: '#192f6a20' }]}>
              <MaterialCommunityIcons name="view-list-outline" size={40} color="#192f6a" />
            </View>
            <ThemedText style={styles.cardTitle}>
              Mevcut Planlarım
            </ThemedText>
          </View>

          <ThemedText style={styles.cardDescription}>
            Oluşturduğunuz tüm seyahat planlarınızı görüntüleyin, düzenleyin veya paylaşın.
          </ThemedText>

          <TouchableOpacity
            style={[styles.cardButton, styles.secondaryButton]}
            onPress={() => router.push('/(tabs)/trip-details')}
          >
            <ThemedText style={styles.cardButtonText}>Planları Görüntüle</ThemedText>
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
      </ScrollView>
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
    paddingTop: Platform.OS === 'ios' ? 70 : 40,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    fontFamily: 'SpaceMono',
    marginTop: 10,
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
  secondaryCard: {
    borderColor: 'rgba(25, 47, 106, 0.1)',
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
  secondaryButton: {
    backgroundColor: '#192f6a',
    shadowColor: '#192f6a',
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
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
    fontFamily: 'SpaceMono',
  },
  featuresList: {
    marginTop: 8,
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  featureItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.2)',
  },
  featureText: {
    fontSize: 14,
    color: '#ccc',
    flex: 1,
    fontFamily: 'SpaceMono',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(76, 102, 159, 0.05)',
    padding: 16,
    borderRadius: 16,
    alignItems: 'flex-start',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.1)',
  },
  infoText: {
    color: '#999',
    fontSize: 14,
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
    fontFamily: 'SpaceMono',
  },
});