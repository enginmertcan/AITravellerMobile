import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { LinearGradient } from 'expo-linear-gradient';

export default function MyPlansScreen() {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#4c669f', '#3b5998', '#192f6a']}
        style={styles.header}
      >
        <ThemedText style={styles.title}>Planlarım</ThemedText>
        <ThemedText style={styles.subtitle}>
          Oluşturduğunuz seyahat planları
        </ThemedText>
      </LinearGradient>
      <View style={styles.content}>
        <ThemedText style={styles.comingSoon}>
          Bu özellik yakında kullanıma açılacak!
        </ThemedText>
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  comingSoon: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
  },
}); 