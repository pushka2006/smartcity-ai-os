import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Cpu, MessageSquare, Network, Brain, Library, Code2, Terminal, Globe,
  ListTodo, Activity, Settings as SettingsIcon, Sparkles, Search, ShieldAlert, Lock, Mic, Camera, Atom, Clapperboard, Wind, Route
} from "lucide-react";
import CommandPalette from "./CommandPalette";
import { useSecurity } from "../lib/SecurityContext";
import { useVoice } from "../lib/VoiceContext";
import LockScreen from "./LockScreen";
import BiometricPrompt from "./BiometricPrompt";
import VoicePromptOverlay from "./VoicePromptOverlay";
import ShutdownScreen from "./ShutdownScreen";
import WelcomeScreen from "./WelcomeScreen";
import SideRobot from "./SideRobot";

const NAV = [
  { to: "/",         label: "Command",  icon: Cpu,           id: "cmd" },
  { to: "/chat",     label: "Chat",     icon: MessageSquare, id: "chat" },
  { to: "/agents",   label: "Agents",   icon: Network,       id: "agents" },
  { to: "/memory",   label: "Memory",   icon: Brain,         id: "memory" },
  { to: "/knowledge",label: "Knowledge",icon: Library,       id: "kb" },
  { to: "/code",     label: "Code",     icon: Code2,         id: "code" },
  { to: "/terminal", label: "Terminal", icon: Terminal,      id: "terminal" },
  { to: "/browser",  label: "Browser",  icon: Globe,         id: "browser" },
  { to: "/tasks",    label: "Tasks",    icon: ListTodo,      id: "tasks" },
  { to: "/monitor",  label: "Monitor",  icon: Activity,      id: "monitor" },
  { to: "/camera",   label: "Camera",   icon: Camera,        id: "camera" },
  { to: "/traffic",  label: "Traffic",  icon: Route,         id: "traffic" },
  { to: "/particles",label: "Particles", icon: Atom,          id: "particles" },
  { to: "/animate",  label: "Animate",   icon: Clapperboard,  id: "animate" },
  { to: "/handanim", label: "Hand Anim",  icon: Wind,          id: "handanim" },
  { to: "/settings", label: "Settings", icon: SettingsIcon,  id: "settings" },
  { to: "/biometrics",label: "Security",icon: ShieldAlert,   id: "biometrics" },
];

