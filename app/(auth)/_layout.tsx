import { Stack } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect } from "react";

// Tarayıcı oturumunu kapatmak için
WebBrowser.maybeCompleteAuthSession();

export default function AuthLayout() {
  // Auth oturumunun her zaman tamamlanmasını sağla
  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
    return () => {
      // Temizlik yaparken de oturumu tamamla
      try {
        WebBrowser.dismissBrowser();
      } catch (e) {
        // Hata durumunu görmezden gel
      }
    };
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-up" />
      <Stack.Screen 
        name="oauth-callback" 
        options={{ 
          headerShown: false,
          presentation: 'transparentModal',
          animation: 'fade'
        }} 
      />
    </Stack>
  );
}