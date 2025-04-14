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
          <View style={[styles.iconContainer, { backgroundColor: '#4c669f15' }]}>
            <MaterialCommunityIcons name="plus-circle-outline" size={40} color="#4c669f" />
          </View>
          <ThemedText style={styles.cardTitle}>
            Yeni Seyahat Planı Oluştur
          </ThemedText>
          <ThemedText style={styles.cardDescription}>
            Tercihlerinize göre özelleştirilmiş, detaylı bir seyahat planı oluşturun.
            AI asistanımız size en uygun rotayı belirlemede yardımcı olacak.
          </ThemedText>
          <TouchableOpacity style={styles.cardButton}>
            <ThemedText style={styles.cardButtonText}>Başla</ThemedText>
            <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
          </TouchableOpacity>
        </TouchableOpacity>

        <View style={styles.featuresContainer}>
          <ThemedText style={styles.featuresTitle}>Özellikler</ThemedText>
          
          <View style={styles.featuresList}>
            <View style={styles.featureItem}>
              <View style={[styles.featureIcon, { backgroundColor: '#4c669f15' }]}>
                <MaterialCommunityIcons name="clock-outline" size={24} color="#4c669f" />
              </View>
              <ThemedText style={styles.featureText}>
                Hızlı Plan Oluşturma
              </ThemedText>
            </View>
            
            <View style={styles.featureItem}>
              <View style={[styles.featureIcon, { backgroundColor: '#3b599815' }]}>
                <MaterialCommunityIcons name="map-marker-outline" size={24} color="#3b5998" />
              </View>
              <ThemedText style={styles.featureText}>
                Popüler Noktalar
              </ThemedText>
            </View>
            
            <View style={styles.featureItem}>
              <View style={[styles.featureIcon, { backgroundColor: '#192f6a15' }]}>
                <MaterialCommunityIcons name="food" size={24} color="#192f6a" />
              </View>
              <ThemedText style={styles.featureText}>
                Restoran Önerileri
              </ThemedText>
            </View>
            
            <View style={styles.featureItem}>
              <View style={[styles.featureIcon, { backgroundColor: '#4c669f15' }]}>
                <MaterialCommunityIcons name="bed" size={24} color="#4c669f" />
              </View>
              <ThemedText style={styles.featureText}>
                Konaklama Seçenekleri
              </ThemedText>
            </View>
          </View>
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
    paddingTop: Platform.OS === 'ios' ? 20 : 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    fontFamily: 'SpaceMono',
  },
  subtitle: {
    fontSize: 15,
    color: '#999',
    fontFamily: 'SpaceMono',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  card: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
    fontFamily: 'SpaceMono',
  },
  cardDescription: {
    fontSize: 14,
    color: '#999',
    marginBottom: 20,
    lineHeight: 20,
    fontFamily: 'SpaceMono',
  },
  cardButton: {
    backgroundColor: '#111',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
    borderRadius: 16,
    padding: 20,
  },
  featuresTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 20,
    fontFamily: 'SpaceMono',
  },
  featuresList: {
    gap: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    fontSize: 14,
    color: '#fff',
    fontFamily: 'SpaceMono',
  },
}); 