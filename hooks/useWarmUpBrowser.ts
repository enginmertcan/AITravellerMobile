import { useEffect } from "react";

export const useWarmUpBrowser = () => {
  useEffect(() => {
    // Browser warmup is no longer needed as we're not using expo-web-browser
    return () => {
      // Cleanup is no longer needed
    };
  }, []);
}; 