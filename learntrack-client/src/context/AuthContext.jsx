import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { auth as authApi } from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("lt_user"));
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(
    !localStorage.getItem("lt_token") ? false : true,
  );
  const [error, setError] = useState(null);

  // Rehydrate from token on mount
  useEffect(() => {
    if (!localStorage.getItem("lt_token")) return;
    authApi
      .me()
      .then((r) => setUser(r.data))
      .catch(() => {
        localStorage.removeItem("lt_token");
        localStorage.removeItem("lt_user");
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    setError(null);
    const { data } = await authApi.login({ email, password });
    localStorage.setItem("lt_token", data.token);
    const meRes = await authApi.me();
    localStorage.setItem("lt_user", JSON.stringify(meRes.data));
    setUser(meRes.data);
    return meRes.data;
  }, []);

  const refreshUser = useCallback(async () => {
    if (!localStorage.getItem("lt_token")) return null;
    try {
      const meRes = await authApi.me();
      localStorage.setItem("lt_user", JSON.stringify(meRes.data));
      setUser(meRes.data);
      return meRes.data;
    } catch {
      return null;
    }
  }, []);

  const register = useCallback(
    async (payload) => {
      setError(null);
      await authApi.register(payload);
      // auto-login after register
      return login(payload.email, payload.password);
    },
    [login],
  );

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => {});
    localStorage.removeItem("lt_token");
    localStorage.removeItem("lt_user");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, error, setError, login, register, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
