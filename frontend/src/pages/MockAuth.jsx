import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Globe, GitFork, Briefcase, Camera, Sparkles, ShieldCheck, ArrowRightLeft, Check, RefreshCw } from "lucide-react";

const PROVIDERS = {
  google: {
    name: "Google",
    color: "#ea4335",
    icon: Globe,
    bg: "radial-gradient(ellipse 60% 60% at 50% 50%, rgba(234, 67, 53, 0.12), transparent)",
    username: "operator.nexus@gmail.com",
    scopes: ["Read profile metadata", "Access email identity (openid)", "Sync Google Calendar events"],
    brandColor: "#ea4335"
  },
  github: {
    name: "GitHub",
    color: "#24292e",
    icon: GitFork,
    bg: "radial-gradient(ellipse 60% 60% at 50% 50%, rgba(255, 255, 255, 0.08), transparent)",
    username: "operator-nexus",
    scopes: ["Read repository status & metadata", "Access public notifications", "Sync gists and actions telemetry"],
    brandColor: "#00FF88" // nice glowing green for github button
  },
  linkedin: {
    name: "LinkedIn",
    color: "#0a66c2",
    icon: Briefcase,
    bg: "radial-gradient(ellipse 60% 60% at 50% 50%, rgba(10, 102, 194, 0.12), transparent)",
    username: "Nexus Operator",
    scopes: ["Read profile core data", "Share professional feed analytics", "Retrieve user connection count"],
    brandColor: "#00F5FF"
  },
  instagram: {
    name: "Instagram",
    color: "#e1306c",
    icon: Camera,
    bg: "radial-gradient(ellipse 60% 60% at 50% 50%, rgba(225, 48, 108, 0.12), transparent)",
    username: "@nexus_operator",
    scopes: ["Read profile basic details", "Access media nodes list", "Retrieve follower count analytics"],
    brandColor: "#FF2E88"
  }
};

