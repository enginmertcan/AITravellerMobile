import { StyleSheet, View, TextInput, TouchableOpacity } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useState } from 'react';

export default function PlanTripScreen() {
  const [destination, setDestination] = useState('');
  const [duration, setDuration] = useState('');

  const handlePlanTrip = () => {
    // TODO: Implement trip planning logic
    console.log('Planning trip to:', destination, 'for', duration, 'days');
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.title}>Seyahat Planı Oluştur</ThemedText>
      
      <View style={styles.inputContainer}>
        <ThemedText style={styles.label}>Nereye gitmek istiyorsunuz?</ThemedText>
        <TextInput
          style={styles.input}
          value={destination}
          onChangeText={setDestination}
          placeholder="Örn: Paris, Fransa"
          placeholderTextColor="#666"
        />
      </View>

      <View style={styles.inputContainer}>
        <ThemedText style={styles.label}>Kaç gün kalacaksınız?</ThemedText>
        <TextInput
          style={styles.input}
          value={duration}
          onChangeText={setDuration}
          placeholder="Örn: 5"
          keyboardType="numeric"
          placeholderTextColor="#666"
        />
      </View>

      <TouchableOpacity 
        style={styles.button}
        onPress={handlePlanTrip}
      >
        <ThemedText style={styles.buttonText}>Plan Oluştur</ThemedText>
      </TouchableOpacity>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#4c669f',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
}); 