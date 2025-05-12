import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Platform, StyleSheet, View } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { colors, safeAreaInsets, borderRadius } from '@/constants/AppStyles';
import { HapticTab } from '@/components/HapticTab';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? colors.dark : colors.light;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.tabBar,
          borderTopColor: 'rgba(76, 102, 159, 0.2)',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 80 : 65, // Yüksekliği biraz azalttım
          paddingBottom: Platform.OS === 'ios' ? 25 : 10,
          paddingTop: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 10,
        },
        tabBarActiveTintColor: colors.primaryLight,
        tabBarInactiveTintColor: '#999',
        tabBarLabelStyle: {
          fontSize: 12, // Yazı boyutunu küçülttüm
          fontWeight: '600',
          fontFamily: 'SpaceMono',
          marginBottom: Platform.OS === 'ios' ? 0 : 2,
          paddingBottom: 2,
          marginTop: 2,
        },
        tabBarIconStyle: {
          marginBottom: 0,
        },
        tabBarButton: (props) => <HapticTab {...props} />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Ana Sayfa',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="home" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="ai-planner"
        options={{
          title: 'Seyahatler',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="compass" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="trip-details"
        options={{
          title: 'Planlarım',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="map-marker" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account" size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
