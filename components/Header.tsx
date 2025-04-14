import { StyleSheet, View, TouchableOpacity, Platform } from 'react-native';
import { ThemedText } from './ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { usePathname } from 'expo-router';

const getHeaderTitle = (pathname: string) => {
  switch (pathname) {
    case '/ai-planner':
      return 'AI Seyahat Planlayıcı';
    case '/':
      return 'Keşfet';
    case '/profile':
      return 'Profil';
    default:
      return '';
  }
};

export function Header() {
  const pathname = usePathname();

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <ThemedText style={styles.title}>{getHeaderTitle(pathname)}</ThemedText>
        <TouchableOpacity style={styles.action}>
          <MaterialCommunityIcons name="bell-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 10,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'SpaceMono',
  },
  action: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
  },
}); 