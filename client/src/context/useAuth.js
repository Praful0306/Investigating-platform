import { createContext, useContext } from 'react';

export const AuthContext = createContext(null);

// const { user, status, signIn, signUp, signInWithGoogle, signOut, resetPassword } = useAuth();
// status: 'loading' | 'signedOut' | 'signedIn' | 'unavailable' (no sign-in service on this site: guests only)
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