export default function Shell({ children }) {
  const loc = useLocation();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [time, setTime] = useState(new Date().toLocaleTimeString());
  const { lockSystem } = useSecurity();
  const { startListening } = useVoice();

  // Live clock
  useEffect(() => {
    const iv = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(iv);
  }, []);

  // Ctrl+K global shortcut
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen(p => !p);
      }
      if (e.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const activePage = NAV.find(n => n.to === loc.pathname)?.label || "NEXUS";

  const isAuthPage = loc.pathname.startsWith("/auth/mock/");
  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Biometric & Voice Security Overlays */}
      <LockScreen />
      <BiometricPrompt />
      <VoicePromptOverlay />
      <ShutdownScreen />
      <WelcomeScreen />
      <SideRobot />

      {/* Command Palette */}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      {/* Sidebar */}
      <aside
        style={{ width: 220, flexShrink: 0, display: "flex", flexDirection: "column", borderRight: "1px solid rgba(0,245,255,0.12)", background: "rgba(2,6,23,0.65)", backdropFilter: "blur(20px)", position: "sticky", top: 0, height: "100vh" }}
        data-testid="nexus-sidebar"
      >
        {/* Logo */}
        <div style={{ padding: "18px 18px 14px", borderBottom: "1px solid rgba(0,245,255,0.12)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ position: "relative", width: 28, height: 28 }}>
              <Sparkles style={{ width: 22, height: 22, color: "#00F5FF" }} />
              <span style={{ position: "absolute", inset: 0, background: "rgba(0,245,255,0.3)", borderRadius: "50%", filter: "blur(8px)" }} />
            </div>
            <div>
              <div className="font-display nx-neon-cyan" style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.02em" }}>NEXUS</div>
              <div className="hud-label" style={{ marginTop: 1, fontSize: "0.58rem" }}>AI · OPERATING · SYSTEM</div>
            </div>
          </div>
        </div>

        {/* Search/palette button */}
        <div style={{ padding: "10px 10px 2px" }}>
          <button
            onClick={() => setPaletteOpen(true)}
            title="Command Palette (Ctrl+K)"
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 8,
              padding: "7px 10px", borderRadius: 8, cursor: "pointer",
              background: "rgba(0,245,255,0.04)", border: "1px solid rgba(0,245,255,0.12)",
              color: "rgba(148,163,184,0.6)", transition: "all 0.15s", fontFamily: "monospace", fontSize: 11,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(0,245,255,0.3)"; e.currentTarget.style.color = "#00F5FF"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(0,245,255,0.12)"; e.currentTarget.style.color = "rgba(148,163,184,0.6)"; }}
          >
            <Search style={{ width: 12, height: 12 }} />
            <span style={{ flex: 1, textAlign: "left" }}>Search…</span>
            <kbd style={{ fontSize: 9, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 3, padding: "1px 4px" }}>⌃K</kbd>
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "8px 8px", overflowY: "auto" }}>
          {NAV.map(n => {
            const active = loc.pathname === n.to;
            const Icon = n.icon;
            return (
              <Link
                key={n.id}
                to={n.to}
                data-testid={`nav-${n.id}`}
                style={{
                  display: "flex", alignItems: "center", gap: 9,
                  padding: "8px 10px", borderRadius: 8, marginBottom: 2,
                  textDecoration: "none", transition: "all 0.16s ease",
                  background: active ? "rgba(0,245,255,0.09)" : "transparent",
                  border: active ? "1px solid rgba(0,245,255,0.28)" : "1px solid transparent",
                  boxShadow: active ? "0 0 16px rgba(0,245,255,0.12)" : "none",
                  color: active ? "#00F5FF" : "rgba(148,163,184,0.8)",
                }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.background = "rgba(0,245,255,0.04)"; e.currentTarget.style.color = "#7dd3fc"; } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(148,163,184,0.8)"; } }}
              >
                <Icon style={{ width: 14, height: 14, flexShrink: 0, color: active ? "#00F5FF" : "inherit" }} />
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase" }}>{n.label}</span>
                {active && <span className="nx-pulse ml-auto" style={{ width: 5, height: 5, borderRadius: "50%", background: "#00F5FF", marginLeft: "auto", flexShrink: 0 }} />}
              </Link>
            );
          })}
        </nav>

        {/* Footer status */}
        <div style={{ padding: "8px 10px 14px" }}>
          <div className="nx-glass" style={{ borderRadius: 9, padding: "10px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <span className="hud-label">CORE ENGINE</span>
              <span style={{ fontSize: 10, color: "#34d399", fontFamily: "monospace", display: "flex", alignItems: "center", gap: 4 }}>
                <span className="nx-pulse" style={{ width: 5, height: 5, borderRadius: "50%", background: "#34d399", display: "inline-block" }} />
                ONLINE
              </span>
            </div>
            <div style={{ fontSize: 10, color: "rgba(148,163,184,0.55)", fontFamily: "monospace" }}>claude-sonnet-4.5</div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {/* Top bar */}
        <header style={{ padding: "10px 24px", borderBottom: "1px solid rgba(0,245,255,0.1)", background: "rgba(2,6,23,0.75)", backdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 30, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="hud-label">SECTOR</span>
              <span style={{ fontFamily: "monospace", fontSize: 12, color: "#7dd3fc", fontWeight: 600 }}>{activePage.toUpperCase()}</span>
            </div>
            {/* Breadcrumb path */}
            <span style={{ color: "rgba(148,163,184,0.3)", fontSize: 11, fontFamily: "monospace" }}>›</span>
            <span style={{ fontSize: 11, color: "rgba(148,163,184,0.4)", fontFamily: "monospace" }}>nexus://os{loc.pathname}</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 11, fontFamily: "monospace" }}>
            {/* Ctrl+K hint */}
            <button
              onClick={() => setPaletteOpen(true)}
              style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "4px 9px", cursor: "pointer", color: "rgba(148,163,184,0.5)", transition: "all 0.15s", fontSize: 10 }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(0,245,255,0.3)"; e.currentTarget.style.color = "#00F5FF"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "rgba(148,163,184,0.5)"; }}
            >
              <Search style={{ width: 10, height: 10 }} />
              <kbd style={{ fontFamily: "monospace" }}>Ctrl+K</kbd>
            </button>
            <button
              onClick={startListening}
              title="Voice Directive Assistant"
              style={{
                display: "flex", alignItems: "center", gap: 5,
                background: "rgba(0, 245, 255, 0.08)", border: "1px solid rgba(0, 245, 255, 0.25)",
                borderRadius: 6, padding: "4px 9px", cursor: "pointer", color: "#00f5ff",
                transition: "all 0.15s", fontSize: 10, fontFamily: "monospace",
                boxShadow: "0 0 10px rgba(0, 245, 255, 0.1)"
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(0, 245, 255, 0.16)"; e.currentTarget.style.borderColor = "#00f5ff"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(0, 245, 255, 0.08)"; e.currentTarget.style.borderColor = "rgba(0, 245, 255, 0.25)"; }}
            >
              <Mic style={{ width: 10, height: 10 }} />
              SPEAK
            </button>
            <span style={{ color: "#34d399", display: "flex", alignItems: "center", gap: 5 }}>
              <span className="nx-pulse" style={{ width: 5, height: 5, borderRadius: "50%", background: "#34d399", display: "inline-block" }} />
              NOMINAL
            </span>
            <button
              onClick={lockSystem}
              title="Lock System"
              style={{
                display: "flex", alignItems: "center", gap: 5,
                background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.25)",
                borderRadius: 6, padding: "4px 9px", cursor: "pointer", color: "#f87171",
                transition: "all 0.15s", fontSize: 10, fontFamily: "monospace"
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(239, 68, 68, 0.16)"; e.currentTarget.style.borderColor = "#ef4444"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(239, 68, 68, 0.08)"; e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.25)"; }}
            >
              <Lock style={{ width: 10, height: 10 }} />
              LOCK OS
            </button>
            <span style={{ color: "rgba(148,163,184,0.55)" }}>{time}</span>
          </div>
        </header>

        <div style={{ padding: "22px 24px", flex: 1 }} data-testid="page-content">{children}</div>
      </main>
    </div>
  );
}
