import { useState } from "react";
import {
  Sliders,
  Sparkles,
  Code,
  Atom,
  Layers,
  Activity,
  ShieldAlert,
  Flame,
  Check,
  Copy,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Tv
} from "lucide-react";
import { GlassCard, ParticleBackground } from "../components/ui";
import { toast } from "../components/Toast";

const PALETTE = {
  cyan: "#00F5FF",
  pink: "#FF2E88",
  purple: "#6E56FF",
  green: "#00FF88",
  amber: "#FFC857",
  red: "#FF4D4D",
};

export default function UiPlayground() {
  const LS_PARTICLE_KEY = "nexus_particle_settings";
  const LS_CARD_KEY = "nexus_card_settings";

  // Particle States
  const [particleColorName, setParticleColorName] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(LS_PARTICLE_KEY) || "{}");
      return stored.colorName || "cyan";
    } catch { return "cyan"; }
  });
  const [particleCount, setParticleCount] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(LS_PARTICLE_KEY) || "{}");
      return stored.count !== undefined ? stored.count : 80;
    } catch { return 80; }
  });
  const [particleSpeed, setParticleSpeed] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(LS_PARTICLE_KEY) || "{}");
      return stored.speed !== undefined ? stored.speed : 0.8;
    } catch { return 0.8; }
  });
  const [lineDistance, setLineDistance] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(LS_PARTICLE_KEY) || "{}");
      return stored.lineDistance !== undefined ? stored.lineDistance : 110;
    } catch { return 110; }
  });
  const [interactiveMode, setInteractiveMode] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(LS_PARTICLE_KEY) || "{}");
      return stored.interactiveMode || "magnet";
    } catch { return "magnet"; }
  });
  const [drawLines, setDrawLines] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(LS_PARTICLE_KEY) || "{}");
      return stored.connectionLines !== undefined ? stored.connectionLines : true;
    } catch { return true; }
  });
  const [fullscreenParticles, setFullscreenParticles] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(LS_PARTICLE_KEY) || "{}");
      return stored.fullscreen !== undefined ? stored.fullscreen : false;
    } catch { return false; }
  });

  // Card States
  const [cardGlowColor, setCardGlowColor] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(LS_CARD_KEY) || "{}");
      return stored.glowColor || "cyan";
    } catch { return "cyan"; }
  });
  const [cardHover, setCardHover] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(LS_CARD_KEY) || "{}");
      return stored.hover !== undefined ? stored.hover : true;
    } catch { return true; }
  });
  const [cardReflection, setCardReflection] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(LS_CARD_KEY) || "{}");
      return stored.reflection !== undefined ? stored.reflection : true;
    } catch { return true; }
  });

  // Copy State
  const [copiedCode, setCopiedCode] = useState(null);

  const saveSettings = (updatedFields) => {
    try {
      const stored = JSON.parse(localStorage.getItem(LS_PARTICLE_KEY) || "{}");
      const current = {
        colorName: particleColorName,
        color: PALETTE[particleColorName],
        count: particleCount,
        speed: particleSpeed,
        lineDistance: lineDistance,
        interactiveMode: interactiveMode,
        interactive: interactiveMode !== "none",
        connectionLines: drawLines,
        fullscreen: fullscreenParticles,
        ...stored,
        ...updatedFields
      };
      
      if (updatedFields.colorName) {
        current.color = PALETTE[updatedFields.colorName];
      }

      localStorage.setItem(LS_PARTICLE_KEY, JSON.stringify(current));
      window.dispatchEvent(new CustomEvent("nexus-particle-settings-updated"));
    } catch (e) {
      console.error("Failed to save particle settings:", e);
    }
  };

  const saveCardSettings = (updatedFields) => {
    try {
      const stored = JSON.parse(localStorage.getItem(LS_CARD_KEY) || "{}");
      const current = {
        glowColor: cardGlowColor,
        hover: cardHover,
        reflection: cardReflection,
        ...stored,
        ...updatedFields
      };
      localStorage.setItem(LS_CARD_KEY, JSON.stringify(current));
    } catch (e) {
      console.error("Failed to save card settings:", e);
    }
  };

  const activeColorHex = PALETTE[particleColorName] || PALETTE.cyan;

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopiedCode(key);
        toast.success("Snippet copied to clipboard");
        setTimeout(() => setCopiedCode(null), 2000);
      },
      () => toast.error("Failed to copy snippet")
    );
  };

  // Code snippets generator
  const getGlassCardCode = () => `import { GlassCard } from "./components/ui";

// Inside render...
<GlassCard
  glowColor="${cardGlowColor}"
  hoverEffect={${cardHover}}
  reflection={${cardReflection}}
  header="SYSTEM GATEWAY"
  footer={<button className="glow-btn">INITIALIZE</button>}
>
  <p>Secure connection initialized.</p>
</GlassCard>`;

  const getParticlesCode = () => `import { ParticleBackground } from "./components/ui";

// Inside render...
<ParticleBackground
  color="${activeColorHex}"
  count={${particleCount}}
  speed={${particleSpeed}}
  interactive={${interactiveMode !== "none"}}
  interactiveMode="${interactiveMode !== "none" ? interactiveMode : "magnet"}"
  connectionLines={${drawLines}}
  lineDistance={${lineDistance}}
  fullscreen={${fullscreenParticles}}
/>`;

  const controlLabelStyle = {
    fontSize: "11px",
    fontFamily: "monospace",
    color: "rgba(148, 163, 184, 0.7)",
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "5px",
  };

  const sliderStyle = {
    width: "100%",
    height: "5px",
    background: "rgba(255,255,255,0.1)",
    borderRadius: "3px",
    appearance: "none",
    outline: "none",
    cursor: "pointer",
    accentColor: activeColorHex,
  };

  const colorBtnStyle = (colorName, isSelected) => ({
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    background: PALETTE[colorName],
    border: isSelected ? `2px solid #ffffff` : "2px solid transparent",
    cursor: "pointer",
    boxShadow: isSelected ? `0 0 12px ${PALETTE[colorName]}` : "none",
    transition: "all 0.2s ease",
  });

  const selectStyle = {
    width: "100%",
    background: "rgba(15, 23, 42, 0.7)",
    border: "1px solid rgba(0, 245, 255, 0.15)",
    borderRadius: "8px",
    color: "#ffffff",
    padding: "8px 12px",
    fontSize: "11px",
    fontFamily: "monospace",
    outline: "none",
    cursor: "pointer",
  };

  const preBlockStyle = {
    background: "rgba(2, 6, 23, 0.85)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "8px",
    padding: "14px",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "11px",
    color: "#38bdf8",
    overflowX: "auto",
    position: "relative",
  };

  return (
    <div style={{ position: "relative", minHeight: "100%" }}>
      {/* Global fullscreen particles are handled dynamically in App.js via localStorage updates */}

      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <div className="hud-label" style={{ marginBottom: "4px" }}>DESIGN ENGINE</div>
        <h1 className="font-display nx-neon-cyan" style={{ fontSize: "28px", fontWeight: 800, display: "flex", alignItems: "center", gap: "10px" }}>
          <Sparkles style={{ color: "#00F5FF" }} /> Nexus Premium UI
        </h1>
        <p style={{ marginTop: "4px", fontSize: "11px", color: "rgba(148, 163, 184, 0.6)", fontFamily: "monospace" }}>
          Interactive dashboard playground displaying customizable glassmorphic panels and dynamic high-performance canvas particle systems.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2.2fr", gap: "24px" }}>
        {/* ================= LEFT COLUMN: SANDBOX CONTROLS ================= */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          
          {/* Card: Particle Settings */}
          <GlassCard glowColor={particleColorName} header="PARTICLE BACKPLANE" icon={Sliders}>
            <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              
              {/* Particle Theme Color */}
              <div>
                <span style={controlLabelStyle}>PARTICLE GLOW COLOR: <span style={{ color: activeColorHex, fontWeight: "bold" }}>{particleColorName.toUpperCase()}</span></span>
                <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                  {Object.keys(PALETTE).map((color) => (
                    <button
                      key={color}
                      onClick={() => { setParticleColorName(color); saveSettings({ colorName: color }); }}
                      style={colorBtnStyle(color, particleColorName === color)}
                      title={color}
                    />
                  ))}
                </div>
              </div>

              {/* Particle Density Count */}
              <div>
                <div style={controlLabelStyle}>
                  <span>PARTICLE COUNT</span>
                  <span style={{ color: activeColorHex }}>{particleCount}</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="250"
                  step="5"
                  value={particleCount}
                  onChange={(e) => { const val = Number(e.target.value); setParticleCount(val); saveSettings({ count: val }); }}
                  style={sliderStyle}
                />
              </div>

              {/* Particle Speed */}
              <div>
                <div style={controlLabelStyle}>
                  <span>PARTICLE SPEED</span>
                  <span style={{ color: activeColorHex }}>{particleSpeed.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="3.0"
                  step="0.1"
                  value={particleSpeed}
                  onChange={(e) => { const val = Number(e.target.value); setParticleSpeed(val); saveSettings({ speed: val }); }}
                  style={sliderStyle}
                />
              </div>

              {/* Connection Lines Max Distance */}
              <div>
                <div style={controlLabelStyle}>
                  <span>LINE THRESHOLD</span>
                  <span style={{ color: activeColorHex }}>{lineDistance}px</span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="250"
                  step="5"
                  value={lineDistance}
                  onChange={(e) => { const val = Number(e.target.value); setLineDistance(val); saveSettings({ lineDistance: val }); }}
                  style={sliderStyle}
                />
              </div>

              {/* Mouse Interaction Type */}
              <div>
                <span style={controlLabelStyle}>INTERACTIVE PHYSICS:</span>
                <select
                  value={interactiveMode}
                  onChange={(e) => { const val = e.target.value; setInteractiveMode(val); saveSettings({ interactiveMode: val, interactive: val !== "none" }); }}
                  style={selectStyle}
                >
                  <option value="magnet">MAGNETIC ATTRACTION</option>
                  <option value="repel">REPULSION SHIELD</option>
                  <option value="grab">NEURAL CONNECTORS (GRAB)</option>
                  <option value="none">PHYSICS DISABLE</option>
                </select>
              </div>

              {/* Toggles */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "5px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "11px", fontFamily: "monospace" }}>
                  <input
                    type="checkbox"
                    checked={drawLines}
                    onChange={(e) => { const val = e.target.checked; setDrawLines(val); saveSettings({ connectionLines: val }); }}
                    style={{ accentColor: activeColorHex }}
                  />
                  DRAW DYNAMIC CONNECTION LINES
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "11px", fontFamily: "monospace", color: fullscreenParticles ? activeColorHex : "#fff" }}>
                  <input
                    type="checkbox"
                    checked={fullscreenParticles}
                    onChange={(e) => { const val = e.target.checked; setFullscreenParticles(val); saveSettings({ fullscreen: val }); }}
                    style={{ accentColor: activeColorHex }}
                  />
                  {fullscreenParticles ? "FULLSCREEN ON (GLOBAL)" : "CONTAINER-BOUND ONLY"}
                </label>
              </div>

            </div>
          </GlassCard>

          {/* Card: GlassCard Settings */}
          <GlassCard glowColor="none" header="GLASSCARD CONTROLLER">
            <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              
              {/* Card Color */}
              <div>
                <span style={controlLabelStyle}>CARD BORDER GLOW: <span style={{ color: PALETTE[cardGlowColor] || "#fff" }}>{cardGlowColor.toUpperCase()}</span></span>
                <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                  {Object.keys(PALETTE).map((color) => (
                    <button
                      key={color}
                      onClick={() => { setCardGlowColor(color); saveCardSettings({ glowColor: color }); }}
                      style={colorBtnStyle(color, cardGlowColor === color)}
                      title={color}
                    />
                  ))}
                  <button
                    onClick={() => { setCardGlowColor("none"); saveCardSettings({ glowColor: "none" }); }}
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      background: "rgba(255,255,255,0.05)",
                      border: cardGlowColor === "none" ? "2px solid #ffffff" : "2px solid rgba(255,255,255,0.2)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "9px",
                      color: "#94a3b8",
                      fontFamily: "monospace"
                    }}
                    title="No glow"
                  >
                    NONE
                  </button>
                </div>
              </div>

              {/* Toggles */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "11px", fontFamily: "monospace" }}>
                  <input
                    type="checkbox"
                    checked={cardHover}
                    onChange={(e) => { const val = e.target.checked; setCardHover(val); saveCardSettings({ hover: val }); }}
                    style={{ accentColor: PALETTE[cardGlowColor] || "#00F5FF" }}
                  />
                  ENABLE SCALE + SHIFT ON HOVER
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "11px", fontFamily: "monospace" }}>
                  <input
                    type="checkbox"
                    checked={cardReflection}
                    onChange={(e) => { const val = e.target.checked; setCardReflection(val); saveCardSettings({ reflection: val }); }}
                    style={{ accentColor: PALETTE[cardGlowColor] || "#00F5FF" }}
                  />
                  RENDER DIAGONAL REFLECTION OVERLAY
                </label>
              </div>

            </div>
          </GlassCard>

        </div>

        {/* ================= RIGHT COLUMN: INTERACTIVE SHOWCASE ================= */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* Main Visual showcase bounds */}
          <div
            style={{
              position: "relative",
              borderRadius: "20px",
              border: "1px solid rgba(0, 245, 255, 0.12)",
              background: "rgba(6, 11, 29, 0.45)",
              padding: "32px",
              minHeight: "560px",
              display: "flex",
              flexDirection: "column",
              gap: "24px",
              overflow: "hidden",
            }}
          >
            {/* Local Particle Background (Only runs when not in global fullscreen mode) */}
            {!fullscreenParticles && (
              <ParticleBackground
                color={activeColorHex}
                count={particleCount}
                speed={particleSpeed}
                interactive={interactiveMode !== "none"}
                interactiveMode={interactiveMode !== "none" ? interactiveMode : "magnet"}
                connectionLines={drawLines}
                lineDistance={lineDistance}
                fullscreen={false}
              />
            )}

            {/* Title Overlay in background */}
            <div style={{ position: "absolute", bottom: "16px", right: "20px", pointerEvents: "none", zIndex: 1, textAlign: "right" }}>
              <div className="font-display" style={{ fontSize: "10px", letterSpacing: "0.25em", color: "rgba(0, 245, 255, 0.35)", fontWeight: 700 }}>LIVE RENDERING ZONE</div>
              <div style={{ fontSize: "9px", fontFamily: "monospace", color: "rgba(255,255,255,0.15)", marginTop: "2px" }}>NEXUS // COMP_CANVAS // ACTIVE</div>
            </div>

            {/* Showcase title card */}
            <div style={{ zIndex: 2 }}>
              <GlassCard
                glowColor={cardGlowColor}
                hoverEffect={cardHover}
                reflection={cardReflection}
                header="LIVE INTERACTION PREVIEW"
                footer={
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "10px", color: "rgba(148, 163, 184, 0.55)", fontFamily: "monospace" }}>
                    <span>INTERACTIONS POWERED BY REQUESTANIMATIONFRAME</span>
                    <span>NOMINAL</span>
                  </div>
                }
              >
                <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                  <div style={{ background: `rgba(${cardGlowColor === "none" ? "255,255,255" : "0,245,255"},0.08)`, border: `1px solid ${cardGlowColor === "none" ? "rgba(255,255,255,0.2)" : activeColorHex}`, width: "44px", height: "44px", borderRadius: "12px", display: "flex", alignItems: "center", justifyCenter: "center" }}>
                    <LayoutGrid style={{ margin: "auto", width: "20px", height: "20px", color: cardGlowColor === "none" ? "#fff" : activeColorHex }} />
                  </div>
                  <div>
                    <h3 className="font-display" style={{ fontSize: "15px", fontWeight: 700, color: "#f8fafc" }}>Interactive Card Demo</h3>
                    <p style={{ fontSize: "11.5px", color: "rgba(148, 163, 184, 0.75)", marginTop: "3px" }}>
                      This card dynamically inherits the configuration settings from your sidebar control dashboards. Hover over it to trigger the hardware-accelerated transitions and glow amplification.
                    </p>
                  </div>
                </div>
              </GlassCard>
            </div>

            {/* Grid of various GlassCard widgets */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", zIndex: 2 }}>
              
              {/* Widget 1: System Monitor */}
              <GlassCard glowColor="cyan" header="SYSTEM STATUS" hoverEffect={true}>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "10px", fontFamily: "monospace", color: "rgba(255, 255, 255, 0.5)" }}>CORE_TEMP</span>
                    <span style={{ fontSize: "11px", fontFamily: "monospace", color: "#00F5FF", fontWeight: "bold" }}>42.4 °C</span>
                  </div>
                  <div style={{ width: "100%", height: "4px", background: "rgba(255,255,255,0.06)", borderRadius: "2px", overflow: "hidden" }}>
                    <div style={{ width: "42%", height: "100%", background: "#00F5FF", boxShadow: "0 0 8px #00F5FF" }} />
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "10px", fontFamily: "monospace", color: "rgba(255, 255, 255, 0.5)" }}>MEMORY_USAGE</span>
                    <span style={{ fontSize: "11px", fontFamily: "monospace", color: "#6E56FF", fontWeight: "bold" }}>74.8%</span>
                  </div>
                  <div style={{ width: "100%", height: "4px", background: "rgba(255,255,255,0.06)", borderRadius: "2px", overflow: "hidden" }}>
                    <div style={{ width: "74%", height: "100%", background: "#6E56FF", boxShadow: "0 0 8px #6E56FF" }} />
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "10px", fontFamily: "monospace", color: "rgba(255, 255, 255, 0.5)" }}>ACTIVE_PARTICLES</span>
                    <span style={{ fontSize: "11px", fontFamily: "monospace", color: "#00FF88", fontWeight: "bold" }}>{particleCount}</span>
                  </div>
                </div>
              </GlassCard>

              {/* Widget 2: Security */}
              <GlassCard glowColor="pink" header="NEURAL FIREWALL" hoverEffect={true}>
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "rgba(255, 46, 136, 0.08)", border: "1px solid rgba(255, 46, 136, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <ShieldAlert style={{ width: "16px", height: "16px", color: "#FF2E88" }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: "11px", fontWeight: "bold", fontFamily: "monospace", color: "#FF2E88" }}>SHIELD ENCRYPTED</div>
                    <div style={{ fontSize: "9px", fontFamily: "monospace", color: "rgba(148,163,184,0.5)", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis" }}>
                      ADDR: nexus_os://fw.node.2
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
                  <button
                    style={{
                      flex: 1,
                      padding: "6px 8px",
                      borderRadius: "6px",
                      background: "rgba(255, 46, 136, 0.08)",
                      border: "1px solid rgba(255, 46, 136, 0.25)",
                      color: "#FF2E88",
                      fontSize: "9px",
                      fontFamily: "monospace",
                      cursor: "pointer",
                      transition: "all 0.15s"
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255, 46, 136, 0.15)"}
                    onMouseLeave={e => e.currentTarget.style.background = "rgba(255, 46, 136, 0.08)"}
                    onClick={() => toast.info("Diagnostics sequence started")}
                  >
                    DIAGNOSE
                  </button>
                  <button
                    style={{
                      flex: 1,
                      padding: "6px 8px",
                      borderRadius: "6px",
                      background: "transparent",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      color: "#94a3b8",
                      fontSize: "9px",
                      fontFamily: "monospace",
                      cursor: "pointer",
                    }}
                    onClick={() => toast.success("Node bypassed")}
                  >
                    BYPASS
                  </button>
                </div>
              </GlassCard>

              {/* Widget 3: Traffic Analytics */}
              <GlassCard glowColor="amber" header="EMISSION CORE" hoverEffect={true}>
                <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "18px", fontWeight: "bold", fontFamily: "Unbounded, sans-serif", color: "#FFC857" }}>96.2%</div>
                    <div style={{ fontSize: "9px", color: "rgba(148, 163, 184, 0.55)", fontFamily: "monospace", marginTop: "2px" }}>EFFICIENCY QUOTIENT</div>
                  </div>
                  <div style={{ height: "42px", display: "flex", alignItems: "flex-end", gap: "3px", width: "50px", flexShrink: 0 }}>
                    <div style={{ height: "35%", width: "4px", background: "rgba(255, 200, 87, 0.2)", borderRadius: "1px" }} />
                    <div style={{ height: "55%", width: "4px", background: "rgba(255, 200, 87, 0.4)", borderRadius: "1px" }} />
                    <div style={{ height: "80%", width: "4px", background: "rgba(255, 200, 87, 0.7)", borderRadius: "1px" }} />
                    <div style={{ height: "65%", width: "4px", background: "rgba(255, 200, 87, 0.5)", borderRadius: "1px" }} />
                    <div style={{ height: "95%", width: "4px", background: "#FFC857", borderRadius: "1px" }} />
                  </div>
                </div>
              </GlassCard>

              {/* Widget 4: Quick Command */}
              <GlassCard glowColor="purple" header="CYBER STREAM" hoverEffect={true}>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", height: "100%", justifyContent: "space-between" }}>
                  <p style={{ fontSize: "10.5px", color: "rgba(148,163,184,0.75)", fontFamily: "monospace", lineHeight: "1.4" }}>
                    &gt; connect -addr wss://ai.nexus.os/stream<br />
                    &gt; status: CONNECTED
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span className="nx-pulse" style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#6E56FF", display: "inline-block" }} />
                    <span style={{ fontSize: "9px", fontFamily: "monospace", color: "#6E56FF", fontWeight: "bold" }}>STREAM RUNNING</span>
                  </div>
                </div>
              </GlassCard>

            </div>

          </div>

          {/* ================= CODE SNIPPET AREA ================= */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            
            {/* GlassCard code snippet */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <span className="hud-label" style={{ fontSize: "9px" }}>GLASSCARD REUSABLE COMPONENT SNIPPET</span>
                <button
                  onClick={() => copyToClipboard(getGlassCardCode(), "glass")}
                  style={{ display: "flex", alignItems: "center", gap: "5px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", padding: "4px 8px", cursor: "pointer", color: "#fff", fontSize: "10px", fontFamily: "monospace" }}
                >
                  {copiedCode === "glass" ? <Check style={{ width: "10px", height: "10px", color: "#00FF88" }} /> : <Copy style={{ width: "10px", height: "10px" }} />}
                  {copiedCode === "glass" ? "COPIED" : "COPY"}
                </button>
              </div>
              <pre style={preBlockStyle}>
                <code>{getGlassCardCode()}</code>
              </pre>
            </div>

            {/* ParticleBackground code snippet */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <span className="hud-label" style={{ fontSize: "9px" }}>PARTICLEBACKGROUND REUSABLE COMPONENT SNIPPET</span>
                <button
                  onClick={() => copyToClipboard(getParticlesCode(), "particles")}
                  style={{ display: "flex", alignItems: "center", gap: "5px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", padding: "4px 8px", cursor: "pointer", color: "#fff", fontSize: "10px", fontFamily: "monospace" }}
                >
                  {copiedCode === "particles" ? <Check style={{ width: "10px", height: "10px", color: "#00FF88" }} /> : <Copy style={{ width: "10px", height: "10px" }} />}
                  {copiedCode === "particles" ? "COPIED" : "COPY"}
                </button>
              </div>
              <pre style={preBlockStyle}>
                <code>{getParticlesCode()}</code>
              </pre>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
