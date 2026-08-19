import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ArrowLeft, Buildings } from "@phosphor-icons/react";
import { toast } from "sonner";
import { api, apiErr } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const INDUSTRIES = ["Home Services", "HVAC", "Landscaping", "Cleaning", "Dental / Medical", "Legal", "Restaurant / Cafe", "Retail", "Fitness", "Real Estate", "E-commerce", "Other"];

export default function Onboarding() {
  const navigate = useNavigate();
  const { setBusiness, loadBusiness } = useAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ name: "", website: "", industry: "", service_area: "" });
  const [loading, setLoading] = useState(false);

  const steps = [
    { key: "name", label: "What's your business called?", placeholder: "e.g. Alvarez HVAC", type: "text" },
    { key: "industry", label: "What industry are you in?", type: "select" },
    { key: "website", label: "What's your website? (optional)", placeholder: "yourbusiness.com", type: "text" },
    { key: "service_area", label: "Where do you serve customers?", placeholder: "e.g. Austin, TX", type: "text" },
  ];
  const current = steps[step];

  const next = async () => {
    if (step < steps.length - 1) { setStep(step + 1); return; }
    setLoading(true);
    try {
      const { data } = await api.post("/business", form);
      setBusiness(data);
      await loadBusiness();
      toast.success("Your command center is ready.");
      navigate("/dashboard", { replace: true });
    } catch (e) {
      toast.error(apiErr(e));
    } finally {
      setLoading(false);
    }
  };

  const canNext = current.key === "name" ? form.name.trim().length > 1 : current.key === "industry" ? !!form.industry : true;

  return (
    <div className="min-h-screen grid place-items-center bg-background dot-grid p-6">
      <div className="w-full max-w-lg bg-card border border-border p-8 sm:p-10">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-7 h-7 bg-primary grid place-items-center">
            <span className="font-heading font-black text-primary-foreground leading-none">V</span>
          </div>
          <span className="label-mono">Business Setup · {step + 1} of {steps.length}</span>
        </div>

        <div className="flex gap-1.5 mb-8">
          {steps.map((_, i) => (
            <div key={i} className={`h-1 flex-1 ${i <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>

        <div className="flex items-center gap-2 mb-2 text-muted-foreground">
          <Buildings size={18} weight="duotone" />
          <span className="label-mono">Tell us about your business</span>
        </div>
        <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight mb-6" data-testid="onboarding-question">
          {current.label}
        </h2>

        {current.type === "select" ? (
          <div className="grid grid-cols-2 gap-2 mb-8">
            {INDUSTRIES.map((ind) => (
              <button
                key={ind}
                data-testid={`industry-${ind.toLowerCase().replace(/[^a-z]/g, "-")}`}
                onClick={() => setForm({ ...form, industry: ind })}
                className={`border px-3 py-2.5 text-sm text-left transition-colors ${
                  form.industry === ind ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:border-foreground"
                }`}
              >
                {ind}
              </button>
            ))}
          </div>
        ) : (
          <input
            data-testid="onboarding-input"
            autoFocus
            className="w-full border border-input bg-background px-4 py-3 text-lg mb-8 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-card"
            placeholder={current.placeholder}
            value={form[current.key]}
            onChange={(e) => setForm({ ...form, [current.key]: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && canNext && next()}
          />
        )}

        <div className="flex items-center justify-between">
          <button
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            data-testid="onboarding-back"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground disabled:opacity-30 hover:text-foreground transition-colors"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <button
            onClick={next}
            disabled={!canNext || loading}
            data-testid="onboarding-next"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? "Building…" : step === steps.length - 1 ? "Launch command center" : "Continue"}
            {!loading && <ArrowRight size={16} weight="bold" />}
          </button>
        </div>
      </div>
    </div>
  );
}
