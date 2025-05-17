import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import * as SecureStore from 'expo-secure-store';
import { ThemeProvider, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import * as WebBrowser from 'expo-web-browser';
import { useColorScheme } from '@/hooks/useColorScheme';
import Constants from 'expo-constants';
import { AuthGuard } from './components/AuthGuard';
import { UserSyncProvider } from './components/UserSyncProvider';
import * as Linking from 'expo-linking';

// WebBrowser oturumlarını temizle
WebBrowser.maybeCompleteAuthSession();

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync().catch(() => {
  /* ignore error */
});

// TokenCache implementation 
const tokenCache = {
  async getToken(key: string) {
    try {
      return SecureStore.getItemAsync(key);
    } catch (err) {
      console.error('Token get error:', err);
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      await SecureStore.setItemAsync(key, value);
      return;
    } catch (err) {
      console.error('Token save error:', err);
    }
  },
};

// Root URL yol yapısını belirleyen ayarlar
const routing = {
  initialRouteName: '(tabs)',
  screens: {
    '(auth)/oauth-callback': 'oauth-callback',
    '(auth)': {
      screens: {
        'sign-in': 'sign-in',
        'sign-up': 'sign-up',
      }
    },
    '(tabs)': '*',
  },
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    InterRegular: require('../assets/fonts/inter/Inter-Regular.ttf'),
    InterMedium: require('../assets/fonts/inter/Inter-Medium.ttf'),
    InterSemiBold: require('../assets/fonts/inter/Inter-SemiBold.ttf'),
    InterBold: require('../assets/fonts/inter/Inter-Bold.ttf'),
  });

  // Auth session işlemi için bileşenin yüklenmesini izle
  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync().catch(() => {
        /* ignore error */
      });
      
      // Ensure auth session is completed
      try {
        WebBrowser.maybeCompleteAuthSession();
      } catch (e) {
        console.log('Auth session completion error:', e);
      }
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  const clerkPublishableKey = Constants.expoConfig?.extra?.clerkPublishableKey || process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!clerkPublishableKey) {
    console.error('Clerk publishable key is missing!');
    return null;
  }

  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      tokenCache={tokenCache}
      redirectUrl={Linking.createURL('oauth-callback')}
    >
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <UserSyncProvider>
          <AuthGuard>
            <Stack
              screenOptions={{
                headerStyle: {
                  backgroundColor: colorScheme === 'dark' ? '#000' : '#fff',
                },
                headerTintColor: colorScheme === 'dark' ? '#fff' : '#000',
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(home)" options={{ headerShown: false }} />
              <Stack.Screen name="+not-found" />
            </Stack>
          </AuthGuard>
        </UserSyncProvider>
      </ThemeProvider>
    </ClerkProvider>
  );
}