import { useEffect, useState } from "react";
import { Star, Plus, Sparkle, ChatCircle, CheckCircle } from "@phosphor-icons/react";
import { toast } from "sonner";
import { api, apiErr, streamAI } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";

const inputCls = "w-full border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

function Stars({ n }) {
  return <span className="inline-flex">{[1, 2, 3, 4, 5].map((i) => <Star key={i} size={14} weight={i <= n ? "fill" : "regular"} className={i <= n ? "text-primary" : "text-muted-foreground/40"} />)}</span>;
}

export default function Reviews() {
  const [rows, setRows] = useState([]);
  const load = async () => setRows((await api.get("/reviews")).data);
  useEffect(() => { load(); }, []);

  const avg = rows.length ? (rows.reduce((s, r) => s + r.rating, 0) / rows.length).toFixed(1) : "0.0";
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, c: rows.filter((r) => r.rating === n).length }));

  return (
    <div className="space-y-6 animate-fade-up" data-testid="reviews-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-mono mb-1">Reviews &amp; Reputation</p>
          <h1 className="font-heading text-3xl sm:text-4xl font-black tracking-tighter">Protect Your Reputation</h1>
        </div>
        <AddReview reload={load} />
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-3 bg-foreground text-background p-6 flex flex-col items-center justify-center">
          <div className="font-mono text-6xl font-black tracking-tighter" data-testid="review-avg">{avg}</div>
          <Stars n={Math.round(avg)} />
          <div className="label-mono !text-background/60 mt-3">{rows.length} reviews</div>
        </div>
        <div className="col-span-12 md:col-span-9 bg-card border border-border p-6 flex flex-col justify-center gap-2">
          {dist.map(({ n, c }) => (
            <div key={n} className="flex items-center gap-3">
              <span className="font-mono text-xs w-4">{n}★</span>
              <div className="flex-1 h-2 bg-muted"><div className="h-full bg-primary" style={{ width: `${rows.length ? (c / rows.length) * 100 : 0}%` }} /></div>
              <span className="font-mono text-xs w-8 text-right">{c}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {rows.map((r) => <ReviewCard key={r.id} review={r} reload={load} />)}
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No reviews yet. Add one to try AI responses.</p>}
      </div>
    </div>
  );
}

function ReviewCard({ review, reload }) {
  const [draft, setDraft] = useState(review.response || "");
  const [streaming, setStreaming] = useState(false);
  const [meta, setMeta] = useState(null);

  const generate = async () => {
    setDraft(""); setStreaming(true); setMeta(null);
    await streamAI("review_response", { rating: review.rating, author: review.author, text: review.text }, {
      onMeta: (m) => setMeta(m),
      onDelta: (c) => setDraft((d) => d + c),
      onDone: () => setStreaming(false),
      onError: (m) => { toast.error(m); setStreaming(false); },
    });
  };

  const approve = async () => {
    try { await api.put(`/reviews/${review.id}`, { response: draft, response_status: "approved" }); toast.success("Response approved"); reload(); }
    catch (e) { toast.error(apiErr(e)); }
  };

  return (
    <div className="bg-card border border-border p-6" data-testid={`review-${review.id}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3"><span className="font-semibold text-sm">{review.author}</span><Stars n={review.rating} /><span className="label-mono">{review.source}</span></div>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{review.text}</p>
        </div>
        {review.response_status === "approved" && <span className="inline-flex items-center gap-1 text-xs text-success font-mono"><CheckCircle size={14} weight="fill" /> Replied</span>}
      </div>

      {(draft || streaming) && (
        <div className="mt-4 border border-border bg-foreground text-background p-4 font-mono text-xs whitespace-pre-wrap" data-testid={`review-draft-${review.id}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="label-mono !text-background/60">Draft reply</span>
            {meta && <span className="text-[10px] px-2 py-0.5 border border-background/30">{meta.provider_label} · {meta.model}</span>}
          </div>
          <span className={streaming ? "terminal-cursor" : ""}>{draft}</span>
        </div>
      )}

      <div className="flex items-center gap-2 mt-4">
        <button onClick={generate} disabled={streaming} data-testid={`ai-reply-btn-${review.id}`} className="inline-flex items-center gap-2 border border-border px-3 py-2 text-xs font-semibold hover:bg-accent disabled:opacity-50 transition-colors">
          <Sparkle size={14} weight="fill" className="text-primary" /> {streaming ? "Drafting…" : draft ? "Regenerate" : "Draft AI response"}
        </button>
        {draft && !streaming && (
          <button onClick={approve} data-testid={`approve-reply-btn-${review.id}`} className="inline-flex items-center gap-2 bg-success text-success-foreground px-3 py-2 text-xs font-semibold hover:opacity-90 transition-opacity">
            <ChatCircle size={14} weight="fill" /> Approve &amp; publish
          </button>
        )}
      </div>
    </div>
  );
}

function AddReview({ reload }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ author: "", rating: 5, text: "", source: "Google" });
  const save = async () => {
    if (!f.author.trim()) return toast.error("Author is required");
    try { await api.post("/reviews", { ...f, rating: Number(f.rating) }); setOpen(false); setF({ author: "", rating: 5, text: "", source: "Google" }); reload(); }
    catch (e) { toast.error(apiErr(e)); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><button data-testid="add-review-btn" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold"><Plus size={16} weight="bold" /> Add Review</button></DialogTrigger>
      <DialogContent className="rounded-none border border-border">
        <DialogHeader><DialogTitle className="font-heading">Add Review</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><label className="label-mono block mb-1.5">Author</label><input data-testid="review-author-input" className={inputCls} value={f.author} onChange={(e) => setF({ ...f, author: e.target.value })} /></div>
          <div><label className="label-mono block mb-1.5">Rating</label>
            <select data-testid="review-rating-select" className={inputCls} value={f.rating} onChange={(e) => setF({ ...f, rating: e.target.value })}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} stars</option>)}</select>
          </div>
          <div><label className="label-mono block mb-1.5">Review text</label><textarea data-testid="review-text-input" className={inputCls} rows={3} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} /></div>
        </div>
        <DialogFooter><button onClick={save} data-testid="save-review-btn" className="bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold">Save</button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
