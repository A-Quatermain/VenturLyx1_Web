import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleLogo, ArrowRight } from "@phosphor-icons/react";
import { toast } from "sonner";
import { api, apiErr } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function Login() {
  const { user, checkAuth } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (user) navigate("/dashboard", { replace: true }); }, [user, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const path = mode === "login" ? "/auth/login" : "/auth/register";
      await api.post(path, form);
      await checkAuth();
      navigate("/dashboard", { replace: true });
    } catch (err) {
      toast.error(apiErr(err));
    } finally {
      setLoading(false);
    }
  };

  const google = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Left brand panel */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-foreground text-background dot-grid relative">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary grid place-items-center">
            <span className="font-heading font-black text-primary-foreground text-xl leading-none">V</span>
          </div>
          <span className="font-heading font-black text-xl tracking-tighter">VENTURELYX</span>
        </div>
        <div>
          <h1 className="font-heading text-5xl font-black tracking-tighter leading-none mb-6">
            We build<br />businesses,<br />not websites.
          </h1>
          <p className="text-background/60 max-w-md text-base leading-relaxed">
            One command center to launch, operate, get found, and scale — with a multi-model AI team (Claude + ChatGPT) working for you.
          </p>
        </div>
        <div className="flex gap-6 label-mono !text-background/40">
          <span>BUILD</span><span>OPERATE</span><span>SCALESEO</span><span>GROW</span>
        </div>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-10">
            <div className="w-8 h-8 bg-primary grid place-items-center">
              <span className="font-heading font-black text-primary-foreground text-xl leading-none">V</span>
            </div>
            <span className="font-heading font-black text-xl tracking-tighter">VENTURELYX</span>
          </div>

          <p className="label-mono mb-2">{mode === "login" ? "Welcome back" : "Get started"}</p>
          <h2 className="font-heading text-3xl font-bold tracking-tight mb-8">
            {mode === "login" ? "Sign in to your command center" : "Create your account"}
          </h2>

          <button
            onClick={google}
            data-testid="google-login-btn"
            className="w-full flex items-center justify-center gap-3 border border-border py-3 font-medium hover:bg-accent transition-colors mb-4"
          >
            <GoogleLogo size={20} weight="bold" /> Continue with Google
          </button>

          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-border" />
            <span className="label-mono">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === "register" && (
              <div>
                <label className="label-mono block mb-1.5">Name</label>
                <input
                  data-testid="name-input"
                  className="w-full border border-input bg-card px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Your name"
                />
              </div>
            )}
            <div>
              <label className="label-mono block mb-1.5">Email</label>
              <input
                data-testid="email-input"
                type="email"
                required
                className="w-full border border-input bg-card px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@business.com"
              />
            </div>
            <div>
              <label className="label-mono block mb-1.5">Password</label>
              <input
                data-testid="password-input"
                type="password"
                required
                className="w-full border border-input bg-card px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              data-testid="auth-submit-btn"
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity"
            >
              {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
              {!loading && <ArrowRight size={18} weight="bold" />}
            </button>
          </form>

          <p className="text-sm text-muted-foreground mt-6">
            {mode === "login" ? "New to Venturelyx? " : "Already have an account? "}
            <button
              data-testid="toggle-auth-mode"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
              className="text-primary font-semibold hover:underline"
            >
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
