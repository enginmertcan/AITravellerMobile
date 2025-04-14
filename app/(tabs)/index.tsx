import { StyleSheet, View, ScrollView, TouchableOpacity, Image, Dimensions, RefreshControl, Platform } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState, useCallback } from 'react';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { BlurView } from 'expo-blur';
import { useColorScheme } from '@/hooks/useColorScheme';

const { width } = Dimensions.get('window');

interface Feature {
  icon: string;
  title: string;
  description: string;
  color: string;
}

interface QuickAction {
  icon: string;
  title: string;
  color: string;
}

export default function HomeScreen() {
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const [refreshing, setRefreshing] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  const features: Feature[] = [
    {
      icon: 'compass',
      title: 'Popüler Rotalar',
      description: 'En çok tercih edilen seyahat rotaları',
      color: '#4c669f',
    },
    {
      icon: 'map-marker-radius',
      title: 'Yakın Yerler',
      description: 'Yakınınızdaki keşfedilecek yerler',
      color: '#3b5998',
    },
    {
      icon: 'star',
      title: 'Öneriler',
      description: 'Size özel seyahat önerileri',
      color: '#192f6a',
    },
    {
      icon: 'calendar-month',
      title: 'Etkinlikler',
      description: 'Yaklaşan seyahat etkinlikleri',
      color: '#4c669f',
    },
  ];

  const quickActions: QuickAction[] = [
    {
      icon: 'robot',
      title: 'AI Planlayıcı',
      color: '#4c669f',
    },
    {
      icon: 'compass',
      title: 'Keşfet',
      color: '#3b5998',
    },
  ];

  return (
    <ScrollView 
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <View style={styles.welcomeSection}>
          <ThemedText style={styles.welcomeText}>
            Merhaba, {user?.firstName || 'Gezgin'} 👋
          </ThemedText>
          <ThemedText style={styles.welcomeSubtext}>
            Yeni maceralar seni bekliyor
          </ThemedText>
        </View>
      </View>

      <View style={styles.content}>
        <TouchableOpacity style={styles.searchBar}>
          <MaterialCommunityIcons 
            name="magnify" 
            size={22} 
            color="#666" 
          />
          <ThemedText style={styles.searchText}>Nereyi keşfetmek istersin?</ThemedText>
        </TouchableOpacity>

        <View style={styles.quickActionsContainer}>
          <ThemedText style={styles.sectionTitle}>Hızlı İşlemler</ThemedText>
          <View style={styles.quickActions}>
            {quickActions.map((action, index) => (
              <TouchableOpacity
                key={index}
                style={styles.quickActionCard}
                onPress={() => router.push('/(tabs)/ai-planner')}
              >
                <View style={[styles.iconContainer, { backgroundColor: action.color + '15' }]}>
                  <MaterialCommunityIcons name={action.icon} size={26} color={action.color} />
                </View>
                <ThemedText style={styles.quickActionTitle}>{action.title}</ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.featuresContainer}>
          <ThemedText style={styles.sectionTitle}>Keşfet</ThemedText>
          <View style={styles.featuresGrid}>
            {features.map((feature, index) => (
              <TouchableOpacity
                key={index}
                style={styles.featureCard}
              >
                <View style={[styles.iconContainer, { backgroundColor: feature.color + '15' }]}>
                  <MaterialCommunityIcons name={feature.icon} size={24} color={feature.color} />
                </View>
                <ThemedText style={styles.featureTitle}>{feature.title}</ThemedText>
                <ThemedText style={styles.featureDescription}>{feature.description}</ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
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
    backgroundColor: '#000',
  },
  welcomeSection: {
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    color: '#fff',
    fontFamily: 'SpaceMono',
  },
  welcomeSubtext: {
    fontSize: 15,
    color: '#999',
    fontFamily: 'SpaceMono',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 14,
    padding: 14,
    marginBottom: 24,
  },
  searchText: {
    marginLeft: 12,
    fontSize: 15,
    color: '#666',
    fontFamily: 'SpaceMono',
  },
  quickActionsContainer: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    color: '#fff',
    fontFamily: 'SpaceMono',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  quickActionCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#111',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  quickActionTitle: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    color: '#fff',
    fontFamily: 'SpaceMono',
  },
  featuresContainer: {
    gap: 12,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  featureCard: {
    width: (width - 52) / 2,
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#111',
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
    color: '#fff',
    fontFamily: 'SpaceMono',
  },
  featureDescription: {
    fontSize: 13,
    color: '#999',
    lineHeight: 18,
    fontFamily: 'SpaceMono',
  },
});
