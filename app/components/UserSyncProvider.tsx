import React from 'react';
import { useSyncUserWithFirebase } from '../hooks/useSyncUserWithFirebase';

/**
 * Provider component that synchronizes Clerk user data with Firebase
 */
function UserSyncProvider({ children }: { children: React.ReactNode }) {
  // Use the hook to sync user data
  useSyncUserWithFirebase();

  // Just render children, the hook handles the sync logic
  return <>{children}</>;
}

export { UserSyncProvider };
export default UserSyncProvider;
