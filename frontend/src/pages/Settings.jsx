import { useEffect, useState } from "react";
import { Brain, Cpu, ChartBar, FloppyDisk } from "@phosphor-icons/react";
import { toast } from "sonner";
import { api, apiErr } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const inputCls = "w-full border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

const PROVIDERS = [
  { key: "auto", label: "Auto (best of both)", desc: "We route each task to the best model, with cross-provider fallback." },
  { key: "anthropic", label: "Claude (Anthropic)", desc: "Prefer Claude models for all generation." },
  { key: "openai", label: "ChatGPT (OpenAI)", desc: "Prefer GPT models for all generation." },
];

export default function Settings() {
  const { business, loadBusiness } = useAuth();
  const [form, setForm] = useState({ name: "", website: "", industry: "", service_area: "" });
  const [pref, setPref] = useState(business?.ai_provider_pref || "auto");
  const [usage, setUsage] = useState(null);
  const [models, setModels] = useState(null);

  useEffect(() => {
    if (business) setForm({ name: business.name || "", website: business.website || "", industry: business.industry || "", service_area: business.service_area || "" });
    setPref(business?.ai_provider_pref || "auto");
  }, [business]);

  useEffect(() => {
    (async () => {
      try { setUsage((await api.get("/ai/usage")).data); setModels((await api.get("/ai/models")).data); } catch {}
    })();
  }, []);

  const saveBusiness = async () => {
    try { await api.post("/business", form); await loadBusiness(); toast.success("Business details saved"); }
    catch (e) { toast.error(apiErr(e)); }
  };
  const savePref = async (p) => {
    setPref(p);
    try { await api.put("/business/ai-preference", { ai_provider_pref: p }); await loadBusiness(); toast.success("AI preference updated"); }
    catch (e) { toast.error(apiErr(e)); }
  };

  return (
    <div className="space-y-6 animate-fade-up max-w-4xl" data-testid="settings-page">
      <div>
        <p className="label-mono mb-1">Settings</p>
        <h1 className="font-heading text-3xl sm:text-4xl font-black tracking-tighter">Configure Venturelyx</h1>
      </div>

      <section className="bg-card border border-border">
        <div className="px-6 py-4 border-b border-border"><h3 className="font-heading font-bold tracking-tight">Business Profile</h3></div>
        <div className="p-6 grid sm:grid-cols-2 gap-4">
          <div><label className="label-mono block mb-1.5">Business name</label><input data-testid="settings-name" className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="label-mono block mb-1.5">Website</label><input className={inputCls} value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></div>
          <div><label className="label-mono block mb-1.5">Industry</label><input className={inputCls} value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} /></div>
          <div><label className="label-mono block mb-1.5">Service area</label><input className={inputCls} value={form.service_area} onChange={(e) => setForm({ ...form, service_area: e.target.value })} /></div>
        </div>
        <div className="px-6 pb-6"><button onClick={saveBusiness} data-testid="save-business-btn" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold"><FloppyDisk size={16} weight="bold" /> Save changes</button></div>
      </section>

      <section className="bg-card border border-border">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2"><Brain size={18} weight="duotone" className="text-primary" /><h3 className="font-heading font-bold tracking-tight">AI Model Preference</h3></div>
        <div className="p-6 grid gap-3">
          {PROVIDERS.map((p) => (
            <button key={p.key} onClick={() => savePref(p.key)} data-testid={`ai-pref-${p.key}`}
              className={`text-left border p-4 transition-colors ${pref === p.key ? "border-primary bg-primary/5" : "border-border hover:border-foreground"}`}>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">{p.label}</span>
                {pref === p.key && <span className="label-mono !text-primary">Active</span>}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{p.desc}</p>
            </button>
          ))}
        </div>
      </section>

      {models && (
        <section className="bg-card border border-border">
          <div className="px-6 py-4 border-b border-border flex items-center gap-2"><Cpu size={18} weight="duotone" /><h3 className="font-heading font-bold tracking-tight">Model Routing</h3></div>
          <div className="p-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="label-mono"><th className="text-left pb-2">Tier</th><th className="text-left pb-2">Claude</th><th className="text-left pb-2">ChatGPT</th></tr></thead>
              <tbody className="font-mono text-xs">
                {["heavy", "primary", "cheap"].map((tier) => (
                  <tr key={tier} className="border-t border-border"><td className="py-2 uppercase">{tier}</td><td className="py-2">{models.model_map.anthropic[tier]}</td><td className="py-2">{models.model_map.openai[tier]}</td></tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-muted-foreground mt-3">Auto-fallback switches Claude ↔ ChatGPT if a provider errors or rate-limits.</p>
          </div>
        </section>
      )}

      <section className="bg-card border border-border">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2"><ChartBar size={18} weight="duotone" /><h3 className="font-heading font-bold tracking-tight">AI Usage</h3></div>
        <div className="p-6" data-testid="ai-usage">
          <p className="font-mono text-3xl font-bold tracking-tighter mb-4">{usage?.total_calls ?? 0} <span className="text-sm text-muted-foreground">calls</span></p>
          <div className="grid sm:grid-cols-2 gap-3">
            {Object.entries(usage?.by_provider || {}).map(([p, v]) => (
              <div key={p} className="border border-border p-4">
                <p className="label-mono">{p}</p>
                <p className="font-mono text-sm mt-1">{v.calls} calls · ~{v.approx_tokens.toLocaleString()} tokens</p>
              </div>
            ))}
            {(!usage || usage.total_calls === 0) && <p className="text-sm text-muted-foreground">No AI usage yet.</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
