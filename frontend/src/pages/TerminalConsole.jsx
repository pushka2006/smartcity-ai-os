import { useState, useEffect, useRef } from "react";
import { http } from "../lib/api";
import { toast } from "../components/Toast";
import { Terminal, Copy } from "lucide-react";
import { useSecurity } from "../lib/SecurityContext";

const COMMANDS = ["help", "status", "agents", "ls", "neofetch", "whoami", "date", "scan", "deploy", "echo", "clear"];

export default function TerminalConsole() {
  const { verifyAction } = useSecurity();
  const [history, setHistory] = useState([
    { command: null, output: 'NEXUS Terminal v1.0.0\nType "help" for commands. Tab to auto-complete. Ctrl+L to clear.', timestamp: new Date().toISOString() }
  ]);
  const [input, setInput] = useState("");
  const [cmdHistory, setCmdHistory] = useState([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [tabIdx, setTabIdx] = useState(-1);
  const [tabMatches, setTabMatches] = useState([]);
  const bottomRef = useRef();
  const inputRef = useRef();

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [history]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Listen to terminal execution events triggered by voice commands
  useEffect(() => {
    const handleVoiceCommand = (e) => {
      if (e.detail) {
        setHistory(prev => [...prev, { command: e.detail.command, output: e.detail.output, timestamp: new Date().toISOString() }]);
      }
    };
    window.addEventListener("terminal-command-executed", handleVoiceCommand);
    return () => window.removeEventListener("terminal-command-executed", handleVoiceCommand);
  }, []);

  const exec = async (cmd) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;
    verifyAction(async () => {
      setCmdHistory(prev => [trimmed, ...prev.slice(0, 49)]);
      setHistIdx(-1);
      setTabIdx(-1);
      setTabMatches([]);
      try {
        const r = await http.post("/terminal/exec", { command: trimmed });
        if (r.data.output === "__CLEAR__") {
          setHistory([{ command: null, output: "Screen cleared.", timestamp: new Date().toISOString() }]);
        } else {
          setHistory(prev => [...prev, { command: trimmed, output: r.data.output, timestamp: r.data.timestamp }]);
        }
      } catch {
        setHistory(prev => [...prev, { command: trimmed, output: "Error: backend unreachable. Start the FastAPI server.", timestamp: new Date().toISOString() }]);
      }
    }, "terminal");
  };

  const onKey = (e) => {
    if (e.key === "Enter") {
      exec(input); setInput("");
    } else if (e.key === "Tab") {
      e.preventDefault();
      const base = input.split(" ")[0].toLowerCase();
      const matches = COMMANDS.filter(c => c.startsWith(base));
      if (matches.length === 1) {
        setInput(matches[0]);
        setTabMatches([]);
      } else if (matches.length > 1) {
        setTabMatches(matches);
        const ni = (tabIdx + 1) % matches.length;
        setTabIdx(ni);
        setInput(matches[ni]);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const ni = Math.min(histIdx + 1, cmdHistory.length - 1);
      setHistIdx(ni); setInput(cmdHistory[ni] || "");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const ni = Math.max(histIdx - 1, -1);
      setHistIdx(ni); setInput(ni === -1 ? "" : cmdHistory[ni]);
    } else if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      setHistory([{ command: null, output: "Screen cleared.", timestamp: new Date().toISOString() }]);
    } else if (e.key === "c" && e.ctrlKey) {
      setInput("");
    } else {
      setTabIdx(-1); setTabMatches([]);
    }
  };

  const copyOutput = (text) => {
    navigator.clipboard.writeText(text).then(() => toast.success("Output copied")).catch(() => toast.error("Copy failed"));
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div className="hud-label" style={{ marginBottom: 4 }}>SYSTEM CONSOLE</div>
        <h1 className="font-display nx-neon-cyan" style={{ fontSize: 26, fontWeight: 800 }}>NEXUS Terminal</h1>
        <p style={{ marginTop: 3, fontSize: 11, color: "rgba(148,163,184,0.5)", fontFamily: "monospace" }}>
          Tab: auto-complete · ↑↓: history · Ctrl+L: clear · Ctrl+C: cancel
        </p>
      </div>

      <div
        className="nx-glass"
        style={{ borderRadius: 14, overflow: "hidden", height: "calc(100vh - 226px)", display: "flex", flexDirection: "column", cursor: "text" }}
        onClick={() => inputRef.current?.focus()}
      >
        {/* Title bar */}
        <div style={{ padding: "9px 14px", borderBottom: "1px solid rgba(0,245,255,0.12)", display: "flex", alignItems: "center", gap: 8, background: "rgba(2,6,23,0.5)" }}>
          <div style={{ display: "flex", gap: 5 }}>
            {["#FF4D4D", "#FFC857", "#00FF88"].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c, opacity: 0.75 }} />)}
          </div>
          <Terminal style={{ width: 12, height: 12, color: "#00F5FF", marginLeft: 4 }} />
          <span style={{ fontFamily: "monospace", fontSize: 11, color: "rgba(148,163,184,0.55)" }}>nexus@os ~ bash</span>
          <span className="nx-blink" style={{ marginLeft: "auto", fontSize: 10, color: "#00FF88", fontFamily: "monospace" }}>● ONLINE</span>
        </div>

        {/* Tab hint bar */}
        {tabMatches.length > 1 && (
          <div style={{ padding: "4px 18px", background: "rgba(110,86,255,0.08)", borderBottom: "1px solid rgba(110,86,255,0.2)", display: "flex", gap: 8 }}>
            {tabMatches.map((m, i) => (
              <span key={m} style={{ fontSize: 11, color: i === tabIdx ? "#6E56FF" : "rgba(148,163,184,0.6)", fontFamily: "monospace", background: i === tabIdx ? "rgba(110,86,255,0.15)" : "transparent", padding: "1px 6px", borderRadius: 4 }}>{m}</span>
            ))}
          </div>
        )}

        {/* Output */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 18px", fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>
          {history.map((h, i) => (
            <div key={i} style={{ marginBottom: 10, position: "relative" }}
              onMouseEnter={e => { const btn = e.currentTarget.querySelector(".copy-btn"); if (btn) btn.style.opacity = "1"; }}
              onMouseLeave={e => { const btn = e.currentTarget.querySelector(".copy-btn"); if (btn) btn.style.opacity = "0"; }}
            >
              {h.command !== null && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <span style={{ color: "#6E56FF" }}>nexus@os</span>
                  <span style={{ color: "#FF2E88" }}>~</span>
                  <span style={{ color: "#00F5FF" }}>$</span>
                  <span style={{ color: "#e2e8f0" }}>{h.command}</span>
                </div>
              )}
              {h.output && (
                <pre style={{ margin: 0, color: "rgba(148,163,184,0.85)", whiteSpace: "pre-wrap", wordBreak: "break-all", lineHeight: 1.6, paddingLeft: h.command ? 12 : 0 }}>
                  {h.output}
                </pre>
              )}
              {h.output && (
                <button
                  className="copy-btn"
                  onClick={() => copyOutput(h.output)}
                  style={{ position: "absolute", top: 0, right: 0, opacity: 0, background: "rgba(15,23,42,0.9)", border: "1px solid rgba(0,245,255,0.2)", borderRadius: 5, color: "#00F5FF", cursor: "pointer", padding: "3px 7px", fontSize: 10, fontFamily: "monospace", transition: "opacity 0.15s", display: "flex", alignItems: "center", gap: 4 }}
                >
                  <Copy style={{ width: 10, height: 10 }} /> copy
                </button>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ borderTop: "1px solid rgba(0,245,255,0.1)", padding: "8px 18px", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: "#6E56FF", fontFamily: "monospace", fontSize: 12 }}>nexus@os</span>
          <span style={{ color: "#FF2E88", fontFamily: "monospace", fontSize: 12 }}>~</span>
          <span style={{ color: "#00F5FF", fontFamily: "monospace", fontSize: 12 }}>$</span>
          <input
            ref={inputRef}
            value={input}
            onChange={e => { setInput(e.target.value); setTabIdx(-1); setTabMatches([]); }}
            onKeyDown={onKey}
            placeholder="type a command…"
            style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#e2e8f0", fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}
            autoComplete="off"
            spellCheck={false}
          />
          <span className="nx-blink" style={{ color: "#00F5FF", fontSize: 14 }}>▍</span>
        </div>
      </div>
    </div>
  );
}
