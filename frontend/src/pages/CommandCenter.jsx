import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TrendUp, Users, CurrencyDollar, MagnifyingGlass, Star, Kanban, Receipt, Lightning, ArrowRight, Sparkle } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import GrowthGauge from "@/components/GrowthGauge";
import AIStreamPanel from "@/components/AIStreamPanel";

function Metric({ label, value, sub, icon: Icon, testid, accent }) {
  return (
    <div className="bg-card border border-border p-6 lift-hover" data-testid={testid}>
      <div className="flex items-center justify-between mb-4">
        <span className="label-mono">{label}</span>
        <Icon size={18} weight="duotone" className={accent ? "text-primary" : "text-muted-foreground"} />
      </div>
      <div className="font-mono text-3xl sm:text-4xl font-bold tracking-tighter">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-2">{sub}</div>}
    </div>
  );
}

const PRIORITY = {
  high: "border-destructive text-destructive",
  medium: "border-primary text-primary",
  low: "border-muted-foreground text-muted-foreground",
};

export default function CommandCenter() {
  const navigate = useNavigate();
  const { business } = useAuth();
  const [data, setData] = useState(null);

  const load = async () => {
    const { data } = await api.get("/dashboard");
    setData(data);
  };
  useEffect(() => { load(); }, []);

  const m = data?.metrics || {};
  const money = (n) => `$${Number(n || 0).toLocaleString()}`;

  return (
    <div className="space-y-6 animate-fade-up" data-testid="command-center">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-mono mb-1">Business Command Center</p>
          <h1 className="font-heading text-3xl sm:text-4xl font-black tracking-tighter">
            {business?.name || "Your Business"}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground max-w-sm">
          Everything reporting into one place. Here's what's driving your growth right now.
        </p>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Growth score hero */}
        <div className="col-span-12 md:col-span-4 bg-card border border-border p-6 flex flex-col items-center justify-center" data-testid="growth-score-card">
          <GrowthGauge score={data?.growth_score ?? 0} />
          <p className="text-xs text-muted-foreground text-center mt-4 max-w-[220px]">
            A single number for how healthy your business is across sales, reputation & visibility.
          </p>
        </div>

        {/* Metrics bento */}
        <div className="col-span-12 md:col-span-8 grid grid-cols-2 lg:grid-cols-3 gap-4">
          <Metric testid="metric-revenue" label="Revenue (paid)" value={money(m.revenue)} sub={`${money(m.outstanding)} outstanding`} icon={CurrencyDollar} accent />
          <Metric testid="metric-pipeline" label="Open Pipeline" value={money(m.pipeline)} sub={`${m.leads || 0} active leads`} icon={TrendUp} />
          <Metric testid="metric-customers" label="Customers Won" value={m.customers ?? 0} sub="Closed deals" icon={Users} />
          <Metric testid="metric-seo" label="SEO Score" value={`${m.seo_score ?? 0}`} sub={m.seo_score ? "of 100" : "Run a scan"} icon={MagnifyingGlass} />
          <Metric testid="metric-reviews" label="Reputation" value={`${m.reviews_avg ?? 0}★`} sub={`${m.reviews_count || 0} reviews`} icon={Star} />
          <Metric testid="metric-jobs" label="Open Jobs" value={m.jobs ?? 0} sub={`${money(m.expenses)} est. costs`} icon={Kanban} />
        </div>
      </div>

      {/* Next best action + AI strategist */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-7 bg-card border border-border">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-border">
            <Lightning size={18} weight="fill" className="text-primary" />
            <h3 className="font-heading font-bold tracking-tight">Next Best Actions</h3>
          </div>
          <div className="divide-y divide-border" data-testid="next-best-actions">
            {(data?.actions || []).length === 0 && (
              <p className="px-6 py-8 text-sm text-muted-foreground">You're all caught up. Nice work.</p>
            )}
            {(data?.actions || []).map((a, i) => (
              <div key={i} className="flex items-start justify-between gap-4 px-6 py-4 group" data-testid={`action-${i}`}>
                <div className="flex items-start gap-3">
                  <span className={`mt-0.5 text-[10px] font-mono uppercase px-1.5 py-0.5 border ${PRIORITY[a.priority]}`}>{a.priority}</span>
                  <div>
                    <p className="font-semibold text-sm">{a.title}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{a.detail}</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate(`/${a.module}`)}
                  data-testid={`fix-action-${i}`}
                  className="shrink-0 inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 text-xs font-semibold hover:opacity-90 transition-opacity"
                >
                  Fix this for me <ArrowRight size={13} weight="bold" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-5 space-y-2">
          <div className="flex items-center gap-2">
            <Sparkle size={16} weight="fill" className="text-primary" />
            <span className="label-mono">AI Growth Strategist</span>
          </div>
          <AIStreamPanel
            feature="next_best_action"
            context={{ metrics: m }}
            title="Strategist"
            triggerLabel="Ask the AI strategist"
          />
        </div>
      </div>
    </div>
  );
}
