import axios from "axios";

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";
export const API = `${BACKEND_URL}/api`;

export const http = axios.create({ baseURL: API });

export async function streamChat({ session_id, agent, message, onMeta, onDelta, onDone, onError }) {
  const res = await fetch(`${API}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id, agent, message }),
  });
  if (!res.ok || !res.body) {
    onError && onError(new Error(`HTTP ${res.status}`));
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() || "";
    for (const p of parts) {
      const line = p.trim();
      if (!line.startsWith("data:")) continue;
      try {
        const evt = JSON.parse(line.slice(5).trim());
        if (evt.type === "meta") onMeta && onMeta(evt);
        else if (evt.type === "delta") onDelta && onDelta(evt.content);
        else if (evt.type === "done") onDone && onDone();
        else if (evt.type === "error") onError && onError(new Error(evt.content));
      } catch (e) { /* ignore parse errors */ }
    }
  }
  onDone && onDone();
}
