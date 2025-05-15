import { useEffect } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { router, useSegments } from 'expo-router';

/**
 * AuthGuard bileşeni, kullanıcının oturum durumuna göre yönlendirme yapar.
 * Giriş yapmamış kullanıcılar sadece (auth) grubundaki sayfalara erişebilir.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    // Clerk henüz yüklenmediyse, bekle
    if (!isLoaded) return;

    // Mevcut yol segmentlerini kontrol et
    const inAuthGroup = segments[0] === '(auth)';

    // Kullanıcı giriş yapmamışsa ve auth grubunda değilse, giriş sayfasına yönlendir
    if (!isSignedIn && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    } 
    // Kullanıcı giriş yapmışsa ve auth grubundaysa, ana sayfaya yönlendir
    else if (isSignedIn && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [isSignedIn, isLoaded, segments]);

  return <>{children}</>;
}
