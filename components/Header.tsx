import { useAuth } from "@clerk/clerk-expo";
import { TouchableOpacity, Text, StyleSheet, View, Image, Pressable } from "react-native";
import { useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

export function Header() {
  const { signOut, isSignedIn } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace("/(auth)/sign-in");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  // Auth sayfalarında header'ı gösterme
  if (segments[0] === "(auth)") {
    return null;
  }

  return (
    <LinearGradient
      colors={['#4c669f', '#3b5998', '#192f6a']}
      style={styles.header}
    >
      <View style={styles.headerContent}>
        <View style={styles.leftSection}>
          <Text style={styles.title}>AI Traveller</Text>
        </View>
        
        {isSignedIn && (
          <View style={styles.rightSection}>
            <TouchableOpacity 
              onPress={handleSignOut} 
              style={styles.logoutButton}
            >
              <Ionicons name="log-out-outline" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 50,
    paddingBottom: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  leftSection: {
    flex: 1,
  },
  rightSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  logoutButton: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    padding: 8,
    borderRadius: 20,
  },
}); 