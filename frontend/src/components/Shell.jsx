import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Cpu, MessageSquare, Network, Brain, Library, Code2, Terminal, Globe,
  ListTodo, Activity, Settings as SettingsIcon, Sparkles, Search, ShieldAlert, Lock, Mic, Camera, Atom, Phone,
  Bell, LayoutGrid, CloudSun, Bug, Route
} from "lucide-react";

import CommandPalette from "./CommandPalette";
import { useSecurity } from "../lib/SecurityContext";
import { useVoice } from "../lib/VoiceContext";
import { useErrorFixer } from "../lib/ErrorFixerContext";
import LockScreen from "./LockScreen";
import BiometricPrompt from "./BiometricPrompt";
import VoicePromptOverlay from "./VoicePromptOverlay";
import ShutdownScreen from "./ShutdownScreen";
import WelcomeScreen from "./WelcomeScreen";
import SideRobot from "./SideRobot";


const NAV_GROUPS = [
  {
    title: "CORE OS",
    items: [
      { to: "/",          label: "Command",        icon: Cpu,           id: "cmd" },
      { to: "/chat",      label: "Chat Swarm",     icon: MessageSquare, id: "chat" },
      { to: "/phone",     label: "Phone Call",     icon: Phone,         id: "phone" },
      { to: "/tasks",     label: "Tasks",          icon: ListTodo,      id: "tasks" },
      { to: "/monitor",   label: "Monitor",        icon: Activity,      id: "monitor" },
    ]
  },
  {
    title: "INTELLIGENCE & DEV",
    items: [
      { to: "/agents",    label: "Agents",         icon: Network,       id: "agents" },
      { to: "/memory",    label: "Memory",         icon: Brain,         id: "memory" },
      { to: "/knowledge", label: "Knowledge",      icon: Library,       id: "kb" },
      { to: "/code",      label: "Code Studio",    icon: Code2,         id: "code" },
      { to: "/terminal",  label: "Terminal",       icon: Terminal,      id: "terminal" },
      { to: "/browser",   label: "Browser",        icon: Globe,         id: "browser" },
      { to: "/error-fixer",label: "Error AI",      icon: Bug,          id: "error-fixer" },
    ]
  },
  {
    title: "URBAN TELEMETRY",
    items: [
      { to: "/urban",     label: "Urban AI",       icon: Brain,         id: "urban" },
      { to: "/traffic",   label: "Traffic & EAS",  icon: Network,       id: "traffic" },
      { to: "/camera",    label: "Camera Feeds",   icon: Camera,        id: "camera" },
      { to: "/3dcity",    label: "3D City",        icon: Globe,         id: "3dcity" },
    ]
  },
  {
    title: "LAB & EXPERIMENTS",
    items: [
      { to: "/particles", label: "Particles",      icon: Atom,          id: "particles" },
      { to: "/animate",   label: "Animate SVG",    icon: Sparkles,      id: "animate" },
      { to: "/handanim",  label: "Hand Anim",      icon: Activity,      id: "handanim" },
      { to: "/hologram",  label: "Hologram",       icon: Sparkles,      id: "hologram" },
      { to: "/virtualface",label: "Virtual Face",  icon: Camera,        id: "virtualface" },
      { to: "/infinity",  label: "Infinity Engine", icon: Sparkles,     id: "infinity" },
      { to: "/ui-playground",label: "Nexus UI",    icon: Sparkles,      id: "ui-playground" },
    ]
  },
  {
    title: "SYSTEM & SECURITY",
    items: [
      { to: "/biometrics",label: "Security",       icon: ShieldAlert,   id: "biometrics" },
      { to: "/settings",  label: "Settings",       icon: SettingsIcon,  id: "settings" },
    ]
  }
];

const FLAT_NAV = NAV_GROUPS.flatMap(g => g.items);

const UGX_NAV = [
  { to: "/",            label: "Dashboard",   icon: Cpu,           id: "dashboard" },
  { to: "/3dcity",      label: "3D City",      icon: Globe,         id: "3dcity" },
  { to: "/infinity",    label: "Infinity",     icon: Sparkles,      id: "infinity" },
  { to: "/urban",       label: "Maps",         icon: Brain,         id: "urban" },
  { to: "/traffic",     label: "Traffic",      icon: Route,         id: "traffic" },
  { to: "/monitor",     label: "Weather",      icon: Activity,      id: "weather" },
  { to: "/biometrics",  label: "Security",     icon: ShieldAlert,   id: "security" },
  { to: "/tasks",       label: "Utilities",    icon: ListTodo,      id: "utilities" },
  { to: "/chat",        label: "AI Assistant", icon: MessageSquare, id: "ai_assistant" },
  { to: "/settings",    label: "Settings",     icon: SettingsIcon,  id: "settings" },
];

