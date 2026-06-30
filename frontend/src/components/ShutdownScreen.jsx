import { useState, useEffect } from "react";
import { useVoice } from "../lib/VoiceContext";
import { Power, RefreshCw, Terminal } from "lucide-react";

const SHUTDOWN_LOGS = [
  "OS_SHUTDOWN_VECTOR: INITIALIZED",
  "DEALLOCATING CORE MEMORY BUS...",
  "TERMINATING SIMULATED INTERACTIVE CHATS...",
  "PARKING LOCAL AGENT MATRIX GRID (13 STANDBY)...",
  "HALTING TERMINAL SIMULATION ENGINE...",
  "DISCONNECTING PORT 8000 BACKEND SOCKETS...",
  "RELEASING BIOMETRIC WEBCAM DRIVERS...",
  "FLUSHING DB_STORE LOCAL STORAGE CACHES...",
  "NEXUS CORE MODULES: HALTED SUCCESSFULLY",
  "SHIELD CONTROLLER OFFLINE.",
];

export default function ShutdownScreen() {
  const { isShutdown, rebootSystem } = useVoice();
  const [visibleLogs, setVisibleLogs] = useState([]);
  const [logIdx, setLogIdx] = useState(0);

  // Trigger diagnostic log scrolling sequence
  useEffect(() => {
    if (isShutdown) {
      setVisibleLogs([]);
      setLogIdx(0);
    }
  }, [isShutdown]);

  useEffect(() => {
    if (!isShutdown) return;
    if (logIdx >= SHUTDOWN_LOGS.length) return;

    const delay = logIdx === 0 ? 300 : logIdx === SHUTDOWN_LOGS.length - 1 ? 600 : 200;
    const timer = setTimeout(() => {
      const timestamp = new Date().toLocaleTimeString();
      setVisibleLogs(prev => [...prev, `[${timestamp}] ${SHUTDOWN_LOGS[logIdx]}`]);
      setLogIdx(prev => prev + 1);
    }, delay);

    return () => clearTimeout(timer);
  }, [isShutdown, logIdx]);

  if (!isShutdown) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 10000,
        background: "#000000", color: "#f87171",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: 30, overflow: "hidden", fontFamily: "monospace"
      }}
    >
      {/* Scanline CRT overlay */}
      <div
        style={{
          position: "absolute", inset: 0, pointerEvents: "none", zIndex: 10,
          background: "linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%)",
          backgroundSize: "100% 4px"
        }}
      />

      <div style={{ maxWidth: 540, width: "100%", zIndex: 20, display: "flex", flexDirection: "column", gap: 30 }}>
        {/* Glowing offline status */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          <div
            style={{
              display: "inline-flex", width: 50, height: 50, borderRadius: "50%",
              background: "rgba(239, 68, 68, 0.08)", border: "2px solid #ef4444",
              alignItems: "center", justifyContent: "center", marginBottom: 16,
              boxShadow: "0 0 20px rgba(239, 68, 68, 0.4)",
              animation: "nexus-blink 1.8s infinite"
            }}
          >
            <Power style={{ width: 22, height: 22, color: "#ef4444" }} />
          </div>

          <h1
            className="font-display"
            style={{
              fontSize: 22, fontWeight: 900, color: "#ef4444",
              letterSpacing: "0.2em", textShadow: "0 0 8px rgba(239,68,68,0.5)",
              marginBottom: 4
            }}
          >
            SYSTEM OFFLINE
          </h1>
          <p style={{ fontSize: 10.5, color: "rgba(239, 68, 68, 0.5)" }}>
            NEXUS CORE INTELLIGENCE SHIELD HAS BEEN TERMINATED BY OPERATOR.
          </p>
        </div>

        {/* Scroll Logs console */}
        <div
          className="nx-glass"
          style={{
            borderRadius: 12, padding: "16px 20px", height: 180, overflowY: "auto",
            background: "rgba(2, 6, 23, 0.95)", border: "1px solid rgba(239, 68, 68, 0.22)",
            boxShadow: "0 0 20px rgba(239, 68, 68, 0.05) inset", display: "flex", flexDirection: "column", gap: 4
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, borderBottom: "1px solid rgba(239, 68, 68, 0.12)", paddingBottom: 6 }}>
            <Terminal style={{ width: 12, height: 12, color: "rgba(239, 68, 68, 0.5)" }} />
            <span style={{ fontSize: 9, color: "rgba(239, 68, 68, 0.55)", letterSpacing: "0.1em" }}>CORE_SHUTDOWN_DIAGNOSTICS</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 10.5, color: "#f87171" }}>
            {visibleLogs.map((log, i) => (
              <div key={i} style={{ lineBreak: "anywhere" }}>{log}</div>
            ))}
            {logIdx < SHUTDOWN_LOGS.length && (
              <span className="nx-caret" style={{ color: "#ef4444" }} />
            )}
          </div>
        </div>

        {/* Reboot Action button */}
        {logIdx >= SHUTDOWN_LOGS.length && (
          <div style={{ display: "flex", justifyContent: "center", animation: "nx-fadeIn 0.4s ease forwards" }}>
            <button
              onClick={rebootSystem}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "12px 28px", borderRadius: 10,
                background: "rgba(0, 255, 136, 0.08)", border: "2px solid rgba(0, 255, 136, 0.4)",
                color: "#00FF88", cursor: "pointer", fontSize: 13,
                fontFamily: "monospace", fontWeight: 700, letterSpacing: "0.1em",
                boxShadow: "0 0 20px rgba(0, 255, 136, 0.15)", transition: "all 0.2s"
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = "rgba(0, 255, 136, 0.16)";
                e.currentTarget.style.boxShadow = "0 0 25px rgba(0, 255, 136, 0.35)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = "rgba(0, 255, 136, 0.08)";
                e.currentTarget.style.boxShadow = "0 0 20px rgba(0, 255, 136, 0.15)";
              }}
            >
              <RefreshCw style={{ width: 14, height: 14 }} className="nx-pulse" />
              REBOOT SYSTEM
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
