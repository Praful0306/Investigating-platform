// The real sign-in service (Firebase Authentication). The SDK is imported inside the function, so it is only downloaded
// when sign-in is configured, and after the first paint (see AuthContext). Same shape as mockBackend.js.
// Only plain data leaves this file: never the SDK's user object (it carries refresh tokens).
const toUser = (u) => (u ? { id: u.uid, email: u.email ?? null, displayName: u.displayName || u.email?.split('@')[0] || 'Detective' } : null);

export async function createFirebaseBackend(config) {
  const [{ getApp, getApps, initializeApp }, fb] = await Promise.all([import('firebase/app'), import('firebase/auth')]);
  const auth = fb.getAuth(getApps().length ? getApp() : initializeApp(config));

  return {
    subscribe: (cb) => fb.onAuthStateChanged(auth, (u) => cb(toUser(u))),

    async signIn({ email, password }) {
      return toUser((await fb.signInWithEmailAndPassword(auth, email, password)).user);
    },

    async signUp({ name, email, password }) {
      const { user } = await fb.createUserWithEmailAndPassword(auth, email, password);
      try {
        await fb.updateProfile(user, { displayName: name });
      } catch { /* the account exists; the name is a nicety and can be set later */ }
      return toUser(user);
    },

    async signInWithGoogle() {
      return toUser((await fb.signInWithPopup(auth, new fb.GoogleAuthProvider())).user);
    },

    signOut: () => fb.signOut(auth),
    resetPassword: (email) => fb.sendPasswordResetEmail(auth, email),

    // A token that cannot be fetched means "send the request as a guest would", not "break the request".
    async getToken() {
      try {
        return auth.currentUser ? await auth.currentUser.getIdToken() : null;
      } catch {
        return null;
      }
    },
  };
}