export default function Shell({ children }) {
  const loc = useLocation();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [time, setTime] = useState(new Date().toLocaleTimeString());
  const [errDrawerOpen, setErrDrawerOpen] = useState(false);
  const { lockSystem } = useSecurity();
  const { startListening } = useVoice();
  const { errors, newErrorCount, analyzeError } = useErrorFixer();
  const latestError = errors[0] || null;


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

  const is3dCity = loc.pathname === "/3dcity";
  const activeNav = is3dCity ? [{ title: "UGX DASHBOARD", items: UGX_NAV }] : NAV_GROUPS;
  const activePage = FLAT_NAV.find(n => n.to === loc.pathname)?.label || "NEXUS";

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
        style={{ width: is3dCity ? 240 : 220, flexShrink: 0, display: "flex", flexDirection: "column", borderRight: is3dCity ? "1px solid rgba(0,245,255,0.08)" : "1px solid rgba(0,245,255,0.12)", background: is3dCity ? "rgba(2,6,23,0.85)" : "rgba(2,6,23,0.65)", backdropFilter: "blur(20px)", position: "sticky", top: 0, height: "100vh" }}
        data-testid="nexus-sidebar"
      >
        {/* Logo */}
        {is3dCity ? (
          <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid rgba(0,245,255,0.08)", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ position: "relative", width: 22, height: 22, borderRadius: "50%", border: "2px solid #00F5FF", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 10px rgba(0,245,255,0.3)" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00F5FF", boxShadow: "0 0 6px #00F5FF" }} />
              </div>
              <div>
                <div className="font-display" style={{ fontSize: 16, fontWeight: 800, color: "#fff", letterSpacing: "0.08em" }}>UGX OS</div>
              </div>
            </div>
          </div>
        ) : (
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
        )}

        {/* Search/palette button (only for non-3dcity) */}
        {!is3dCity && (
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
        )}

        {/* Nav with Section Headers */}
        <nav style={{ flex: 1, padding: is3dCity ? "0px 10px" : "8px 8px", overflowY: "auto" }}>
          {activeNav.map((group) => (
            <div key={group.title} style={{ marginBottom: 10 }}>
              {!is3dCity && (
                <div
                  style={{
                    fontSize: 8,
                    fontFamily: "monospace",
                    fontWeight: 700,
                    letterSpacing: "0.14em",
                    color: "rgba(0, 245, 255, 0.45)",
                    padding: "6px 8px 3px",
                    textTransform: "uppercase",
                    display: "flex",
                    alignItems: "center",
                    gap: 5
                  }}
                >
                  <span style={{ width: 3.5, height: 3.5, borderRadius: "50%", background: "rgba(0, 245, 255, 0.5)" }} />
                  {group.title}
                </div>
              )}
              {group.items.map(n => {
                const active = loc.pathname === n.to;
                const Icon = n.icon || Sparkles;
                return (
                  <Link
                    key={n.id}
                    to={n.to}
                    data-testid={`nav-${n.id}`}
                    style={is3dCity ? {
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 14px", borderRadius: 8, marginBottom: 4,
                      textDecoration: "none", transition: "all 0.16s ease",
                      background: active ? "rgba(0,245,255,0.06)" : "transparent",
                      border: active ? "1px solid rgba(0,245,255,0.35)" : "1px solid transparent",
                      boxShadow: active ? "0 0 12px rgba(0,245,255,0.08)" : "none",
                      color: active ? "#00F5FF" : "rgba(148,163,184,0.65)",
                    } : {
                      display: "flex", alignItems: "center", gap: 9,
                      padding: "7px 10px", borderRadius: 7, marginBottom: 2,
                      textDecoration: "none", transition: "all 0.16s ease",
                      background: active ? "rgba(0,245,255,0.09)" : "transparent",
                      border: active ? "1px solid rgba(0,245,255,0.28)" : "1px solid transparent",
                      boxShadow: active ? "0 0 16px rgba(0,245,255,0.12)" : "none",
                      color: active ? "#00F5FF" : "rgba(148,163,184,0.8)",
                    }}
                    onMouseEnter={e => { if (!active) { e.currentTarget.style.background = is3dCity ? "rgba(0,245,255,0.03)" : "rgba(0,245,255,0.04)"; e.currentTarget.style.color = "#7dd3fc"; } }}
                    onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = is3dCity ? "rgba(148,163,184,0.65)" : "rgba(148,163,184,0.8)"; } }}
                  >
                    <Icon style={{ width: 13, height: 13, flexShrink: 0, color: active ? "#00F5FF" : "inherit" }} />
                    <span style={{ fontFamily: is3dCity ? "'Space Grotesk', sans-serif" : "'JetBrains Mono',monospace", fontSize: is3dCity ? 11 : 10, fontWeight: is3dCity ? 600 : "normal", letterSpacing: is3dCity ? "0.06em" : "0.1em", textTransform: "uppercase" }}>{n.label}</span>
                    {active && <span className="nx-pulse ml-auto" style={{ width: 5, height: 5, borderRadius: "50%", background: "#00F5FF", marginLeft: "auto", flexShrink: 0 }} />}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer status (only for non-3dcity) */}
        {!is3dCity && (
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
        )}
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {/* Top bar */}
        {is3dCity ? null : (
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
              {/* Bug / Error Fixer Button */}
              <div style={{ position: "relative" }}>
                <button
                  id="error-fixer-btn"
                  onClick={() => setErrDrawerOpen(o => !o)}
                  title="Error Fixer AI"
                  style={{
                    display: "flex", alignItems: "center", gap: 5,
                    background: newErrorCount > 0 ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${newErrorCount > 0 ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.08)"}`,
                    borderRadius: 6, padding: "4px 9px", cursor: "pointer",
                    color: newErrorCount > 0 ? "#f87171" : "rgba(148,163,184,0.5)",
                    transition: "all 0.15s", fontSize: 10, fontFamily: "monospace",
                    boxShadow: newErrorCount > 0 ? "0 0 10px rgba(239,68,68,0.15)" : "none"
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.16)"; e.currentTarget.style.borderColor = "#ef4444"; e.currentTarget.style.color = "#f87171"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = newErrorCount > 0 ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = newErrorCount > 0 ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.08)"; e.currentTarget.style.color = newErrorCount > 0 ? "#f87171" : "rgba(148,163,184,0.5)"; }}
                >
                  <Bug style={{ width: 10, height: 10 }} />
                  FIX
                  {newErrorCount > 0 && (
                    <span style={{
                      background: "#ef4444", color: "#fff", borderRadius: 8,
                      fontSize: 8, fontWeight: 800, padding: "0px 4px", minWidth: 14,
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      animation: "errPulse 1.2s ease-in-out infinite"
                    }}>{newErrorCount}</span>
                  )}
                </button>

                {/* Quick drawer */}
                {errDrawerOpen && (
                  <div style={{
                    position: "absolute", top: "calc(100% + 8px)", right: 0, width: 340, zIndex: 999,
                    background: "rgba(2,6,23,0.97)", border: "1px solid rgba(239,68,68,0.25)",
                    borderRadius: 10, padding: 14, boxShadow: "0 8px 40px rgba(239,68,68,0.15)",
                    backdropFilter: "blur(20px)",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <span style={{ fontSize: 10, color: "#f87171", fontFamily: "monospace", fontWeight: 700, letterSpacing: "0.1em" }}>⬡ ERROR FIXER AI</span>
                      <Link to="/error-fixer" onClick={() => setErrDrawerOpen(false)} style={{ fontSize: 9, color: "#00F5FF", fontFamily: "monospace", textDecoration: "none" }}>Open Full →</Link>
                    </div>
                    {!latestError ? (
                      <div style={{ fontSize: 11, color: "rgba(148,163,184,0.5)", fontFamily: "monospace", textAlign: "center", padding: "16px 0" }}>✓ No errors detected</div>
                    ) : (
                      <div>
                        <div style={{ fontSize: 10, color: "rgba(148,163,184,0.5)", fontFamily: "monospace", marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: latestError.status === "fixed" ? "#34d399" : "#f87171" }}>{latestError.status.toUpperCase()}</span>
                          <span>{new Date(latestError.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <div style={{ fontSize: 11, color: "#e2e8f0", fontFamily: "monospace", lineBreak: "anywhere", marginBottom: 10, maxHeight: 60, overflow: "hidden", lineHeight: 1.5 }}>
                          {latestError.message}
                        </div>
                        {latestError.status === "new" && (
                          <button
                            onClick={() => { analyzeError(latestError.id); setErrDrawerOpen(false); }}
                            style={{
                              width: "100%", padding: "7px", background: "rgba(0,245,255,0.1)",
                              border: "1px solid rgba(0,245,255,0.3)", borderRadius: 7,
                              color: "#00F5FF", fontSize: 11, fontFamily: "monospace",
                              cursor: "pointer", fontWeight: 700, transition: "all 0.15s"
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = "rgba(0,245,255,0.18)"}
                            onMouseLeave={e => e.currentTarget.style.background = "rgba(0,245,255,0.1)"}
                          >✦ AI Fix This Error</button>
                        )}
                        {latestError.status === "fixed" && (
                          <div style={{ textAlign: "center", fontSize: 11, color: "#34d399", fontFamily: "monospace" }}>✓ Fixed successfully</div>
                        )}
                      </div>
                    )}
                    <style>{`@keyframes errPulse { 0%,100%{opacity:1}50%{opacity:0.5} }`}</style>
                  </div>
                )}
              </div>
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
        )}

        <div style={{ padding: is3dCity ? "0px" : "22px 24px", flex: 1, display: "flex", flexDirection: "column" }} data-testid="page-content">{children}</div>
      </main>
    </div>
  );
}
