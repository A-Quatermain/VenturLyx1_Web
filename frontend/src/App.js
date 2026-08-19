import { useEffect, useRef } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import AppShell from "@/components/AppShell";
import Login from "@/pages/Login";
import Onboarding from "@/pages/Onboarding";
import CommandCenter from "@/pages/CommandCenter";
import Operate from "@/pages/Operate";
import ScaleSEO from "@/pages/ScaleSEO";
import Reviews from "@/pages/Reviews";
import Settings from "@/pages/Settings";
import LockedModule from "@/pages/LockedModule";

function Loader() {
  return (
    <div className="min-h-screen grid place-items-center bg-background">
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="w-3 h-8 bg-primary animate-pulse" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  );
}

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
function AuthCallback() {
  const navigate = useNavigate();
  const { checkAuth } = useAuth();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;
    const hash = window.location.hash;
    const sid = new URLSearchParams(hash.replace(/^#/, "")).get("session_id");
    (async () => {
      try {
        if (sid) await api.post("/auth/google/session", { session_id: sid });
        window.history.replaceState(null, "", window.location.pathname);
        await checkAuth();
        navigate("/dashboard", { replace: true });
      } catch {
        navigate("/login", { replace: true });
      }
    })();
  }, [navigate, checkAuth]);

  return <Loader />;
}

function Protected({ children }) {
  const { user, business } = useAuth();
  const location = useLocation();
  if (user === undefined || (user && business === undefined)) return <Loader />;
  if (user === null) return <Navigate to="/login" replace />;
  if (!business && location.pathname !== "/onboarding") return <Navigate to="/onboarding" replace />;
  return children;
}

function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) return <AuthCallback />;

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/onboarding" element={<Protected><Onboarding /></Protected>} />
      <Route element={<Protected><AppShell /></Protected>}>
        <Route path="/dashboard" element={<CommandCenter />} />
        <Route path="/operate" element={<Operate />} />
        <Route path="/scaleseo" element={<ScaleSEO />} />
        <Route path="/reviews" element={<Reviews />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/build" element={<LockedModule name="Build" />} />
        <Route path="/source" element={<LockedModule name="Source" />} />
        <Route path="/grow" element={<LockedModule name="Grow" />} />
        <Route path="/ai-team" element={<LockedModule name="AI Team" />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <AppRouter />
          <Toaster position="top-right" />
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}
