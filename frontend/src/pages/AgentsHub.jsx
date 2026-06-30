import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { streamChat } from "../lib/api";
import { toast } from "../components/Toast";
import { Send, X, Loader, ExternalLink } from "lucide-react";

const AGENTS = [
  { key: "nexus-core", name: "NEXUS Core",    color: "#00F5FF", emoji: "⬡", role: "Central AI orchestrator", specialty: "General intelligence, coordination", badge: "CORE" },
  { key: "planner",    name: "Planner",        color: "#6E56FF", emoji: "📋", role: "Task planning & strategy", specialty: "Project breakdown, roadmaps, prioritization", badge: "PLAN" },
  { key: "researcher", name: "Researcher",     color: "#7dd3fc", emoji: "🔬", role: "Deep research & analysis", specialty: "Web research, data gathering, synthesis", badge: "RSCH" },
  { key: "developer",  name: "Developer",      color: "#00FF88", emoji: "💻", role: "Full-stack software engineer", specialty: "Code generation, architecture, implementation", badge: "DEV" },
  { key: "debugger",   name: "Debugger",       color: "#FF4D4D", emoji: "🐛", role: "Bug hunting & root cause analysis", specialty: "Error tracing, debugging, stack analysis", badge: "DBG" },
  { key: "tester",     name: "Tester",         color: "#FFC857", emoji: "🧪", role: "QA & test automation", specialty: "Unit tests, integration tests, coverage", badge: "TEST" },
  { key: "documenter", name: "Documenter",     color: "#FF2E88", emoji: "📝", role: "Technical writing", specialty: "API docs, READMEs, user guides", badge: "DOC" },
  { key: "security",   name: "Security",       color: "#FF4D4D", emoji: "🛡", role: "Security auditor", specialty: "Vulnerability assessment, threat modeling", badge: "SEC" },
  { key: "manager",    name: "Project Mgr",    color: "#FF2E88", emoji: "🗂", role: "Project coordination", specialty: "Agile sprints, stakeholder comms", badge: "PM" },
  { key: "memory",     name: "Memory Agent",   color: "#6E56FF", emoji: "🧠", role: "Long-term memory management", specialty: "Knowledge retrieval, context retention", badge: "MEM" },
  { key: "browser",    name: "Browser Agent",  color: "#00F5FF", emoji: "🌐", role: "Web automation specialist", specialty: "Playwright, web scraping, navigation", badge: "WEB" },
  { key: "terminal",   name: "Terminal Agent", color: "#00FF88", emoji: "⌨",  role: "System operations", specialty: "Shell commands, scripts, automation", badge: "SYS" },
  { key: "deployer",   name: "Deployer",       color: "#FFC857", emoji: "🚀", role: "Deployment & DevOps", specialty: "CI/CD, Docker, cloud infrastructure", badge: "OPS" },
];

