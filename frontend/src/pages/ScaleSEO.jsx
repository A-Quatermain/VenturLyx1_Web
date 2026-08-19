import { useEffect, useState } from "react";
import { MagnifyingGlass, CheckCircle, XCircle, Plus, Trash, ClockCounterClockwise, Sparkle, WarningCircle } from "@phosphor-icons/react";
import { toast } from "sonner";
import { api, apiErr } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import AIStreamPanel from "@/components/AIStreamPanel";

const TABS = ["Scanner", "Keywords", "Competitors", "AI Page Builder", "History"];
const inputCls = "w-full border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";
const SEV = { critical: "text-destructive border-destructive", high: "text-primary border-primary", medium: "text-muted-foreground border-border" };

export default function ScaleSEO() {
  const { business } = useAuth();
  const [tab, setTab] = useState("Scanner");
  const [url, setUrl] = useState(business?.website || "");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [fixIssue, setFixIssue] = useState(null);

  const scan = async () => {
    if (!url.trim()) return toast.error("Enter a website address");
    setScanning(true); setResult(null); setFixIssue(null);
    try {
      const { data } = await api.post("/seo/scan", { url });
      setResult(data);
      toast.success(`Scan complete — scored ${data.score}/100`);
    } catch (e) { toast.error(apiErr(e)); }
    finally { setScanning(false); }
  };

  return (
    <div className="space-y-6 animate-fade-up" data-testid="scaleseo-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-mono mb-1">ScaleSEO</p>
          <h1 className="font-heading text-3xl sm:text-4xl font-black tracking-tighter">Get Found on Google</h1>
        </div>
        <div className="flex border border-border flex-wrap">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)} data-testid={`seo-tab-${t.toLowerCase().replace(/\s/g, "-")}`}
              className={`px-4 py-2.5 text-sm font-medium border-r border-border last:border-r-0 transition-colors ${tab === t ? "bg-foreground text-background" : "hover:bg-accent"}`}>{t}</button>
          ))}
        </div>
      </div>

      {tab === "Scanner" && (
        <div className="space-y-6">
          <div className="bg-card border border-border p-6">
            <label className="label-mono block mb-2">Website Scanner</label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input data-testid="seo-url-input" className={inputCls + " flex-1 py-3"} placeholder="yourbusiness.com" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && scan()} />
              <button onClick={scan} disabled={scanning} data-testid="seo-scan-btn" className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-3 font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity">
                <MagnifyingGlass size={18} weight="bold" /> {scanning ? "Scanning…" : "Scan my site"}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">We check the same things Google does — safely and in plain English.</p>
          </div>

          {scanning && <div className="border border-border p-10 text-center font-mono text-sm text-muted-foreground animate-pulse">▊ Analyzing your website…</div>}

          {result && (
            <div className="grid grid-cols-12 gap-4" data-testid="scan-result">
              <div className="col-span-12 md:col-span-3 bg-foreground text-background p-6 flex flex-col items-center justify-center">
                <div className="font-mono text-6xl font-black tracking-tighter" data-testid="seo-score">{result.score}</div>
                <div className="label-mono !text-background/60 mt-1">Grade {result.grade}</div>
                <div className="text-xs text-background/60 mt-4 text-center">{result.passed}/{result.total} checks passed · {result.response_ms}ms</div>
              </div>
              <div className="col-span-12 md:col-span-9 bg-card border border-border">
                <div className="px-6 py-3 border-b border-border flex items-center justify-between">
                  <span className="font-heading font-bold">We found {result.issues.length} things stopping customers from finding you</span>
                </div>
                <div className="divide-y divide-border">
                  {result.checks.map((c) => (
                    <div key={c.key} className="flex items-start justify-between gap-4 px-6 py-3" data-testid={`check-${c.key}`}>
                      <div className="flex items-start gap-3">
                        {c.status === "pass" ? <CheckCircle size={20} weight="fill" className="text-success mt-0.5" /> : <XCircle size={20} weight="fill" className="text-destructive mt-0.5" />}
                        <div>
                          <p className="font-semibold text-sm">{c.label}</p>
                          <p className="text-xs text-muted-foreground">{c.detail}</p>
                        </div>
                      </div>
                      {c.status === "fail" && (
                        <button onClick={() => setFixIssue(c)} data-testid={`fix-${c.key}`} className="shrink-0 bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold hover:opacity-90 transition-opacity">Fix this for me</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-2">
              <div className="flex items-center gap-2"><Sparkle size={16} weight="fill" className="text-primary" /><span className="label-mono">AI SEO Recommendations {fixIssue ? `· ${fixIssue.label}` : ""}</span></div>
              <AIStreamPanel
                key={fixIssue?.key || "all"}
                feature="seo_recommendations"
                context={{ score: result.score, issues: fixIssue ? [fixIssue] : result.issues }}
                title="SEO Fix Plan"
                triggerLabel="Explain & fix in plain English"
                autoStart={!!fixIssue}
              />
            </div>
          )}
        </div>
      )}

      {tab === "Keywords" && <Keywords />}
      {tab === "Competitors" && <Competitors />}
      {tab === "AI Page Builder" && <PageBuilder business={business} />}
      {tab === "History" && <History />}
    </div>
  );
}

function Keywords() {
  const [rows, setRows] = useState([]);
  const [f, setF] = useState({ keyword: "", position: 0, volume: 0, difficulty: 0 });
  const load = async () => setRows((await api.get("/seo/keywords")).data);
  useEffect(() => { load(); }, []);
  const add = async () => {
    if (!f.keyword.trim()) return toast.error("Enter a keyword");
    await api.post("/seo/keywords", { ...f, position: Number(f.position), volume: Number(f.volume), difficulty: Number(f.difficulty) });
    setF({ keyword: "", position: 0, volume: 0, difficulty: 0 }); load();
  };
  return (
    <div className="space-y-4">
      <div className="bg-card border border-border p-4 grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
        <div className="col-span-2"><label className="label-mono block mb-1.5">Keyword</label><input data-testid="keyword-input" className={inputCls} value={f.keyword} onChange={(e) => setF({ ...f, keyword: e.target.value })} placeholder="hvac repair austin" /></div>
        <div><label className="label-mono block mb-1.5">Position</label><input type="number" className={inputCls} value={f.position} onChange={(e) => setF({ ...f, position: e.target.value })} /></div>
        <div><label className="label-mono block mb-1.5">Volume</label><input type="number" className={inputCls} value={f.volume} onChange={(e) => setF({ ...f, volume: e.target.value })} /></div>
        <button onClick={add} data-testid="add-keyword-btn" className="bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold inline-flex items-center justify-center gap-1"><Plus size={15} weight="bold" /> Track</button>
      </div>
      <div className="border border-border bg-card divide-y divide-border" data-testid="keywords-list">
        <div className="grid grid-cols-4 px-6 py-2 label-mono"><span className="col-span-2">Keyword</span><span className="text-right">Position</span><span className="text-right">Volume</span></div>
        {rows.map((k) => (
          <div key={k.id} className="grid grid-cols-4 px-6 py-3 items-center group">
            <span className="col-span-2 font-medium text-sm">{k.keyword}</span>
            <span className="text-right font-mono text-sm">{k.position || "—"}</span>
            <span className="text-right font-mono text-sm flex items-center justify-end gap-3">{k.volume?.toLocaleString() || "—"}
              <button onClick={async () => { await api.delete(`/seo/keywords/${k.id}`); load(); }} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"><Trash size={14} /></button>
            </span>
          </div>
        ))}
        {rows.length === 0 && <p className="px-6 py-8 text-sm text-muted-foreground">No keywords tracked yet.</p>}
      </div>
    </div>
  );
}

function Competitors() {
  const [rows, setRows] = useState([]);
  const [f, setF] = useState({ name: "", domain: "", seo_score: 0 });
  const load = async () => setRows((await api.get("/seo/competitors")).data);
  useEffect(() => { load(); }, []);
  const add = async () => {
    if (!f.name.trim()) return toast.error("Enter a competitor");
    await api.post("/seo/competitors", { ...f, seo_score: Number(f.seo_score) });
    setF({ name: "", domain: "", seo_score: 0 }); load();
  };
  return (
    <div className="space-y-4">
      <div className="bg-card border border-border p-4 grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
        <div><label className="label-mono block mb-1.5">Name</label><input data-testid="competitor-name-input" className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div><label className="label-mono block mb-1.5">Domain</label><input className={inputCls} value={f.domain} onChange={(e) => setF({ ...f, domain: e.target.value })} /></div>
        <div><label className="label-mono block mb-1.5">Their SEO Score</label><input type="number" className={inputCls} value={f.seo_score} onChange={(e) => setF({ ...f, seo_score: e.target.value })} /></div>
        <button onClick={add} data-testid="add-competitor-btn" className="bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold inline-flex items-center justify-center gap-1"><Plus size={15} weight="bold" /> Add</button>
      </div>
      <div className="border border-border bg-card divide-y divide-border" data-testid="competitors-list">
        {rows.map((c) => (
          <div key={c.id} className="flex items-center justify-between px-6 py-3 group">
            <div><p className="font-semibold text-sm">{c.name}</p><p className="text-xs text-muted-foreground">{c.domain}</p></div>
            <div className="flex items-center gap-4"><span className="font-mono text-sm font-bold">{c.seo_score || "—"}</span>
              <button onClick={async () => { await api.delete(`/seo/competitors/${c.id}`); load(); }} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"><Trash size={14} /></button>
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="px-6 py-8 text-sm text-muted-foreground">No competitors added yet.</p>}
      </div>
    </div>
  );
}

function PageBuilder({ business }) {
  const [ctx, setCtx] = useState({ page_type: "service", keyword: "", location: business?.service_area || "", tone: "confident and friendly" });
  const [saved, setSaved] = useState(false);
  const approve = async (text, meta) => {
    await api.post("/ai/generations", { feature: "page_generation", title: `${ctx.page_type} page — ${ctx.keyword}`, output: text, provider: meta?.provider || "", model: meta?.model || "", status: "approved" });
    setSaved(true); toast.success("Page approved & saved to your library");
  };
  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-12 lg:col-span-4 bg-card border border-border p-6 space-y-4 h-fit">
        <div><label className="label-mono block mb-1.5">Page type</label>
          <select data-testid="page-type-select" className={inputCls} value={ctx.page_type} onChange={(e) => setCtx({ ...ctx, page_type: e.target.value })}>
            <option value="service">Service page</option><option value="local landing">Local landing page</option><option value="about">About page</option>
          </select>
        </div>
        <div><label className="label-mono block mb-1.5">Target keyword</label><input data-testid="page-keyword-input" className={inputCls} value={ctx.keyword} onChange={(e) => setCtx({ ...ctx, keyword: e.target.value })} placeholder="emergency ac repair" /></div>
        <div><label className="label-mono block mb-1.5">Location</label><input className={inputCls} value={ctx.location} onChange={(e) => setCtx({ ...ctx, location: e.target.value })} /></div>
        <p className="text-xs text-muted-foreground">AI writes a full page (title, meta, H1, copy, FAQs). You review & approve before anything is used.</p>
      </div>
      <div className="col-span-12 lg:col-span-8 space-y-2">
        <div className="flex items-center gap-2"><Sparkle size={16} weight="fill" className="text-primary" /><span className="label-mono">AI Page Generator {saved && "· Approved ✓"}</span></div>
        <AIStreamPanel key={ctx.keyword} feature="page_generation" context={ctx} title="Generated Page" triggerLabel="Generate page with AI" onApprove={approve} approveLabel="Approve & save" />
      </div>
    </div>
  );
}

function History() {
  const [rows, setRows] = useState([]);
  useEffect(() => { (async () => setRows((await api.get("/seo/audits")).data))(); }, []);
  return (
    <div className="border border-border bg-card divide-y divide-border" data-testid="audit-history">
      <div className="px-6 py-3 flex items-center gap-2 border-b border-border"><ClockCounterClockwise size={16} weight="duotone" /><span className="font-heading font-bold text-sm">Audit History</span></div>
      {rows.map((a) => (
        <div key={a.id} className="flex items-center justify-between px-6 py-3">
          <div><p className="font-medium text-sm">{a.url}</p><p className="text-xs text-muted-foreground font-mono">{new Date(a.created_at).toLocaleString()}</p></div>
          <div className="flex items-center gap-3"><span className="font-mono font-bold">{a.score}</span><span className="text-[10px] font-mono uppercase px-2 py-1 border border-border">Grade {a.grade}</span></div>
        </div>
      ))}
      {rows.length === 0 && <p className="px-6 py-8 text-sm text-muted-foreground flex items-center gap-2"><WarningCircle size={16} /> No scans yet. Run one from the Scanner tab.</p>}
    </div>
  );
}
