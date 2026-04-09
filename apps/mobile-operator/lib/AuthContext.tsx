import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getToken, getUser, saveToken, saveUser, clearAll } from './storage';
import { User } from './api';

interface AuthState {
  token: string | null;
  user: User | null;
  loading: boolean;
  signIn: (token: string, user: User) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  token: null, user: null, loading: true,
  signIn: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [t, u] = await Promise.all([getToken(), getUser()]);
      if (t) setToken(t);
      if (u) setUser(u as unknown as User);
      setLoading(false);
    })();
  }, []);

  async function signIn(newToken: string, newUser: User) {
    await Promise.all([saveToken(newToken), saveUser(newUser as unknown as Record<string, unknown>)]);
    setToken(newToken);
    setUser(newUser);
  }

  async function signOut() {
    await clearAll();
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ token, user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
