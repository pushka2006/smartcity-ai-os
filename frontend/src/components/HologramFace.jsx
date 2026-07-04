import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Volume2, VolumeX, Radio, Cpu } from "lucide-react";

/**
 * HologramFace — renders a math-driven 3D glowing wireframe face on a HTML5 Canvas.
 * Animates in real-time, responding to talking and thinking states.
 * Has HUD buttons to toggle Speech synthesis (Text-to-Speech) and Speech recognition (mic).
 */
export default function HologramFace({
  isTalking = false,
  isThinking = false,
  voiceEnabled = true,
  onToggleVoice = () => {},
  isListening = false,
  onToggleListen = () => {},
  accentColor = "#00f5ff"
}) {
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle high DPI screens
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // ── Generate 3D Vertices representing a Cybernetic Head / Face ──
    const vertices = [];
    const connections = [];

    // 1. Sphere Lattice (The head structure)
    const latLines = 7;
    const lonLines = 12;
    const radius = 1.0;

    for (let i = 0; i <= latLines; i++) {
      const lat = (Math.PI * i) / latLines - Math.PI / 2; // -pi/2 to pi/2
      const y = Math.sin(lat) * radius;
      const r_slice = Math.cos(lat) * radius;

      for (let j = 0; j < lonLines; j++) {
        const lon = (2 * Math.PI * j) / lonLines; // 0 to 2pi
        const x = Math.cos(lon) * r_slice;
        const z = Math.sin(lon) * r_slice;

        // Push vertex with category 'head'
        vertices.push({ x, y, z, category: "head", latIndex: i, lonIndex: j });
      }
    }

    // Connect head latitude & longitude grids
    const totalHeadPoints = vertices.length;
    for (let i = 0; i < totalHeadPoints; i++) {
      const pt = vertices[i];
      // Connect to next longitude node
      const nextLonIndex = pt.lonIndex === lonLines - 1 ? i - lonLines + 1 : i + 1;
      connections.push({ from: i, to: nextLonIndex, type: "grid" });

      // Connect to next latitude node
      const nextLatIndex = i + lonLines;
      if (nextLatIndex < totalHeadPoints) {
        connections.push({ from: i, to: nextLatIndex, type: "grid" });
      }
    }

    // 2. Face Mask Overlay (Features: Eyes, Nose, Mouth)
    // We add special features positioned on the front (+Z) of the sphere
    const startFeatureIndex = vertices.length;

    // Left Eye (Circle of points)
    const eyeRadius = 0.12;
    const eyeZ = 0.95;
    for (let a = 0; a < 8; a++) {
      const angle = (Math.PI * 2 * a) / 8;
      vertices.push({
        x: -0.32 + Math.cos(angle) * eyeRadius,
        y: 0.15 + Math.sin(angle) * eyeRadius,
        z: eyeZ,
        category: "eye_l"
      });
    }
    // Connect eye circle
    for (let a = 0; a < 8; a++) {
      const from = startFeatureIndex + a;
      const to = startFeatureIndex + (a === 7 ? 0 : a + 1);
      connections.push({ from, to, type: "feature" });
    }

    // Right Eye
    for (let a = 0; a < 8; a++) {
      const angle = (Math.PI * 2 * a) / 8;
      vertices.push({
        x: 0.32 + Math.cos(angle) * eyeRadius,
        y: 0.15 + Math.sin(angle) * eyeRadius,
        z: eyeZ,
        category: "eye_r"
      });
    }
    // Connect eye circle
    for (let a = 0; a < 8; a++) {
      const from = startFeatureIndex + 8 + a;
      const to = startFeatureIndex + 8 + (a === 7 ? 0 : a + 1);
      connections.push({ from, to, type: "feature" });
    }

    // Nose (Vertical line + base triangle)
    const noseStartIndex = vertices.length;
    vertices.push({ x: 0, y: 0.15, z: 1.05, category: "nose" }); // Bridge top
    vertices.push({ x: 0, y: -0.1, z: 1.15, category: "nose" });  // Tip
    vertices.push({ x: -0.12, y: -0.15, z: 1.02, category: "nose" }); // Left nostril
    vertices.push({ x: 0.12, y: -0.15, z: 1.02, category: "nose" });  // Right nostril
    // Connect nose
    connections.push({ from: noseStartIndex, to: noseStartIndex + 1, type: "feature" });
    connections.push({ from: noseStartIndex + 1, to: noseStartIndex + 2, type: "feature" });
    connections.push({ from: noseStartIndex + 1, to: noseStartIndex + 3, type: "feature" });
    connections.push({ from: noseStartIndex + 2, to: noseStartIndex + 3, type: "feature" });

    // Mouth (Concentric curves that move dynamically)
    const mouthStartIndex = vertices.length;
    const mouthPoints = 7;
    for (let a = 0; a < mouthPoints; a++) {
      const pct = a / (mouthPoints - 1); // 0 to 1
      const x = -0.25 + pct * 0.5; // -0.25 to 0.25
      // Base curve
      const y = -0.32 - Math.pow(x, 2) * 0.4;
      vertices.push({ x, y, z: 0.95, category: "mouth", index: a });
    }
    // Connect mouth line
    for (let a = 0; a < mouthPoints - 1; a++) {
      const from = mouthStartIndex + a;
      const to = mouthStartIndex + a + 1;
      connections.push({ from, to, type: "mouth" });
    }

    // ── Animation Loop ──
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const w = canvas.width / window.devicePixelRatio;
      const h = canvas.height / window.devicePixelRatio;
      const cX = w / 2;
      const cY = h / 2 - 5;
      const scale = Math.min(w, h) * 0.42;

      timeRef.current += isThinking ? 0.045 : isTalking ? 0.022 : 0.012;
      const time = timeRef.current;

      // Holographic theme color shifting based on state
      let glowColor = accentColor;
      if (isThinking) glowColor = "#a78bfa"; // Thinking purple
      else if (isListening) glowColor = "#FF2E88"; // Listening pink-red
      else if (isTalking) glowColor = "#00f5ff";

      // 3D rotation angles
      const rotY = time * 0.85; // Spin head
      const rotX = 0.18 + Math.sin(time * 0.4) * 0.08; // Breathe tilt up/down
      const rotZ = Math.cos(time * 0.3) * 0.04;

      // Projection parameters
      const d = 2.0; // Distance of projection
      const cameraZ = 2.6; // Distance from screen

      // Project vertices to 2D
      const projected = vertices.map((v) => {
        let x = v.x;
        let y = v.y;
        let z = v.z;

        // Dynamic Mouth Motion when talking
        if (v.category === "mouth") {
          const talkingOffset = isTalking
            ? Math.sin(time * 18 + v.index) * 0.075 * (1 - Math.abs(v.index - 3) / 3)
            : 0;
          y += talkingOffset;
        }

        // Slight breathing deformation
        const pulse = 1.0 + Math.sin(time * 3 + y * 2) * 0.022;
        x *= pulse;
        y *= pulse;
        z *= pulse;

        // 3D Rotations
        // 1. Y Rotation (Spin)
        const cosY = Math.cos(rotY);
        const sinY = Math.sin(rotY);
        const x1 = x * cosY - z * sinY;
        const z1 = x * sinY + z * cosY;

        // 2. X Rotation (Tilt)
        const cosX = Math.cos(rotX);
        const sinX = Math.sin(rotX);
        const y2 = y * cosX - z1 * sinX;
        const z2 = y * sinX + z1 * cosX;

        // 3. Z Rotation (Roll)
        const cosZ = Math.cos(rotZ);
        const sinZ = Math.sin(rotZ);
        const x3 = x1 * cosZ - y2 * sinZ;
        const y3 = x1 * sinZ + y2 * cosZ;

        // Perspective Projection
        const divisor = z2 + cameraZ;
        const projX = (x3 * d * scale) / divisor + cX;
        const projY = (-y3 * d * scale) / divisor + cY; // Invert Y for canvas coords

        return { x: projX, y: projY, depth: z2, category: v.category };
      });

      // ── Draw Hologram Projector Base & Light Cone (J.A.R.V.I.S. Style) ──
      const pY = h - 35; // base Y position
      const pRx = scale * 0.9;
      const pRy = 14;

      // Projector glow gradient cone
      const coneGrad = ctx.createLinearGradient(cX, pY, cX, cY + 20);
      coneGrad.addColorStop(0, `${glowColor}38`);
      coneGrad.addColorStop(0.3, `${glowColor}18`);
      coneGrad.addColorStop(1, `${glowColor}00`);
      ctx.fillStyle = coneGrad;

      ctx.beginPath();
      ctx.moveTo(cX - pRx * 0.65, pY);
      ctx.lineTo(cX - scale * 0.45, cY + 20);
      ctx.lineTo(cX + scale * 0.45, cY + 20);
      ctx.lineTo(cX + pRx * 0.65, pY);
      ctx.closePath();
      ctx.fill();

      // Core scanning beams
      ctx.strokeStyle = `${glowColor}15`;
      ctx.lineWidth = 1;
      for (let i = -4; i <= 4; i++) {
        const startX = cX + i * (pRx * 0.16);
        const endX = cX + i * (scale * 0.1);
        ctx.beginPath();
        ctx.moveTo(startX, pY);
        ctx.lineTo(endX, cY - 10);
        ctx.stroke();
      }

      // Outer projector rings
      ctx.strokeStyle = `${glowColor}66`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(cX, pY, pRx, pRy, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = `${glowColor}30`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(cX, pY, pRx * 0.78, pRy * 0.78, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = `${glowColor}18`;
      ctx.beginPath();
      ctx.ellipse(cX, pY, pRx * 0.55, pRy * 0.55, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Pulsing projector core
      const corePulse = 1.0 + Math.sin(time * 8) * 0.1;
      ctx.fillStyle = glowColor;
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.ellipse(cX, pY, pRx * 0.2 * corePulse, pRy * 0.2 * corePulse, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0; // reset

      // ── Draw grid wireframes ──
      ctx.lineWidth = 0.5;
      connections.forEach((conn) => {
        const fromPt = projected[conn.from];
        const toPt = projected[conn.to];

        // Simple back-face culling for cleaner aesthetics: don't draw lines deep in the back
        if (fromPt.depth > 0.65 && toPt.depth > 0.65 && conn.type === "grid") return;

        // Calculate opacity based on depth (closer points are brighter)
        const avgDepth = (fromPt.depth + toPt.depth) / 2;
        const alpha = Math.max(0.04, 0.42 - avgDepth * 0.25);

        ctx.strokeStyle = conn.type === "feature" || conn.type === "mouth"
          ? `${glowColor}cc` // Features are brighter
          : `${glowColor}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;

        ctx.lineWidth = conn.type === "feature" || conn.type === "mouth" ? 1.2 : 0.65;

        // Draw line
        ctx.beginPath();
        ctx.moveTo(fromPt.x, fromPt.y);
        ctx.lineTo(toPt.x, toPt.y);
        ctx.stroke();
      });

      // ── Draw Glow Nodes on key intersections ──
      projected.forEach((pt) => {
        if (pt.depth > 0.4 && pt.category === "head") return; // Cull back points
        const alpha = Math.max(0.05, 0.65 - pt.depth * 0.35);

        ctx.fillStyle = pt.category !== "head"
          ? `${glowColor}` // Core face points glow brightly
          : `${glowColor}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;

        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.category !== "head" ? 1.8 : 1.0, 0, Math.PI * 2);
        ctx.fill();

        // Neon Glow effect for features
        if (pt.category !== "head" && pt.depth < 0.2) {
          ctx.shadowColor = glowColor;
          ctx.shadowBlur = 10;
          ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = `${glowColor}33`;
          ctx.fill();
          ctx.shadowBlur = 0; // reset
        }
      });

      // ── Cybernetic HUD Overlays (HUD Circular Reticle) ──
      ctx.strokeStyle = `${glowColor}18`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cX, cY, scale * 1.3, 0, Math.PI * 2);
      ctx.stroke();

      // Dashed tracking lines
      ctx.setLineDash([4, 15]);
      ctx.strokeStyle = `${glowColor}33`;
      ctx.beginPath();
      ctx.arc(cX, cY, scale * 1.38, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]); // Reset

      // Corner Tech brackets
      const br = scale * 1.45;
      ctx.strokeStyle = `${glowColor}40`;
      ctx.lineWidth = 1.5;
      // Top-Left Bracket
      ctx.beginPath();
      ctx.moveTo(cX - br + 12, cY - br);
      ctx.lineTo(cX - br, cY - br);
      ctx.lineTo(cX - br, cY - br + 12);
      ctx.stroke();
      // Top-Right Bracket
      ctx.beginPath();
      ctx.moveTo(cX + br - 12, cY - br);
      ctx.lineTo(cX + br, cY - br);
      ctx.lineTo(cX + br, cY - br + 12);
      ctx.stroke();
      // Bottom-Left
      ctx.beginPath();
      ctx.moveTo(cX - br + 12, cY + br);
      ctx.lineTo(cX - br, cY + br);
      ctx.lineTo(cX - br, cY + br - 12);
      ctx.stroke();
      // Bottom-Right
      ctx.beginPath();
      ctx.moveTo(cX + br - 12, cY + br);
      ctx.lineTo(cX + br, cY + br);
      ctx.lineTo(cX + br, cY + br - 12);
      ctx.stroke();

      // Draw sound frequency wave lines at the bottom when speaking
      if (isTalking) {
        ctx.strokeStyle = `${glowColor}bb`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i <= 20; i++) {
          const waveX = cX - 60 + i * 6;
          const waveAmp = Math.sin(time * 25 + i * 0.8) * 12 * Math.sin((i / 20) * Math.PI);
          if (i === 0) ctx.moveTo(waveX, h - 25 + waveAmp);
          else ctx.lineTo(waveX, h - 25 + waveAmp);
        }
        ctx.stroke();
      }

      // Vertical Computing Scanline when thinking
      if (isThinking) {
        const scanlineY = cY - br + ((time * 60) % (br * 2));
        ctx.fillStyle = `${glowColor}14`;
        ctx.fillRect(cX - br, scanlineY, br * 2, 2);
        ctx.fillStyle = `${glowColor}05`;
        ctx.fillRect(cX - br, scanlineY - 4, br * 2, 10);
      }

      // Text Overlays
      ctx.fillStyle = `${glowColor}88`;
      ctx.font = "8px 'JetBrains Mono', monospace";
      ctx.fillText("DEC: NOMINAL", cX - br + 8, cY - br + 14);
      ctx.fillText(`ROT-Y: ${Math.round((rotY % (Math.PI * 2)) * 57.3)}°`, cX - br + 8, cY - br + 26);
      ctx.fillText(`SYS-MODE: ${isListening ? "INPUT_ACTIVE" : isThinking ? "COMPUTING" : isTalking ? "VOCALIZING" : "STANDBY"}`, cX - br + 8, cY + br - 8);

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isTalking, isThinking, isListening, accentColor]);

  return (
    <div
      style={{
        background: "rgba(2, 6, 23, 0.4)",
        border: "1px solid rgba(0, 245, 255, 0.15)",
        boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
        backdropFilter: "blur(8px)",
        borderRadius: 12,
        padding: 10,
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        overflow: "hidden",
        width: "100%",
        boxSizing: "border-box"
      }}
    >
      {/* Glitch Tech Banner */}
      <div
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid rgba(0, 245, 255, 0.15)",
          paddingBottom: 6,
          marginBottom: 8,
          boxSizing: "border-box"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Radio style={{ width: 12, height: 12, color: "#00f5ff", animation: isListening ? "pulse 1.2s infinite" : "none" }} />
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9,
              letterSpacing: "0.15em",
              color: "#00f5ff",
              fontWeight: 700
            }}
          >
            NEXUS HOLOGRAM OS v1.0
          </span>
        </div>
        <div style={{ display: "flex", gap: 3 }}>
          <span style={{ width: 4, height: 4, borderRadius: "50%", background: isListening ? "#FF2E88" : isThinking ? "#a78bfa" : "#34d399", display: "inline-block" }} />
          <span style={{ width: 4, height: 4, borderRadius: "50%", background: isListening ? "#FF2E88" : isThinking ? "#a78bfa" : "#34d399", display: "inline-block", opacity: 0.5 }} />
        </div>
      </div>

      {/* Hologram Canvas Viewport */}
      <div style={{ width: "100%", height: 160, position: "relative" }}>
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
      </div>

      {/* Interactive Controls HUD */}
      <div
        style={{
          display: "flex",
          width: "100%",
          justifyContent: "space-around",
          alignItems: "center",
          marginTop: 6,
          paddingTop: 8,
          borderTop: "1px solid rgba(255,255,255,0.06)",
          boxSizing: "border-box"
        }}
      >
        {/* Toggle Voice Output (TTS) */}
        <button
          onClick={onToggleVoice}
          title={voiceEnabled ? "Mute Voice Output" : "Enable Voice Output"}
          style={{
            background: voiceEnabled ? "rgba(0, 245, 255, 0.1)" : "rgba(255, 255, 255, 0.03)",
            border: `1px solid ${voiceEnabled ? "rgba(0, 245, 255, 0.35)" : "rgba(255,255,255,0.1)"}`,
            borderRadius: 6,
            padding: "5px 12px",
            display: "flex",
            alignItems: "center",
            gap: 6,
            color: voiceEnabled ? "#00f5ff" : "rgba(148,163,184,0.6)",
            cursor: "pointer",
            fontSize: 9,
            fontFamily: "monospace",
            letterSpacing: "0.05em",
            transition: "all 0.2s"
          }}
        >
          {voiceEnabled ? <Volume2 style={{ width: 12, height: 12 }} /> : <VolumeX style={{ width: 12, height: 12 }} />}
          VOICE: {voiceEnabled ? "ON" : "OFF"}
        </button>

        {/* Toggle Voice Input (Mic) */}
        <button
          onClick={onToggleListen}
          title={isListening ? "Stop listening" : "Start Voice Input"}
          style={{
            background: isListening ? "rgba(255, 46, 136, 0.12)" : "rgba(255, 255, 255, 0.03)",
            border: `1px solid ${isListening ? "rgba(255, 46, 136, 0.45)" : "rgba(255,255,255,0.1)"}`,
            borderRadius: 6,
            padding: "5px 12px",
            display: "flex",
            alignItems: "center",
            gap: 6,
            color: isListening ? "#FF2E88" : "rgba(148,163,184,0.6)",
            cursor: "pointer",
            fontSize: 9,
            fontFamily: "monospace",
            letterSpacing: "0.05em",
            transition: "all 0.2s"
          }}
        >
          {isListening ? <Mic style={{ width: 12, height: 12, animation: "pulse 1.2s infinite" }} /> : <MicOff style={{ width: 12, height: 12 }} />}
          MIC: {isListening ? "LISTENING" : "MUTED"}
        </button>
      </div>
    </div>
  );
}
