import { ClerkProvider } from "@clerk/clerk-expo";
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SecureStore from "expo-secure-store";
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Header } from '@/components/Header';
import { useAuth } from "@clerk/clerk-expo";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const tokenCache = {
  async getToken(key: string) {
    try {
      return SecureStore.getItemAsync(key);
    } catch (err) {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      return SecureStore.setItemAsync(key, value);
    } catch (err) {
      return;
    }
  },
};

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { isSignedIn, isLoaded } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  useEffect(() => {
    if (!isLoaded) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inTabsGroup = segments[0] === "(tabs)";

    if (!isSignedIn && !inAuthGroup) {
      // Kullanıcı giriş yapmamış ve auth grubunda değilse, sign-in sayfasına yönlendir
      router.replace("/(auth)/sign-in");
    } else if (isSignedIn && inAuthGroup) {
      // Kullanıcı giriş yapmış ve auth grubundaysa, ana sayfaya yönlendir
      router.replace("/(tabs)");
    }
  }, [isSignedIn, segments, isLoaded]);

  if (!loaded || !isLoaded) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack
        screenOptions={{
          headerShown: true,
          header: () => <Header />,
          contentStyle: {
            backgroundColor: '#f5f5f5',
          },
          headerStyle: {
            backgroundColor: 'transparent',
          },
        }}
      >
        <Stack.Screen 
          name="(tabs)" 
          options={{ 
            headerShown: true,
            headerStyle: {
              backgroundColor: 'transparent',
            },
          }} 
        />
        <Stack.Screen 
          name="(auth)" 
          options={{ 
            headerShown: false
          }} 
        />
      </Stack>
      <StatusBar style="light" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ClerkProvider
      publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY as string}
      tokenCache={tokenCache}
    >
      <RootLayoutNav />
    </ClerkProvider>
  );
}