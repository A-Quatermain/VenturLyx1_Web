import { useState, useRef, useEffect } from "react";
import { CircleNotch } from "@phosphor-icons/react";
import { streamAI } from "@/lib/api";

// Reusable AI streaming terminal panel with review/approve
export default function AIStreamPanel({ feature, context, autoStart = false, title = "AI Output", onApprove, approveLabel = "Approve", triggerLabel = "Generate with AI" }) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState("idle"); // idle|streaming|done|error
  const [meta, setMeta] = useState(null);
  const [err, setErr] = useState("");
  const started = useRef(false);
  const boxRef = useRef(null);

  const run = async () => {
    setText(""); setErr(""); setMeta(null); setStatus("streaming");
    await streamAI(feature, context, {
      onMeta: (m) => setMeta(m),
      onDelta: (c) => setText((t) => t + c),
      onFallback: () => setMeta((m) => ({ ...(m || {}), fallback: true })),
      onDone: () => setStatus("done"),
      onError: (m) => { setErr(m); setStatus("error"); },
    });
  };

  useEffect(() => {
    if (autoStart && !started.current) { started.current = true; run(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  useEffect(() => { if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight; }, [text]);

  return (
    <div className="border border-border bg-foreground text-background" data-testid="ai-stream-panel">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-background/20">
        <span className="label-mono !text-background/70">{title}</span>
        {meta && (
          <span className="font-mono text-[10px] px-2 py-0.5 border border-background/30" data-testid="ai-model-badge">
            {meta.provider_label}{meta.fallback ? " · fallback" : ""} · {meta.model}
          </span>
        )}
      </div>
      <div ref={boxRef} className="p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap min-h-[120px] max-h-[420px] overflow-y-auto" data-testid="ai-stream-output">
        {status === "idle" && <span className="text-background/50">Ready. Click “{triggerLabel}”.</span>}
        {err && <span className="text-red-400">{err}</span>}
        <span className={status === "streaming" ? "terminal-cursor" : ""}>{text}</span>
      </div>
      <div className="flex items-center gap-2 px-4 py-3 border-t border-background/20">
        <button
          onClick={run}
          disabled={status === "streaming"}
          data-testid="ai-generate-btn"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {status === "streaming" && <CircleNotch size={14} className="animate-spin" />}
          {status === "streaming" ? "Generating…" : (text ? "Regenerate" : triggerLabel)}
        </button>
        {onApprove && status === "done" && text && (
          <button
            onClick={() => onApprove(text, meta)}
            data-testid="ai-approve-btn"
            className="bg-success text-success-foreground px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            {approveLabel}
          </button>
        )}
      </div>
    </div>
  );
}
