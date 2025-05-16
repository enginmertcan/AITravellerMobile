import { useEffect } from 'react';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { FirebaseService } from '@/app/services/firebase.service';

/**
 * Hook to synchronize Clerk user data with Firebase
 * This hook will run whenever the user's authentication state changes
 * and will update the user's profile in Firebase
 */
function useSyncUserWithFirebase() {
  const { userId, isSignedIn, isLoaded } = useAuth();
  const { user, isLoaded: isUserLoaded } = useUser();

  useEffect(() => {
    // Only run when Clerk is loaded and user is signed in
    if (!isLoaded || !isUserLoaded || !isSignedIn || !userId || !user) {
      return;
    }

    // Create user profile data from Clerk user
    const profileData = {
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      email: user.primaryEmailAddress?.emailAddress,
      imageUrl: user.imageUrl,
      username: user.username,
      lastSignInAt: new Date().toISOString(),
      // Add any other user data you want to store
    };

    console.log('Synchronizing user data with Firebase:', userId);

    // Update user profile in Firebase
    FirebaseService.User.upsertUserProfile(userId, profileData)
      .then((success) => {
        if (success) {
          console.log('User profile synchronized with Firebase successfully');
        } else {
          console.error('Failed to synchronize user profile with Firebase');
        }
      })
      .catch((error) => {
        console.error('Error synchronizing user profile with Firebase:', error);
      });
  }, [isLoaded, isUserLoaded, isSignedIn, userId, user]);

  return null;
}

export { useSyncUserWithFirebase };
export default useSyncUserWithFirebase;
