import { useEffect, useState } from "react";
import { Plus, Trash, CurrencyDollar } from "@phosphor-icons/react";
import { toast } from "sonner";
import { api, apiErr } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";

const STAGES = [
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "qualified", label: "Qualified" },
  { key: "proposal", label: "Proposal" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
];
const TABS = ["Pipeline", "Jobs", "Invoices"];
const money = (n) => `$${Number(n || 0).toLocaleString()}`;

function Field({ label, children }) {
  return <div><label className="label-mono block mb-1.5">{label}</label>{children}</div>;
}
const inputCls = "w-full border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export default function Operate() {
  const [tab, setTab] = useState("Pipeline");
  const [leads, setLeads] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [invoices, setInvoices] = useState([]);

  const loadAll = async () => {
    const [l, j, i] = await Promise.all([api.get("/leads"), api.get("/jobs"), api.get("/invoices")]);
    setLeads(l.data); setJobs(j.data); setInvoices(i.data);
  };
  useEffect(() => { loadAll(); }, []);

  const moveLead = async (lead, dir) => {
    const idx = STAGES.findIndex((s) => s.key === lead.stage);
    const nidx = Math.max(0, Math.min(STAGES.length - 1, idx + dir));
    const stage = STAGES[nidx].key;
    setLeads((ls) => ls.map((x) => (x.id === lead.id ? { ...x, stage } : x)));
    try { await api.put(`/leads/${lead.id}`, { stage }); } catch (e) { toast.error(apiErr(e)); loadAll(); }
  };

  return (
    <div className="space-y-6 animate-fade-up" data-testid="operate-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-mono mb-1">Operate</p>
          <h1 className="font-heading text-3xl sm:text-4xl font-black tracking-tighter">CRM &amp; Operations</h1>
        </div>
        <div className="flex border border-border">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)} data-testid={`operate-tab-${t.toLowerCase()}`}
              className={`px-5 py-2.5 text-sm font-medium border-r border-border last:border-r-0 transition-colors ${tab === t ? "bg-foreground text-background" : "hover:bg-accent"}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {tab === "Pipeline" && <Pipeline leads={leads} moveLead={moveLead} reload={loadAll} setLeads={setLeads} />}
      {tab === "Jobs" && <Jobs jobs={jobs} reload={loadAll} />}
      {tab === "Invoices" && <Invoices invoices={invoices} reload={loadAll} />}
    </div>
  );
}

function Pipeline({ leads, moveLead, reload, setLeads }) {
  const total = leads.filter((l) => !["won", "lost"].includes(l.stage)).reduce((s, l) => s + (l.value || 0), 0);
  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Open pipeline value: <span className="font-mono font-bold text-foreground">{money(total)}</span></p>
        <AddLead reload={reload} />
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4" data-testid="pipeline-board">
        {STAGES.map((stage) => {
          const items = leads.filter((l) => l.stage === stage.key);
          const val = items.reduce((s, l) => s + (l.value || 0), 0);
          return (
            <div key={stage.key} className="w-72 shrink-0 border border-border bg-card min-h-[70vh]" data-testid={`stage-${stage.key}`}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <span className="font-heading font-bold text-sm uppercase tracking-wide">{stage.label}</span>
                <span className="font-mono text-xs text-muted-foreground">{items.length} · {money(val)}</span>
              </div>
              <div className="p-3 space-y-3">
                {items.map((lead) => (
                  <div key={lead.id} className="border border-border bg-background p-3 group" data-testid={`lead-card-${lead.id}`}>
                    <div className="flex items-start justify-between">
                      <p className="font-semibold text-sm">{lead.name}</p>
                      <button onClick={async () => { await api.delete(`/leads/${lead.id}`); reload(); }} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity" data-testid={`delete-lead-${lead.id}`}>
                        <Trash size={14} />
                      </button>
                    </div>
                    {lead.company && <p className="text-xs text-muted-foreground">{lead.company}</p>}
                    <div className="flex items-center gap-1 mt-2 font-mono text-sm font-bold"><CurrencyDollar size={13} />{Number(lead.value || 0).toLocaleString()}</div>
                    <div className="flex justify-between mt-3 pt-2 border-t border-border">
                      <button onClick={() => moveLead(lead, -1)} className="text-xs text-muted-foreground hover:text-foreground">← Back</button>
                      <button onClick={() => moveLead(lead, 1)} className="text-xs text-primary font-semibold hover:underline" data-testid={`advance-lead-${lead.id}`}>Advance →</button>
                    </div>
                  </div>
                ))}
                {items.length === 0 && <p className="text-xs text-muted-foreground/60 px-1 py-4">Empty</p>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function AddLead({ reload }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", company: "", email: "", value: 0, stage: "new" });
  const save = async () => {
    if (!f.name.trim()) return toast.error("Name is required");
    try { await api.post("/leads", { ...f, value: Number(f.value) }); setOpen(false); setF({ name: "", company: "", email: "", value: 0, stage: "new" }); reload(); toast.success("Lead added"); }
    catch (e) { toast.error(apiErr(e)); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button data-testid="add-lead-btn" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity"><Plus size={16} weight="bold" /> Add Lead</button>
      </DialogTrigger>
      <DialogContent className="rounded-none border border-border">
        <DialogHeader><DialogTitle className="font-heading">New Lead</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Name"><input data-testid="lead-name-input" className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Company"><input className={inputCls} value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} /></Field>
          <Field label="Email"><input className={inputCls} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Deal Value ($)"><input type="number" data-testid="lead-value-input" className={inputCls} value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} /></Field>
        </div>
        <DialogFooter><button onClick={save} data-testid="save-lead-btn" className="bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold">Save Lead</button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Jobs({ jobs, reload }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: "", customer_name: "", value: 0, status: "scheduled" });
  const save = async () => {
    if (!f.title.trim()) return toast.error("Title is required");
    try { await api.post("/jobs", { ...f, value: Number(f.value) }); setOpen(false); setF({ title: "", customer_name: "", value: 0, status: "scheduled" }); reload(); }
    catch (e) { toast.error(apiErr(e)); }
  };
  const cycle = async (job) => {
    const order = ["scheduled", "in_progress", "completed"];
    const status = order[(order.indexOf(job.status) + 1) % order.length];
    await api.put(`/jobs/${job.id}`, { status }); reload();
  };
  const badge = { scheduled: "text-primary border-primary", in_progress: "text-foreground border-foreground", completed: "text-success border-success" };
  return (
    <div>
      <div className="flex justify-end mb-4">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><button data-testid="add-job-btn" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold"><Plus size={16} weight="bold" /> Add Job</button></DialogTrigger>
          <DialogContent className="rounded-none border border-border">
            <DialogHeader><DialogTitle className="font-heading">New Job</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Field label="Title"><input data-testid="job-title-input" className={inputCls} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
              <Field label="Customer"><input className={inputCls} value={f.customer_name} onChange={(e) => setF({ ...f, customer_name: e.target.value })} /></Field>
              <Field label="Value ($)"><input type="number" className={inputCls} value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} /></Field>
            </div>
            <DialogFooter><button onClick={save} data-testid="save-job-btn" className="bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold">Save</button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="border border-border bg-card divide-y divide-border" data-testid="jobs-list">
        {jobs.map((j) => (
          <div key={j.id} className="flex items-center justify-between px-6 py-3">
            <div><p className="font-semibold text-sm">{j.title}</p><p className="text-xs text-muted-foreground">{j.customer_name}</p></div>
            <div className="flex items-center gap-4">
              <span className="font-mono text-sm font-bold">{money(j.value)}</span>
              <button onClick={() => cycle(j)} data-testid={`job-status-${j.id}`} className={`text-[10px] font-mono uppercase px-2 py-1 border ${badge[j.status] || ""}`}>{(j.status || "").replace("_", " ")}</button>
            </div>
          </div>
        ))}
        {jobs.length === 0 && <p className="px-6 py-8 text-sm text-muted-foreground">No jobs yet.</p>}
      </div>
    </div>
  );
}

function Invoices({ invoices, reload }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ customer_name: "", amount: 0, status: "draft" });
  const save = async () => {
    if (!f.customer_name.trim()) return toast.error("Customer is required");
    try { await api.post("/invoices", { ...f, amount: Number(f.amount) }); setOpen(false); setF({ customer_name: "", amount: 0, status: "draft" }); reload(); }
    catch (e) { toast.error(apiErr(e)); }
  };
  const cycle = async (inv) => {
    const order = ["draft", "sent", "paid", "overdue"];
    const status = order[(order.indexOf(inv.status) + 1) % order.length];
    await api.put(`/invoices/${inv.id}`, { status }); reload();
  };
  const badge = { draft: "text-muted-foreground border-border", sent: "text-primary border-primary", paid: "text-success border-success", overdue: "text-destructive border-destructive" };
  return (
    <div>
      <div className="flex justify-end mb-4">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><button data-testid="add-invoice-btn" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold"><Plus size={16} weight="bold" /> New Invoice</button></DialogTrigger>
          <DialogContent className="rounded-none border border-border">
            <DialogHeader><DialogTitle className="font-heading">New Invoice</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Field label="Customer"><input data-testid="invoice-customer-input" className={inputCls} value={f.customer_name} onChange={(e) => setF({ ...f, customer_name: e.target.value })} /></Field>
              <Field label="Amount ($)"><input type="number" data-testid="invoice-amount-input" className={inputCls} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
            </div>
            <DialogFooter><button onClick={save} data-testid="save-invoice-btn" className="bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold">Save</button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="border border-border bg-card divide-y divide-border" data-testid="invoices-list">
        {invoices.map((inv) => (
          <div key={inv.id} className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-4">
              <span className="font-mono text-xs text-muted-foreground">{inv.number}</span>
              <span className="font-semibold text-sm">{inv.customer_name}</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-mono text-sm font-bold">{money(inv.amount)}</span>
              <button onClick={() => cycle(inv)} data-testid={`invoice-status-${inv.id}`} className={`text-[10px] font-mono uppercase px-2 py-1 border ${badge[inv.status] || ""}`}>{inv.status}</button>
            </div>
          </div>
        ))}
        {invoices.length === 0 && <p className="px-6 py-8 text-sm text-muted-foreground">No invoices yet.</p>}
      </div>
    </div>
  );
}
