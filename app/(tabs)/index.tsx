import { StyleSheet, View, ScrollView, TouchableOpacity, Image, Dimensions, RefreshControl } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useCallback } from 'react';
import { useAuth, useUser } from '@clerk/clerk-expo';

const { width } = Dimensions.get('window');

type Route = '/ai-planner' | '/guide' | '/recommendations' | '/my-plans' | '/explore' | '/favorites' | '/settings' | '/profile' | '/(auth)/sign-in';

interface Feature {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  color: string;
  route: Route;
}

interface QuickAction {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  color: string;
  route: Route;
}

export default function HomeScreen() {
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Burada yenileme işlemleri yapılabilir
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  const features: Feature[] = [
    {
      icon: 'map',
      title: 'AI Seyahat Planlayıcı',
      description: 'Yapay zeka ile kişiselleştirilmiş seyahat planları oluşturun',
      color: '#4c669f',
      route: '/ai-planner'
    },
    {
      icon: 'book',
      title: 'Seyahat Rehberi',
      description: 'Popüler destinasyonlar hakkında detaylı bilgiler',
      color: '#3b5998',
      route: '/guide'
    },
    {
      icon: 'location',
      title: 'Yerel Öneriler',
      description: 'En iyi restoranlar, oteller ve aktiviteler',
      color: '#192f6a',
      route: '/recommendations'
    },
    {
      icon: 'calendar',
      title: 'Planlarım',
      description: 'Oluşturduğunuz seyahat planlarını görüntüleyin',
      color: '#4c669f',
      route: '/my-plans'
    },
  ];

  const quickActions: QuickAction[] = [
    {
      icon: 'calendar',
      title: 'Planlarım',
      color: '#4c669f',
      route: '/my-plans'
    },
    {
      icon: 'compass',
      title: 'Rehber',
      color: '#3b5998',
      route: '/guide'
    },
    {
      icon: 'star',
      title: 'Öneriler',
      color: '#192f6a',
      route: '/recommendations'
    },
    {
      icon: 'settings',
      title: 'Ayarlar',
      color: '#607D8B',
      route: '/settings'
    }
  ];

  return (
    <ScrollView 
      style={styles.container} 
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Welcome Section */}
      <LinearGradient
        colors={['#4c669f', '#3b5998', '#192f6a']}
        style={styles.welcomeSection}
      >
        <View style={styles.welcomeContent}>
          <View style={styles.welcomeHeader}>
            <View>
              <ThemedText style={styles.welcomeText}>
                {isSignedIn ? `Merhaba, ${user?.firstName || 'Gezgin'}` : 'Merhaba, Gezgin'}
              </ThemedText>
              <ThemedText style={styles.welcomeSubtext}>
                Yeni bir maceraya hazır mısın?
              </ThemedText>
            </View>
            {isSignedIn ? (
              <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
                <Image
                  source={{ uri: user?.imageUrl || 'https://via.placeholder.com/40' }}
                  style={styles.profileImage}
                />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={styles.signInButton}
                onPress={() => router.push('/(auth)/sign-in')}
              >
                <ThemedText style={styles.signInButtonText}>Giriş Yap</ThemedText>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </LinearGradient>

      {/* Quick Actions */}
      <View style={styles.quickActionsContainer}>
        {quickActions.map((action, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.quickActionButton, { backgroundColor: action.color }]}
            onPress={() => router.push(action.route as any)}
          >
            <Ionicons name={action.icon} size={24} color="#fff" />
            <ThemedText style={styles.quickActionText}>{action.title}</ThemedText>
          </TouchableOpacity>
        ))}
      </View>

      {/* Features Section */}
      <View style={styles.featuresSection}>
        <ThemedText style={styles.sectionTitle}>Özellikler</ThemedText>
        <View style={styles.featuresGrid}>
          {features.map((feature, index) => (
            <TouchableOpacity
              key={index}
              style={styles.featureCard}
              onPress={() => router.push(feature.route as any)}
            >
              <View style={[styles.iconContainer, { backgroundColor: feature.color + '20' }]}>
                <Ionicons name={feature.icon} size={32} color={feature.color} />
              </View>
              <ThemedText style={styles.featureTitle}>{feature.title}</ThemedText>
              <ThemedText style={styles.featureDescription}>{feature.description}</ThemedText>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Promotion Section */}
      <TouchableOpacity
        style={styles.promotionCard}
        onPress={() => router.push('/ai-planner' as any)}
      >
        <ThemedText style={styles.promotionTitle}>
          AI ile Seyahat Planlamanın Geleceği
        </ThemedText>
        <ThemedText style={styles.promotionDescription}>
          Yapay zeka destekli planlayıcımız ile unutulmaz bir seyahat deneyimi yaşayın.
        </ThemedText>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  welcomeSection: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  welcomeContent: {
    marginBottom: 20,
  },
  welcomeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  welcomeSubtext: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#fff',
  },
  signInButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  signInButtonText: {
    color: '#4c669f',
    fontWeight: '600',
  },
  quickActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    marginTop: -20,
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  quickActionButton: {
    alignItems: 'center',
    width: (width - 80) / 4,
  },
  quickActionText: {
    fontSize: 12,
    color: '#fff',
    textAlign: 'center',
  },
  featuresSection: {
    padding: 20,
    backgroundColor: '#fff',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  featureCard: {
    width: (width - 56) / 2,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
  promotionCard: {
    margin: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  promotionContent: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  promotionTextContainer: {
    flex: 1,
  },
  promotionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  promotionDescription: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  promotionIconContainer: {
    marginLeft: 20,
  },
});
