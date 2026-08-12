import { useEffect, useRef } from "react";
import { Mic, MicOff, Volume2, VolumeX, Radio } from "lucide-react";

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

    // 1. Sphere Lattice (The head structure) — denser grid
    const latLines = 9;
    const lonLines = 14;
    const radius = 1.0;

    for (let i = 0; i <= latLines; i++) {
      const lat = (Math.PI * i) / latLines - Math.PI / 2;
      const y = Math.sin(lat) * radius;
      const r_slice = Math.cos(lat) * radius;

      for (let j = 0; j < lonLines; j++) {
        const lon = (2 * Math.PI * j) / lonLines;
        const x = Math.cos(lon) * r_slice;
        const z = Math.sin(lon) * r_slice;
        vertices.push({ x, y, z, category: "head", latIndex: i, lonIndex: j });
      }
    }

    // Connect head grid
    const totalHeadPoints = vertices.length;
    for (let i = 0; i < totalHeadPoints; i++) {
      const pt = vertices[i];
      const nextLonIndex = pt.lonIndex === lonLines - 1 ? i - lonLines + 1 : i + 1;
      connections.push({ from: i, to: nextLonIndex, type: "grid" });
      const nextLatIndex = i + lonLines;
      if (nextLatIndex < totalHeadPoints) {
        connections.push({ from: i, to: nextLatIndex, type: "grid" });
      }
    }

    // 2. Face Features — Eyes, Eyebrows, Nose, Mouth, Jaw, Cheekbones
    const eyeZ = 0.97;
    function addEye(cx, cy, startIdx) {
      const outerR = 0.13;
      const innerR = 0.065;
      const pts = 10;
      for (let a = 0; a < pts; a++) {
        const angle = (Math.PI * 2 * a) / pts;
        vertices.push({ x: cx + Math.cos(angle) * outerR, y: cy + Math.sin(angle) * outerR, z: eyeZ, category: "eye" });
      }
      for (let a = 0; a < pts; a++) {
        connections.push({ from: startIdx + a, to: startIdx + (a === pts - 1 ? 0 : a + 1), type: "feature" });
      }
      for (let a = 0; a < pts; a++) {
        const angle = (Math.PI * 2 * a) / pts;
        vertices.push({ x: cx + Math.cos(angle) * innerR, y: cy + Math.sin(angle) * innerR, z: eyeZ + 0.02, category: "eye_inner" });
      }
      for (let a = 0; a < pts; a++) {
        connections.push({ from: startIdx + pts + a, to: startIdx + pts + (a === pts - 1 ? 0 : a + 1), type: "iris" });
        connections.push({ from: startIdx + a, to: startIdx + pts + a, type: "iris" });
      }
      return startIdx + pts * 2;
    }

    let nextIdx = totalHeadPoints;
    nextIdx = addEye(-0.31, 0.16, nextIdx);
    nextIdx = addEye(0.31, 0.16, nextIdx);

    // Eyebrows
    function addBrow(cx, cy) {
      const pts = 5;
      const bStart = vertices.length;
      for (let a = 0; a < pts; a++) {
        const pct = a / (pts - 1);
        const bx = cx - 0.16 + pct * 0.32;
        const by = cy + 0.1 - Math.pow((pct - 0.5) * 2, 2) * 0.04;
        vertices.push({ x: bx, y: by, z: eyeZ - 0.08, category: "brow" });
      }
      for (let a = 0; a < pts - 1; a++) {
        connections.push({ from: bStart + a, to: bStart + a + 1, type: "feature" });
      }
    }
    addBrow(-0.31, 0.32);
    addBrow(0.31, 0.32);

    // Nose
    const noseStartIndex = vertices.length;
    vertices.push({ x: 0, y: 0.14, z: 1.06, category: "nose" });
    vertices.push({ x: 0, y: -0.08, z: 1.17, category: "nose" });
    vertices.push({ x: -0.13, y: -0.14, z: 1.03, category: "nose" });
    vertices.push({ x: 0.13, y: -0.14, z: 1.03, category: "nose" });
    connections.push({ from: noseStartIndex, to: noseStartIndex + 1, type: "feature" });
    connections.push({ from: noseStartIndex + 1, to: noseStartIndex + 2, type: "feature" });
    connections.push({ from: noseStartIndex + 1, to: noseStartIndex + 3, type: "feature" });
    connections.push({ from: noseStartIndex + 2, to: noseStartIndex + 3, type: "feature" });

    // Mouth — upper + lower lip
    const mouthStartIndex = vertices.length;
    const mouthPoints = 9;
    for (let a = 0; a < mouthPoints; a++) {
      const pct = a / (mouthPoints - 1);
      const x = -0.28 + pct * 0.56;
      const y = -0.295 - Math.pow((pct - 0.5) * 2, 2) * 0.05 + (pct > 0.35 && pct < 0.65 ? 0.022 : 0);
      vertices.push({ x, y, z: 0.96, category: "mouth", index: a });
    }
    for (let a = 0; a < mouthPoints; a++) {
      const pct = a / (mouthPoints - 1);
      const x = -0.26 + pct * 0.52;
      const y = -0.365 - Math.pow((pct - 0.5) * 2, 2) * 0.06;
      vertices.push({ x, y, z: 0.95, category: "mouth_low", index: a });
    }
    for (let a = 0; a < mouthPoints - 1; a++) {
      connections.push({ from: mouthStartIndex + a, to: mouthStartIndex + a + 1, type: "mouth" });
      connections.push({ from: mouthStartIndex + mouthPoints + a, to: mouthStartIndex + mouthPoints + a + 1, type: "mouth" });
    }
    connections.push({ from: mouthStartIndex, to: mouthStartIndex + mouthPoints, type: "mouth" });
    connections.push({ from: mouthStartIndex + mouthPoints - 1, to: mouthStartIndex + mouthPoints * 2 - 1, type: "mouth" });

    // Jaw definition
    const jawPts = 7;
    const jawStart = vertices.length;
    for (let a = 0; a < jawPts; a++) {
      const pct = a / (jawPts - 1);
      const angle = -Math.PI * 0.25 + pct * Math.PI * 0.5;
      vertices.push({ x: Math.cos(angle) * 0.88, y: -0.72, z: Math.sin(angle) * 0.42, category: "jaw" });
    }
    for (let a = 0; a < jawPts - 1; a++) {
      connections.push({ from: jawStart + a, to: jawStart + a + 1, type: "feature" });
    }

    // Cheekbone cross-hatches
    for (const side of [-1, 1]) {
      const chkStart = vertices.length;
      for (let a = 0; a < 4; a++) {
        vertices.push({ x: side * (0.55 + a * 0.04), y: -0.04 - a * 0.07, z: 0.83 - a * 0.05, category: "cheek" });
      }
      for (let a = 0; a < 3; a++) {
        connections.push({ from: chkStart + a, to: chkStart + a + 1, type: "feature" });
      }
    }

    // ── Animation Loop ──
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const w = canvas.width / window.devicePixelRatio;
      const h = canvas.height / window.devicePixelRatio;
      const cX = w / 2;
      const cY = h / 2 - 8;
      const scale = Math.min(w, h) * 0.43;

      timeRef.current += isThinking ? 0.048 : isTalking ? 0.024 : 0.013;
      const time = timeRef.current;

      // State-driven glow color
      let glowColor = accentColor;
      if (isThinking) glowColor = "#a78bfa";
      else if (isListening) glowColor = "#FF2E88";
      else if (isTalking) glowColor = "#00f5ff";

      const accentAlt = isThinking ? "#e879f9" : isListening ? "#ff6eb4" : "#38bdf8";

      // 3D rotation
      const rotY = time * 0.82;
      const rotX = 0.2 + Math.sin(time * 0.38) * 0.1;
      const rotZ = Math.cos(time * 0.28) * 0.035;
      const d = 2.0;
      const cameraZ = 2.7;

      // Project vertices to 2D
      const projected = vertices.map((v) => {
        let x = v.x;
        let y = v.y;
        let z = v.z;

        // Animated mouth
        if (v.category === "mouth" || v.category === "mouth_low") {
          const amp = isTalking ? 0.08 : 0;
          const dir = v.category === "mouth_low" ? -1 : 1;
          const midFactor = 1 - Math.abs(((v.index || 0) - (mouthPoints - 1) / 2) / ((mouthPoints - 1) / 2)) * 0.6;
          y += dir * Math.abs(Math.sin(time * 20 + (v.index || 0) * 0.6)) * amp * midFactor;
        }

        // Eye iris dilation
        if (v.category === "eye_inner") {
          const dilation = 1.0 + Math.sin(time * 4) * 0.1;
          x *= dilation; y *= dilation;
        }

        // Breathing pulse
        const pulse = 1.0 + Math.sin(time * 2.8 + y * 2) * 0.018;
        x *= pulse; y *= pulse; z *= pulse;

        // Y rotation
        const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
        const x1 = x * cosY - z * sinY;
        const z1 = x * sinY + z * cosY;
        // X rotation
        const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
        const y2 = y * cosX - z1 * sinX;
        const z2 = y * sinX + z1 * cosX;
        // Z rotation
        const cosZ = Math.cos(rotZ), sinZ = Math.sin(rotZ);
        const x3 = x1 * cosZ - y2 * sinZ;
        const y3 = x1 * sinZ + y2 * cosZ;

        const divisor = z2 + cameraZ;
        return {
          x: (x3 * d * scale) / divisor + cX,
          y: (-y3 * d * scale) / divisor + cY,
          depth: z2,
          category: v.category
        };
      });

      // ── Background ambient fog ──────────────────────────────────────────
      const bgGrad = ctx.createRadialGradient(cX, cY, scale * 0.1, cX, cY, scale * 2.0);
      bgGrad.addColorStop(0, `${glowColor}09`);
      bgGrad.addColorStop(0.6, `${glowColor}04`);
      bgGrad.addColorStop(1, `${glowColor}00`);
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // ── Projector Base ──────────────────────────────────────────────────
      const pY = h - 30;
      const pRx = scale * 0.88;
      const pRy = 13;

      const coneGrad = ctx.createLinearGradient(cX, pY, cX, cY + 28);
      coneGrad.addColorStop(0, `${glowColor}42`);
      coneGrad.addColorStop(0.25, `${glowColor}1c`);
      coneGrad.addColorStop(1, `${glowColor}00`);
      ctx.fillStyle = coneGrad;
      ctx.beginPath();
      ctx.moveTo(cX - pRx * 0.62, pY);
      ctx.lineTo(cX - scale * 0.48, cY + 28);
      ctx.lineTo(cX + scale * 0.48, cY + 28);
      ctx.lineTo(cX + pRx * 0.62, pY);
      ctx.closePath();
      ctx.fill();

      for (let i = -5; i <= 5; i++) {
        ctx.strokeStyle = `${glowColor}12`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(cX + i * (pRx * 0.14), pY);
        ctx.lineTo(cX + i * (scale * 0.09), cY - 14);
        ctx.stroke();
      }

      [1.0, 0.8, 0.6, 0.42].forEach((rs, ri) => {
        ctx.strokeStyle = `${glowColor}${["88","44","22","11"][ri]}`;
        ctx.lineWidth = ri === 0 ? 2.5 : 1;
        ctx.beginPath();
        ctx.ellipse(cX, pY, pRx * rs, pRy * rs, 0, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Rotating particle ring on projector
      for (let p = 0; p < 12; p++) {
        const angle = (p / 12) * Math.PI * 2 + time * 1.8;
        const px = cX + Math.cos(angle) * pRx * 0.72;
        const py = pY + Math.sin(angle) * pRy * 0.72;
        const alpha = 0.45 + Math.sin(time * 6 + p) * 0.3;
        ctx.fillStyle = `${glowColor}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;
        ctx.beginPath();
        ctx.arc(px, py, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }

      const corePulse = 1.0 + Math.sin(time * 9) * 0.12;
      const coreGrad = ctx.createRadialGradient(cX, pY, 0, cX, pY, pRx * 0.22 * corePulse);
      coreGrad.addColorStop(0, glowColor);
      coreGrad.addColorStop(0.5, `${glowColor}88`);
      coreGrad.addColorStop(1, `${glowColor}00`);
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.ellipse(cX, pY, pRx * 0.22 * corePulse, pRy * 0.22 * corePulse, 0, 0, Math.PI * 2);
      ctx.fill();

      // ── Wireframe Edges ──────────────────────────────────────────────────
      connections.forEach((conn) => {
        const fromPt = projected[conn.from];
        const toPt = projected[conn.to];
        if (!fromPt || !toPt) return;
        if (fromPt.depth > 0.62 && toPt.depth > 0.62 && conn.type === "grid") return;

        const avgDepth = (fromPt.depth + toPt.depth) / 2;
        const depthAlpha = Math.max(0.05, 0.58 - avgDepth * 0.38);

        let strokeColor, lineW;
        if (conn.type === "iris") {
          strokeColor = `${accentAlt}ee`;
          lineW = 1.0;
        } else if (conn.type === "feature" || conn.type === "mouth") {
          strokeColor = `${glowColor}dd`;
          lineW = 1.4;
        } else {
          strokeColor = `${glowColor}${Math.round(depthAlpha * 255).toString(16).padStart(2, "0")}`;
          lineW = 0.7;
        }
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineW;
        ctx.beginPath();
        ctx.moveTo(fromPt.x, fromPt.y);
        ctx.lineTo(toPt.x, toPt.y);
        ctx.stroke();
      });

      // ── Vertex Nodes ─────────────────────────────────────────────────────
      projected.forEach((pt) => {
        if (pt.depth > 0.45 && pt.category === "head") return;
        const alpha = Math.max(0.08, 0.78 - pt.depth * 0.48);
        const isEye = pt.category === "eye" || pt.category === "eye_inner";
        const isFace = pt.category !== "head";

        // Outer halo for eye nodes
        if (isEye && pt.depth < 0.3) {
          const haloR = pt.category === "eye" ? 5 : 3.5;
          const haloGrad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, haloR);
          haloGrad.addColorStop(0, `${accentAlt}88`);
          haloGrad.addColorStop(1, `${accentAlt}00`);
          ctx.fillStyle = haloGrad;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, haloR, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = isEye ? accentAlt : isFace ? glowColor
          : `${glowColor}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;
        const dotR = isEye ? 2.2 : isFace ? 1.7 : 0.9;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, dotR, 0, Math.PI * 2);
        ctx.fill();

        if (isFace && pt.depth < 0.15) {
          ctx.shadowColor = isEye ? accentAlt : glowColor;
          ctx.shadowBlur = isEye ? 14 : 8;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, dotR + 0.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      });

      // ── Floating Halo Particle Ring ─────────────────────────────────────
      const haloR = scale * 0.78;
      for (let p = 0; p < 48; p++) {
        const angle = (p / 48) * Math.PI * 2 + time * 0.4;
        const wobble = Math.sin(time * 3 + p * 0.5) * scale * 0.028;
        const px = cX + Math.cos(angle) * (haloR + wobble);
        const py = cY + Math.sin(angle) * (haloR * 0.36 + wobble * 0.4);
        const alpha = 0.18 + Math.sin(time * 5 + p * 0.8) * 0.12;
        ctx.fillStyle = `${glowColor}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;
        ctx.beginPath();
        ctx.arc(px, py, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // ── Iridescent Rim Glow ──────────────────────────────────────────────
      ctx.strokeStyle = `${glowColor}28`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cX, cY, scale * 0.9, 0, Math.PI * 2);
      ctx.stroke();

      // ── HUD Rings ────────────────────────────────────────────────────────
      ctx.strokeStyle = `${glowColor}1a`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cX, cY, scale * 1.28, 0, Math.PI * 2);
      ctx.stroke();

      ctx.setLineDash([3, 14]);
      ctx.strokeStyle = `${glowColor}38`;
      ctx.beginPath();
      ctx.arc(cX, cY, scale * 1.36, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Rotating tick marks
      for (let t = 0; t < 24; t++) {
        const tAngle = (t / 24) * Math.PI * 2 + time * 0.18;
        const isMajor = t % 6 === 0;
        const r1 = scale * 1.36;
        const r2 = r1 + (isMajor ? 8 : 4);
        ctx.strokeStyle = `${glowColor}${isMajor ? "88" : "33"}`;
        ctx.lineWidth = isMajor ? 1.5 : 0.8;
        ctx.beginPath();
        ctx.moveTo(cX + Math.cos(tAngle) * r1, cY + Math.sin(tAngle) * r1);
        ctx.lineTo(cX + Math.cos(tAngle) * r2, cY + Math.sin(tAngle) * r2);
        ctx.stroke();
      }

      // Corner tech brackets
      const br = scale * 1.44;
      ctx.strokeStyle = `${glowColor}55`;
      ctx.lineWidth = 1.8;
      [[cX - br, cY - br, 1, 1],[cX + br, cY - br, -1, 1],[cX - br, cY + br, 1, -1],[cX + br, cY + br, -1, -1]]
        .forEach(([bx, by, sx, sy]) => {
          ctx.beginPath();
          ctx.moveTo(bx + sx * 14, by);
          ctx.lineTo(bx, by);
          ctx.lineTo(bx, by + sy * 14);
          ctx.stroke();
        });

      // ── Bio-scan beam ───────────────────────────────────────────────────
      const scanY = cY - scale * 0.88 + ((time * 55) % (scale * 1.76));
      const scanGrad = ctx.createLinearGradient(cX - scale, scanY, cX + scale, scanY);
      scanGrad.addColorStop(0, `${glowColor}00`);
      scanGrad.addColorStop(0.5, `${glowColor}22`);
      scanGrad.addColorStop(1, `${glowColor}00`);
      ctx.fillStyle = scanGrad;
      ctx.fillRect(cX - scale, scanY - 1, scale * 2, 2);
      ctx.fillStyle = `${glowColor}55`;
      ctx.fillRect(cX - scale, scanY, scale * 2, 0.5);

      // ── Forehead Data Matrix ─────────────────────────────────────────────
      ctx.fillStyle = `${glowColor}2e`;
      ctx.font = "6px 'JetBrains Mono', monospace";
      const matrixChars = "01▮▯◈⬡✦◎";
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 6; c++) {
          const ci = Math.floor((time * 8 + r * 6 + c) * 2.3) % matrixChars.length;
          ctx.fillText(matrixChars[ci], cX - 17 + c * 6, cY - scale * 0.72 + r * 8);
        }
      }

      // ── Waveform bars when talking ──────────────────────────────────────
      if (isTalking) {
        for (let i = 0; i < 28; i++) {
          const waveX = cX - 42 + i * 3;
          const amp = Math.sin(time * 22 + i * 1.1) * 10 * Math.sin((i / 28) * Math.PI);
          const bAlpha = 0.55 + Math.abs(Math.sin(time * 15 + i)) * 0.35;
          ctx.fillStyle = `${glowColor}${Math.round(bAlpha * 255).toString(16).padStart(2, "0")}`;
          ctx.fillRect(waveX, h - 24 - Math.abs(amp), 2, Math.abs(amp) * 2);
        }
      }

      // ── Thinking scanlines ──────────────────────────────────────────────
      if (isThinking) {
        const scanX = cX - br + ((time * 65) % (br * 2));
        ctx.fillStyle = `${glowColor}16`;
        ctx.fillRect(scanX - 1, cY - br, 2, br * 2);
        ctx.fillStyle = `${glowColor}08`;
        ctx.fillRect(scanX - 5, cY - br, 10, br * 2);
        const computeR = scale * (0.5 + Math.sin(time * 6) * 0.08);
        ctx.strokeStyle = `${glowColor}22`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(cX, cY, computeR, 0, Math.PI * 2);
        ctx.stroke();
      }

      // ── HUD Text ─────────────────────────────────────────────────────────
      ctx.font = "7.5px 'JetBrains Mono', monospace";
      ctx.fillStyle = `${glowColor}99`;
      ctx.fillText("SYS: NOMINAL", cX - br + 6, cY - br + 12);
      ctx.fillText(`ROT-Y: ${Math.round((rotY % (Math.PI * 2)) * 57.3)}°`, cX - br + 6, cY - br + 23);
      ctx.fillText(`VER: 2.4 | FPS: 60`, cX + br - 70, cY - br + 12);
      ctx.fillText(
        `MODE: ${isListening ? "INPUT_ACTIVE" : isThinking ? "COMPUTING" : isTalking ? "VOCALIZING" : "STANDBY"}`,
        cX - br + 6, cY + br - 6
      );

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
        background: "linear-gradient(160deg, rgba(2,6,23,0.58) 0%, rgba(8,15,38,0.48) 100%)",
        border: "1px solid rgba(0, 245, 255, 0.18)",
        boxShadow: "0 8px 40px 0 rgba(0,0,0,0.5), 0 0 0 1px rgba(0,245,255,0.06) inset",
        backdropFilter: "blur(10px)",
        borderRadius: 14,
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
      {/* Corner accent lines */}
      {[["top","left"],["top","right"],["bottom","left"],["bottom","right"]].map(([v, h]) => (
        <div key={`${v}-${h}`} style={{
          position: "absolute", [v]: 0, [h]: 0, width: 18, height: 18,
          [`border${v.charAt(0).toUpperCase()+v.slice(1)}`]: "1.5px solid rgba(0,245,255,0.55)",
          [`border${h.charAt(0).toUpperCase()+h.slice(1)}`]: "1.5px solid rgba(0,245,255,0.55)",
          [`border${v.charAt(0).toUpperCase()+v.slice(1)}${h.charAt(0).toUpperCase()+h.slice(1)}Radius`]: 14,
          pointerEvents: "none"
        }} />
      ))}

      {/* Glitch Tech Banner */}
      <div
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid rgba(0, 245, 255, 0.12)",
          paddingBottom: 6,
          marginBottom: 6,
          boxSizing: "border-box"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Radio style={{ width: 11, height: 11, color: "#00f5ff", animation: isListening ? "pulse 1.2s infinite" : "none" }} />
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8.5, letterSpacing: "0.14em", color: "#00f5ff", fontWeight: 700, textShadow: "0 0 8px rgba(0,245,255,0.55)" }}>
            NEXUS HOLOGRAM OS v2.4
          </span>
        </div>
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          <span style={{ fontFamily: "monospace", fontSize: 7, color: "rgba(0,245,255,0.5)", letterSpacing: "0.08em" }}>
            {isThinking ? "PROC" : isTalking ? "VOCA" : isListening ? "RECV" : "IDLE"}
          </span>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: isListening ? "#FF2E88" : isThinking ? "#a78bfa" : "#34d399", display: "inline-block", boxShadow: `0 0 6px ${isListening ? "#FF2E88" : isThinking ? "#a78bfa" : "#34d399"}` }} />
        </div>
      </div>

      {/* Hologram Canvas Viewport */}
      <div style={{ width: "100%", height: 175, position: "relative" }}>
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
            border: `1px solid ${voiceEnabled ? "rgba(0, 245, 255, 0.4)" : "rgba(255,255,255,0.08)"}`,
            boxShadow: voiceEnabled ? "0 0 10px rgba(0,245,255,0.15)" : "none",
            borderRadius: 7,
            padding: "5px 13px",
            display: "flex",
            alignItems: "center",
            gap: 6,
            color: voiceEnabled ? "#00f5ff" : "rgba(148,163,184,0.5)",
            cursor: "pointer",
            fontSize: 8.5,
            fontFamily: "monospace",
            letterSpacing: "0.06em",
            transition: "all 0.22s ease"
          }}
        >
          {voiceEnabled ? <Volume2 style={{ width: 11, height: 11 }} /> : <VolumeX style={{ width: 11, height: 11 }} />}
          VOICE: {voiceEnabled ? "ON" : "OFF"}
        </button>

        <div style={{ width: 3, height: 3, borderRadius: "50%", background: "rgba(0,245,255,0.2)" }} />

        {/* Toggle Voice Input (Mic) */}
        <button
          onClick={onToggleListen}
          title={isListening ? "Stop listening" : "Start Voice Input"}
          style={{
            background: isListening ? "rgba(255, 46, 136, 0.14)" : "rgba(255, 255, 255, 0.03)",
            border: `1px solid ${isListening ? "rgba(255, 46, 136, 0.5)" : "rgba(255,255,255,0.08)"}`,
            boxShadow: isListening ? "0 0 10px rgba(255,46,136,0.2)" : "none",
            borderRadius: 7,
            padding: "5px 13px",
            display: "flex",
            alignItems: "center",
            gap: 6,
            color: isListening ? "#FF2E88" : "rgba(148,163,184,0.5)",
            cursor: "pointer",
            fontSize: 8.5,
            fontFamily: "monospace",
            letterSpacing: "0.06em",
            transition: "all 0.22s ease"
          }}
        >
          {isListening ? <Mic style={{ width: 11, height: 11, animation: "pulse 1.2s infinite" }} /> : <MicOff style={{ width: 11, height: 11 }} />}
          MIC: {isListening ? "LISTENING" : "MUTED"}
        </button>
      </div>
    </div>
  );
}