export default function MockAuth() {
  const { provider } = useParams();
  const info = PROVIDERS[provider?.toLowerCase()] || PROVIDERS.google;
  const ProviderIcon = info.icon;

  const [step, setStep] = useState("auth"); // "auth" | "linking" | "success"
  const [linkingText, setLinkingText] = useState("Initializing protocol...");

  useEffect(() => {
    if (step === "linking") {
      const timers = [
        setTimeout(() => setLinkingText("Negotiating cryptographic handshake..."), 500),
        setTimeout(() => setLinkingText("Validating mock API gateway credentials..."), 1200),
        setTimeout(() => setLinkingText("Syncing platform metadata with NEXUS grid..."), 2000),
        setTimeout(() => {
          setStep("success");
          // Notify the parent window
          if (window.opener) {
            window.opener.postMessage(
              {
                type: "AUTH_SUCCESS",
                provider: info.name,
                username: info.username
              },
              window.location.origin
            );
          }
        }, 2800)
      ];
      return () => timers.forEach(clearTimeout);
    } else if (step === "success") {
      const closeTimer = setTimeout(() => {
        window.close();
      }, 1600);
      return () => clearTimeout(closeTimer);
    }
  }, [step, info]);

  return (
    <div 
      className="nx-grid-bg min-h-screen flex items-center justify-center p-4 select-none"
      style={{ background: "#020617", backgroundImage: info.bg }}
    >
      {/* Container */}
      <div 
        className="nx-glass nx-fadein" 
        style={{ 
          maxWidth: 440, 
          width: "100%", 
          borderRadius: 20, 
          padding: "36px 28px", 
          border: `1px solid ${info.brandColor}33`, 
          boxShadow: `0 0 40px ${info.brandColor}11`,
          position: "relative"
        }}
      >
        {step === "auth" && (
          <div>
            {/* Header / Logos */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, marginBottom: 28 }}>
              {/* NEXUS Icon */}
              <div style={{ position: "relative", width: 56, height: 56, borderRadius: "50%", background: "rgba(0, 245, 255, 0.06)", border: "1px solid rgba(0, 245, 255, 0.22)", display: "flex", alignItems: "center", justifyCenter: "center" }} className="justify-center">
                <Sparkles style={{ width: 26, height: 26, color: "#00F5FF" }} />
                <span style={{ position: "absolute", inset: 0, background: "rgba(0, 245, 255, 0.2)", borderRadius: "50%", filter: "blur(12px)" }} />
              </div>

              {/* Sync Arrow */}
              <ArrowRightLeft style={{ width: 18, height: 18, color: "rgba(148, 163, 184, 0.4)", animation: "nx-floaty 3s ease-in-out infinite" }} />

              {/* Provider Icon */}
              <div style={{ position: "relative", width: 56, height: 56, borderRadius: "50%", background: "rgba(255, 255, 255, 0.03)", border: `1px solid ${info.color}33`, display: "flex", alignItems: "center", justifyCenter: "center" }} className="justify-center">
                <ProviderIcon style={{ width: 26, height: 26, color: provider?.toLowerCase() === "github" ? "#fff" : info.color }} />
                <span style={{ position: "absolute", inset: 0, background: `${info.color}33`, borderRadius: "50%", filter: "blur(12px)" }} />
              </div>
            </div>

            {/* Titles */}
            <div style={{ textAlign: "center", marginBottom: 26 }}>
              <div className="hud-label" style={{ fontSize: 9, letterSpacing: "0.22em", color: info.brandColor }}>AUTHORIZATION REQUEST</div>
              <h2 className="font-display text-xl font-bold mt-1" style={{ textTransform: "capitalize" }}>Link {info.name} Account</h2>
              <p style={{ fontSize: 11.5, color: "rgba(148,163,184,0.65)", marginTop: 6, fontFamily: "monospace" }}>
                NEXUS AI OS is requesting system permission to read credentials from your <strong>{info.name}</strong> profile.
              </p>
            </div>

            {/* Scopes Box */}
            <div style={{ background: "rgba(2, 6, 23, 0.4)", border: "1px solid rgba(255, 255, 255, 0.04)", borderRadius: 12, padding: "16px 20px", marginBottom: 28 }}>
              <span className="hud-label" style={{ fontSize: 8.5, color: "rgba(148, 163, 184, 0.5)", display: "block", marginBottom: 10 }}>REQUESTED SCOPES:</span>
              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
                {info.scopes.map((s, idx) => (
                  <li key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 11, color: "#e2e8f0", fontFamily: "monospace" }}>
                    <ShieldCheck style={{ width: 13, height: 13, color: info.brandColor, flexShrink: 0, marginTop: 1 }} />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                onClick={() => setStep("linking")}
                style={{
                  width: "100%",
                  padding: "11px 0",
                  borderRadius: 10,
                  border: `1px solid ${info.brandColor}`,
                  background: `${info.brandColor}1e`,
                  color: "#fff",
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 600,
                  fontSize: 13.5,
                  cursor: "pointer",
                  letterSpacing: "0.03em",
                  transition: "all 0.25s",
                  boxShadow: `0 0 15px ${info.brandColor}22`
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = info.brandColor;
                  e.currentTarget.style.boxShadow = `0 0 25px ${info.brandColor}66`;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = `${info.brandColor}1e`;
                  e.currentTarget.style.boxShadow = `0 0 15px ${info.brandColor}22`;
                }}
              >
                Authorize NEXUS OS
              </button>
              <button
                onClick={() => window.close()}
                style={{
                  width: "100%",
                  padding: "10px 0",
                  borderRadius: 10,
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  background: "transparent",
                  color: "rgba(148, 163, 184, 0.65)",
                  fontFamily: "monospace",
                  fontSize: 11,
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = "#ef4444";
                  e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.25)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = "rgba(148, 163, 184, 0.65)";
                  e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.08)";
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {step === "linking" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 240, textAlign: "center" }} className="justify-center">
            <RefreshCw 
              style={{ width: 34, height: 34, color: info.brandColor, marginBottom: 20, animation: "nx-spin-slow 1.8s linear infinite" }} 
            />
            <div className="hud-label" style={{ color: info.brandColor, fontSize: 9.5, letterSpacing: "0.2em", marginBottom: 6 }}>SYNCING TELEMETRY</div>
            <p style={{ fontSize: 11.5, fontFamily: "monospace", color: "rgba(148, 163, 184, 0.75)", maxWidth: 280, minHeight: 36 }}>
              {linkingText}
            </p>
          </div>
        )}

        {step === "success" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 240, textAlign: "center" }} className="justify-center">
            {/* Green glowing checkmark */}
            <div 
              style={{ 
                width: 52, 
                height: 52, 
                borderRadius: "50%", 
                background: "rgba(0, 255, 136, 0.1)", 
                border: "2px solid #00FF88", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                marginBottom: 20,
                boxShadow: "0 0 20px rgba(0, 255, 136, 0.35)",
                animation: "nx-fadeIn 0.3s ease-out forwards"
              }}
              className="justify-center"
            >
              <Check style={{ width: 24, height: 24, color: "#00FF88" }} />
            </div>
            
            <div className="hud-label" style={{ color: "#00FF88", fontSize: 9.5, letterSpacing: "0.22em", marginBottom: 6 }}>LINK NOMINAL</div>
            <h3 className="font-display text-base font-bold text-white mb-2">Connection Established!</h3>
            <p style={{ fontSize: 11, fontFamily: "monospace", color: "rgba(148, 163, 184, 0.6)" }}>
              Synced as <strong>{info.username}</strong>
            </p>
            <p style={{ fontSize: 9, fontFamily: "monospace", color: "rgba(148, 163, 184, 0.4)", marginTop: 18 }}>
              Closing channel portal...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
