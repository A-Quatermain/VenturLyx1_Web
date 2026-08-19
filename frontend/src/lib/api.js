import axios from "axios";

const BACKEND = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND}/api`;

export const api = axios.create({ baseURL: API, withCredentials: true });

export function apiErr(e, fallback = "Something went wrong. Please try again.") {
  const detail = e?.response?.data?.detail;
  if (detail == null) return e?.message || fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((d) => (d && typeof d.msg === "string" ? d.msg : JSON.stringify(d))).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

// Streaming AI helper (SSE over fetch POST)
export async function streamAI(feature, context, { onMeta, onDelta, onDone, onError, onFallback } = {}) {
  try {
    const res = await fetch(`${API}/ai/generate/stream`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feature, context }),
    });
    if (!res.ok || !res.body) {
      onError && onError("The AI service is unavailable right now.");
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop();
      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith("data:")) continue;
        let ev;
        try { ev = JSON.parse(line.slice(5).trim()); } catch { continue; }
        if (ev.type === "meta") onMeta && onMeta(ev);
        else if (ev.type === "delta") onDelta && onDelta(ev.content);
        else if (ev.type === "fallback_notice") onFallback && onFallback(ev.failed_provider);
        else if (ev.type === "done") onDone && onDone(ev);
        else if (ev.type === "error") onError && onError(ev.message);
      }
    }
  } catch (e) {
    onError && onError(e.message || "Stream failed");
  }
}
