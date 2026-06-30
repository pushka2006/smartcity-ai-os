// Global toast system — call toast.success/error/info/warning from anywhere
import { useState, useEffect, useCallback, createContext, useContext, useRef } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";

const ToastCtx = createContext(null);

let _add = null;
export const toast = {
  success: (msg, opts) => _add?.({ type: "success", msg, ...opts }),
  error:   (msg, opts) => _add?.({ type: "error",   msg, ...opts }),
  info:    (msg, opts) => _add?.({ type: "info",     msg, ...opts }),
  warning: (msg, opts) => _add?.({ type: "warning",  msg, ...opts }),
};

const ICONS  = { success: CheckCircle2, error: XCircle, warning: AlertTriangle, info: Info };
const COLORS = { success: "#00FF88", error: "#FF4D4D", warning: "#FFC857", info: "#00F5FF" };

function ToastItem({ t, onRemove }) {
  const Icon = ICONS[t.type] || Info;
  const color = COLORS[t.type];
  useEffect(() => {
    const id = setTimeout(() => onRemove(t.id), t.duration || 3500);
    return () => clearTimeout(id);
  }, [t.id, t.duration, onRemove]);

  return (
    <div
      className="nx-fadein"
      style={{
        display: "flex", alignItems: "flex-start", gap: 10,
        padding: "12px 14px", borderRadius: 10, minWidth: 260, maxWidth: 380,
        background: "rgba(6,13,34,0.92)", backdropFilter: "blur(16px)",
        border: `1px solid ${color}44`,
        boxShadow: `0 4px 24px rgba(0,0,0,0.5), 0 0 12px ${color}18`,
        fontFamily: "monospace",
      }}
    >
      <Icon style={{ width: 15, height: 15, color, marginTop: 1, flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 12.5, color: "#e2e8f0", lineHeight: 1.45 }}>{t.msg}</span>
      <button
        onClick={() => onRemove(t.id)}
        style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(148,163,184,0.5)", padding: 0, lineHeight: 1, flexShrink: 0 }}
      >
        <X style={{ width: 12, height: 12 }} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const add = useCallback((t) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev.slice(-4), { ...t, id }]);
  }, []);

  const remove = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => { _add = add; return () => { _add = null; }; }, [add]);

  return (
    <ToastCtx.Provider value={{ add, remove }}>
      {children}
      <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8 }}>
        {toasts.map(t => <ToastItem key={t.id} t={t} onRemove={remove} />)}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() { return useContext(ToastCtx); }
