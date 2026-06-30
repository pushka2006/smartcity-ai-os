// Global Command Palette — triggered by Ctrl+K
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Cpu, MessageSquare, Network, Brain, Library, Code2, Terminal,
  Globe, ListTodo, Activity, Settings, Search, Zap, ChevronRight, Camera
} from "lucide-react";

const COMMANDS = [
  // Navigation
  { id: "nav-cmd",     label: "Command Center",   desc: "Dashboard & AI overview",    icon: Cpu,          to: "/",          category: "Navigate" },
  { id: "nav-chat",    label: "Chat Hub",          desc: "Talk to any agent",          icon: MessageSquare, to: "/chat",      category: "Navigate" },
  { id: "nav-agents",  label: "Agent Network",     desc: "13 specialized AI agents",   icon: Network,      to: "/agents",    category: "Navigate" },
  { id: "nav-memory",  label: "Memory Vault",      desc: "Long-term knowledge store",  icon: Brain,        to: "/memory",    category: "Navigate" },
  { id: "nav-kb",      label: "Knowledge Base",    desc: "RAG document store",         icon: Library,      to: "/knowledge", category: "Navigate" },
  { id: "nav-code",    label: "Code Assistant",    desc: "AI-powered coding",          icon: Code2,        to: "/code",      category: "Navigate" },
  { id: "nav-term",    label: "Terminal Console",  desc: "NEXUS shell",                icon: Terminal,     to: "/terminal",  category: "Navigate" },
  { id: "nav-browser", label: "Browser Agent",     desc: "Web automation planner",     icon: Globe,        to: "/browser",   category: "Navigate" },
  { id: "nav-tasks",   label: "Task Manager",      desc: "Kanban task board",          icon: ListTodo,     to: "/tasks",     category: "Navigate" },
  { id: "nav-monitor", label: "System Monitor",    desc: "Live metrics & charts",      icon: Activity,     to: "/monitor",   category: "Navigate" },
  { id: "nav-camera",  label: "Camera Console",    desc: "Live video feed & captures", icon: Camera,        to: "/camera",    category: "Navigate" },
  { id: "nav-settings",label: "Settings",          desc: "Configuration & API keys",   icon: Settings,     to: "/settings",  category: "Navigate" },
  // Actions
  { id: "act-newmem",  label: "New Memory",        desc: "Add to memory vault",        icon: Brain,        to: "/memory?new=1", category: "Action" },
  { id: "act-newtask", label: "New Task",          desc: "Create a task",              icon: ListTodo,     to: "/tasks?new=1",  category: "Action" },
  { id: "act-newchat", label: "New Chat Session",  desc: "Start a fresh conversation", icon: MessageSquare, to: "/chat?new=1",  category: "Action" },
  { id: "act-generate",label: "Generate Code",     desc: "Open code generator",        icon: Code2,        to: "/code?action=generate", category: "Action" },
  { id: "act-debug",   label: "Debug Code",        desc: "Open debugger",              icon: Code2,        to: "/code?action=debug",    category: "Action" },
];

export default function CommandPalette({ open, onClose }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef();
  const navigate = useNavigate();

  const filtered = COMMANDS.filter(c =>
    !query || c.label.toLowerCase().includes(query.toLowerCase()) || c.desc.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (open) { setQuery(""); setActive(0); setTimeout(() => inputRef.current?.focus(), 50); }
  }, [open]);

  useEffect(() => { setActive(0); }, [query]);

  const run = useCallback((cmd) => {
    navigate(cmd.to);
    onClose();
  }, [navigate, onClose]);

  const onKey = (e) => {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => Math.min(a + 1, filtered.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    if (e.key === "Enter" && filtered[active]) { run(filtered[active]); }
  };

  if (!open) return null;

  const categories = [...new Set(filtered.map(c => c.category))];

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 10000, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "14vh", background: "rgba(2,6,23,0.75)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 560, borderRadius: 16, overflow: "hidden", background: "rgba(6,13,34,0.96)", border: "1px solid rgba(0,245,255,0.25)", boxShadow: "0 32px 80px rgba(0,0,0,0.7), 0 0 40px rgba(0,245,255,0.1)" }}
      >
        {/* Search bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderBottom: "1px solid rgba(0,245,255,0.12)" }}>
          <Search style={{ width: 16, height: 16, color: "rgba(0,245,255,0.6)", flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder="Search commands, pages, actions…"
            style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#e2e8f0", fontSize: 14, fontFamily: "monospace" }}
          />
          <kbd style={{ fontSize: 10, color: "rgba(148,163,184,0.45)", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 5, padding: "2px 6px", fontFamily: "monospace" }}>ESC</kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 380, overflowY: "auto" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "32px 0", textAlign: "center", color: "rgba(148,163,184,0.35)", fontSize: 13, fontFamily: "monospace" }}>No results for "{query}"</div>
          ) : (
            categories.map(cat => (
              <div key={cat}>
                <div style={{ padding: "8px 18px 4px", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(0,245,255,0.5)", fontFamily: "monospace" }}>{cat}</div>
                {filtered.filter(c => c.category === cat).map((cmd, i) => {
                  const globalIdx = filtered.indexOf(cmd);
                  const Icon = cmd.icon;
                  const isActive = globalIdx === active;
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => run(cmd)}
                      onMouseEnter={() => setActive(globalIdx)}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", gap: 12,
                        padding: "9px 18px", border: "none", cursor: "pointer", textAlign: "left",
                        background: isActive ? "rgba(0,245,255,0.08)" : "transparent",
                        transition: "background 0.1s",
                        borderLeft: isActive ? "2px solid #00F5FF" : "2px solid transparent",
                      }}
                    >
                      <div style={{ width: 28, height: 28, borderRadius: 7, background: isActive ? "rgba(0,245,255,0.15)" : "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Icon style={{ width: 13, height: 13, color: isActive ? "#00F5FF" : "rgba(148,163,184,0.6)" }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: isActive ? "#e2e8f0" : "rgba(226,232,240,0.75)", fontFamily: "monospace", fontWeight: isActive ? 600 : 400 }}>{cmd.label}</div>
                        <div style={{ fontSize: 11, color: "rgba(148,163,184,0.45)", fontFamily: "monospace" }}>{cmd.desc}</div>
                      </div>
                      {isActive && <ChevronRight style={{ width: 13, height: 13, color: "#00F5FF", flexShrink: 0 }} />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div style={{ padding: "8px 18px", borderTop: "1px solid rgba(0,245,255,0.08)", display: "flex", gap: 16, fontSize: 10, color: "rgba(148,163,184,0.4)", fontFamily: "monospace" }}>
          <span><kbd style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 3, padding: "1px 5px" }}>↑↓</kbd> navigate</span>
          <span><kbd style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 3, padding: "1px 5px" }}>↵</kbd> select</span>
          <span><kbd style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 3, padding: "1px 5px" }}>ESC</kbd> close</span>
          <span style={{ marginLeft: "auto" }}>{filtered.length} results</span>
        </div>
      </div>
    </div>
  );
}
