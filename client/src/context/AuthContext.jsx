import { useEffect, useMemo, useRef, useState } from 'react';
import { startSession } from '../api/cases.js';
import { setAuthTokenProvider } from '../api/http.js';
import { loadBackend } from '../auth/backend.js';
import { useToast } from '../components/ui/useToast.js';
import { AuthContext } from './useAuth.js';

const unavailable = () => Object.assign(new Error('Sign-in is not available'), { code: 'auth/unavailable' });

// Who is signed in, for the whole app. The sign-in service (Firebase, or the pretend one in mock mode) is loaded after
// the first paint, so it never slows the first screen down. `loader` is a parameter so tests can supply their own.
export function AuthProvider({ children, loader = loadBackend }) {
  const { toast } = useToast();
  const toastRef = useRef(toast);
  const backendRef = useRef(null);
  const claimedFor = useRef(null); // the person we already asked the server to claim guest cases for
  const [auth, setAuth] = useState({ status: 'loading', user: null });
  useEffect(() => { toastRef.current = toast; });

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};

    // once per person per visit: hand this browser's guest cases to the account
    function claim(user) {
      if (!user) { claimedFor.current = null; return; }
      if (claimedFor.current === user.id) return;
      claimedFor.current = user.id;
      startSession().then(
        ({ claimed }) => {
          if (!active || !(claimed > 0)) return;
          const some = claimed === 1 ? '1 case you played as a guest is' : `${claimed} cases you played as a guest are`;
          toastRef.current({ title: 'Saved to your account', description: `${some} now in My cases.`, tone: 'success' });
        },
        () => { /* the claim is a convenience: the next sign-in tries again */ },
      );
    }

    loader().then(
      (backend) => {
        if (!active) return;
        if (!backend) { setAuth({ status: 'unavailable', user: null }); return; }
        backendRef.current = backend;
        setAuthTokenProvider(() => backend.getToken()); // before subscribing: the claim below needs the token
        unsubscribe = backend.subscribe((user) => {
          if (!active) return;
          setAuth({ status: user ? 'signedIn' : 'signedOut', user });
          claim(user);
        });
      },
      () => { if (active) setAuth({ status: 'unavailable', user: null }); },
    );

    return () => {
      active = false;
      unsubscribe();
      setAuthTokenProvider(null);
      backendRef.current = null;
      claimedFor.current = null;
    };
  }, [loader]);

  const value = useMemo(() => {
    const run = async (fn) => {
      const backend = backendRef.current;
      if (!backend) throw unavailable();
      return fn(backend);
    };
    // a sign-in or sign-up result is the freshest picture of the person (e.g. the name just chosen)
    const adopt = (user) => { setAuth({ status: 'signedIn', user }); return user; };
    return {
      ...auth,
      signIn: (details) => run((b) => b.signIn(details)).then(adopt),
      signUp: (details) => run((b) => b.signUp(details)).then(adopt),
      signInWithGoogle: () => run((b) => b.signInWithGoogle()).then(adopt),
      signOut: () => run((b) => b.signOut()),
      resetPassword: (email) => run((b) => b.resetPassword(email)),
    };
  }, [auth]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
