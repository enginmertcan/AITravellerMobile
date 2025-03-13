import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';

export default function AIPlannerScreen() {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#4c669f', '#3b5998', '#192f6a']}
        style={styles.header}
      >
        <ThemedText style={styles.title}>AI Seyahat Planlayıcı</ThemedText>
        <ThemedText style={styles.subtitle}>
          Yapay zeka destekli kişiselleştirilmiş seyahat planları
        </ThemedText>
      </LinearGradient>
      <View style={styles.content}>
        <View style={styles.card}>
          <ThemedText style={styles.cardTitle}>
            Yeni Seyahat Planı Oluştur
          </ThemedText>
          <ThemedText style={styles.cardDescription}>
            Tercihlerinize ve ilgi alanlarınıza göre özelleştirilmiş bir seyahat planı oluşturun.
          </ThemedText>
          <TouchableOpacity 
            style={styles.button}
            onPress={() => router.push('/create-plan' as any)}
          >
            <ThemedText style={styles.buttonText}>Başla</ThemedText>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 32,
    paddingTop: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  cardDescription: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#4c669f',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
}); 