function AgentModal({ agent, onClose }) {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [reply, setReply] = useState("");
  const [streaming, setStreaming] = useState(false);

  const send = async () => {
    if (!input.trim() || streaming) return;
    const msg = input.trim();
    setInput(""); setReply(""); setStreaming(true);
    await streamChat({
      agent: agent.key, message: msg,
      onDelta: c => setReply(p => p + c),
      onDone: () => setStreaming(false),
      onError: () => { setStreaming(false); toast.error("Chat failed — is backend running?"); },
    });
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(2,6,23,0.8)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={onClose}
    >
      <div onClick={e => e.stopPropagation()} className="nx-fadein"
        style={{ width: "100%", maxWidth: 580, borderRadius: 18, background: "rgba(6,13,34,0.97)", border: `1px solid ${agent.color}44`, boxShadow: `0 32px 80px rgba(0,0,0,0.7), 0 0 60px ${agent.color}18`, overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "80vh" }}
      >
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${agent.color}22`, background: `${agent.color}08`, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: "50%", background: `${agent.color}20`, border: `2px solid ${agent.color}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{agent.emoji}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: agent.color, fontFamily: "'Space Grotesk',sans-serif" }}>{agent.name}</div>
            <div style={{ fontSize: 11, color: "rgba(148,163,184,0.6)", fontFamily: "monospace" }}>{agent.role}</div>
          </div>
          <button onClick={() => { navigate(`/chat`); onClose(); }} title="Open in full chat" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, cursor: "pointer", color: "rgba(148,163,184,0.6)", padding: "5px 8px", display: "flex" }}>
            <ExternalLink style={{ width: 13, height: 13 }} />
          </button>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(148,163,184,0.5)", padding: 2, display: "flex" }}>
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Reply area */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", minHeight: 120 }}>
          {reply ? (
            <div>
              <div style={{ fontSize: 10, color: agent.color, fontFamily: "monospace", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.12em" }}>{agent.name} ▸</div>
              <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.65, fontFamily: "monospace", whiteSpace: "pre-wrap" }}>
                {reply}{streaming && <span className="nx-caret" />}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 100, gap: 8, color: "rgba(148,163,184,0.3)" }}>
              <div style={{ fontSize: 28 }}>{agent.emoji}</div>
              <div style={{ fontSize: 12, fontFamily: "monospace" }}>Ask {agent.name} anything…</div>
              <div style={{ fontSize: 10.5, fontFamily: "monospace", textAlign: "center", color: "rgba(148,163,184,0.2)", maxWidth: 280 }}>Specialty: {agent.specialty}</div>
            </div>
          )}
        </div>

        {/* Input */}
        <div style={{ padding: "12px 16px", borderTop: `1px solid ${agent.color}22`, display: "flex", gap: 8 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") send(); }}
            placeholder={`Message ${agent.name}…`}
            style={{ flex: 1, background: "rgba(15,23,42,0.8)", border: `1px solid ${agent.color}30`, borderRadius: 9, color: "#e2e8f0", padding: "9px 13px", fontSize: 13, fontFamily: "monospace", outline: "none" }}
            autoFocus
          />
          <button onClick={send} disabled={streaming || !input.trim()}
            style={{ padding: "9px 14px", borderRadius: 9, background: `${agent.color}18`, border: `1px solid ${agent.color}44`, color: agent.color, cursor: "pointer", opacity: streaming || !input.trim() ? 0.4 : 1 }}
          >
            {streaming ? <Loader style={{ width: 14, height: 14, animation: "nx-spin-slow 1s linear infinite" }} /> : <Send style={{ width: 14, height: 14 }} />}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AgentsHub() {
  const [selected, setSelected] = useState(null);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div className="hud-label" style={{ marginBottom: 4 }}>AGENT NETWORK</div>
        <h1 className="font-display nx-neon-cyan" style={{ fontSize: 26, fontWeight: 800 }}>13 Specialized AI Agents</h1>
        <p style={{ marginTop: 4, fontSize: 11, color: "rgba(148,163,184,0.5)", fontFamily: "monospace" }}>Click any card to open a quick chat with that agent</p>
      </div>

      {selected && <AgentModal agent={selected} onClose={() => setSelected(null)} />}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
        {AGENTS.map(a => (
          <div
            key={a.key}
            className="nx-glass nx-fadein"
            onClick={() => setSelected(a)}
            style={{ borderRadius: 14, padding: "18px 20px", cursor: "pointer", borderColor: `${a.color}22`, transition: "all 0.22s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = `${a.color}55`; e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = `0 12px 32px ${a.color}18`; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = `${a.color}22`; e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}
          >
            {/* Agent header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: `${a.color}18`, border: `1.5px solid ${a.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{a.emoji}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", fontFamily: "'Space Grotesk',sans-serif" }}>{a.name}</div>
                <div style={{ fontSize: 9.5, color: a.color, background: `${a.color}14`, padding: "1px 6px", borderRadius: 4, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.1em", display: "inline-block", marginTop: 3 }}>{a.badge}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: a.color, display: "inline-block" }} className="nx-pulse" />
                <span style={{ fontSize: 9, color: a.color, fontFamily: "monospace" }}>ONLINE</span>
              </div>
            </div>

            <p style={{ fontSize: 12, color: "rgba(148,163,184,0.7)", fontFamily: "monospace", marginBottom: 8, lineHeight: 1.5 }}>{a.role}</p>
            <p style={{ fontSize: 10.5, color: "rgba(148,163,184,0.4)", fontFamily: "monospace", lineHeight: 1.45 }}>Specialty: {a.specialty}</p>

            <div style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "center", padding: "6px", borderRadius: 8, border: `1px solid ${a.color}22`, background: `${a.color}06`, transition: "all 0.15s" }}>
              <span style={{ fontSize: 11, color: a.color, fontFamily: "monospace" }}>Click to chat →</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
