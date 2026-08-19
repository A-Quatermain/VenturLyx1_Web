import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined=checking, null=none, obj=auth
  const [business, setBusiness] = useState(undefined);

  const loadBusiness = useCallback(async () => {
    try {
      const { data } = await api.get("/business");
      setBusiness(data || null);
      return data || null;
    } catch {
      setBusiness(null);
      return null;
    }
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
      await loadBusiness();
    } catch {
      setUser(null);
      setBusiness(null);
    }
  }, [loadBusiness]);

  useEffect(() => {
    if (window.location.hash?.includes("session_id=")) {
      // AuthCallback will establish the session first
      return;
    }
    checkAuth();
  }, [checkAuth]);

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    setUser(null);
    setBusiness(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, business, setBusiness, checkAuth, loadBusiness, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
