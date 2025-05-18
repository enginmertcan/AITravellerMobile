import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Platform, StyleSheet, View } from 'react-native';

import { colors, safeAreaInsets, borderRadius } from '@/constants/AppStyles';
import { HapticTab } from '@/components/HapticTab';

export default function TabLayout() {
  // Her zaman karanlık tema kullanıyoruz
  const theme = colors.dark;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.tabBar,
          borderTopColor: theme.tabBar, // Match the tab bar background color to remove the visible line
          borderTopWidth: 0, // Remove the border completely
          height: Platform.OS === 'ios' ? 80 : 65,
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
          fontFamily: 'InterRegular',
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
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="home" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="ai-planner"
        options={{
          title: 'Seyahatler',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="compass" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="trip-details"
        options={{
          title: 'Planlarım',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="map-marker" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="recommended-trips"
        options={{
          title: 'Önerilen',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="star" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile-settings"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="account" size={24} color={color} />
          ),
        }}
      />

      {/* Hidden screens */}
      <Tabs.Screen
        name="profile"
        options={{
          href: null, // Hide from tab bar
        }}
      />
      <Tabs.Screen
        name="plan-trip"
        options={{
          href: null, // Hide from tab bar
        }}
      />
    </Tabs>
  );
}
