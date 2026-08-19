import { Lock } from "@phosphor-icons/react";

const COPY = {
  Build: { tagline: "Idea → Launch", desc: "Validate your idea, research your market, generate a business blueprint, branding, website & domain — all with AI." },
  Source: { tagline: "Find & Vet Suppliers", desc: "Supplier discovery, manufacturer matching, RFQs, cost comparisons, samples and a vendor database." },
  Grow: { tagline: "Fill Your Pipeline", desc: "Lead generation, email & SMS campaigns, funnels, social and advertising that converts." },
  "AI Team": { tagline: "Your 24/7 Staff", desc: "AI receptionist, sales assistant, SEO specialist, operations & marketing assistants — working around the clock." },
};

export default function LockedModule({ name }) {
  const c = COPY[name] || { tagline: "Coming soon", desc: "" };
  return (
    <div className="animate-fade-up" data-testid={`locked-module-${name.toLowerCase().replace(/\s/g, "-")}`}>
      <div className="relative border border-border bg-card overflow-hidden">
        <div className="absolute inset-0 dot-grid opacity-40" />
        <div className="relative p-10 sm:p-16 max-w-2xl">
          <div className="inline-flex items-center gap-2 border border-border px-3 py-1 mb-8 label-mono"><Lock size={13} weight="bold" /> Coming soon</div>
          <p className="label-mono mb-2">{c.tagline}</p>
          <h1 className="font-heading text-4xl sm:text-6xl font-black tracking-tighter leading-none mb-6">{name}</h1>
          <p className="text-base text-muted-foreground leading-relaxed max-w-lg">{c.desc}</p>
          <div className="mt-10 flex items-center gap-3">
            <div className="h-1 w-24 bg-primary" />
            <span className="label-mono">On the roadmap</span>
          </div>
        </div>
      </div>
    </div>
  );
}
