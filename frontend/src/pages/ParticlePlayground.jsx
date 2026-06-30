import { useEffect, useRef, useState, useCallback } from "react";

/* ─── Constants ─────────────────────────────────────────── */
const MODES = [
  { id: "orbit",   label: "ORBIT",   desc: "Particles orbit your hand / cursor" },
  { id: "repel",   label: "REPEL",   desc: "Hand / cursor pushes particles away" },
  { id: "attract", label: "ATTRACT", desc: "Hand / cursor pulls particles in" },
  { id: "explode", label: "EXPLODE", desc: "Close fist / click to detonate" },
  { id: "gravity", label: "GRAVITY", desc: "Particles fall with gravity" },
  { id: "web",     label: "WEB",     desc: "Connected particle network" },
  { id: "trail",   label: "TRAIL",   desc: "Hand / cursor leaves particle trail" },
  { id: "vortex",  label: "VORTEX",  desc: "Spiral vortex field" },
];

const PALETTES = [
  { id: "cyan",   label: "CYBER",  colors: ["#00F5FF", "#6E56FF", "#00FF88"] },
  { id: "fire",   label: "FIRE",   colors: ["#FF4500", "#FF8C00", "#FFD700"] },
  { id: "plasma", label: "PLASMA", colors: ["#FF2E88", "#BF00FF", "#6E56FF"] },
  { id: "matrix", label: "MATRIX", colors: ["#00FF41", "#00CC33", "#009922"] },
  { id: "ice",    label: "ICE",    colors: ["#A8EDFF", "#7EC8E3", "#0080C0"] },
  { id: "gold",   label: "GOLD",   colors: ["#FFD700", "#FFA500", "#FF6347"] },
];

// MediaPipe hand landmark indices
const WRIST = 0;
const INDEX_TIP = 8;
const MIDDLE_TIP = 12;
const RING_TIP = 16;
const PINKY_TIP = 20;
const THUMB_TIP = 4;
const PALM_CENTER = 9; // middle finger MCP — good palm centre

/* ─── Slider ────────────────────────────────────────────── */
function Slider({ label, value, min, max, step = 1, onChange, unit = "" }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontFamily: "monospace", fontSize: 9.5, letterSpacing: "0.12em", color: "rgba(148,163,184,0.65)", textTransform: "uppercase" }}>{label}</span>
        <span style={{ fontFamily: "monospace", fontSize: 9.5, color: "#00F5FF" }}>{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "#00F5FF", cursor: "pointer" }} />
    </div>
  );
}

/* ─── Main Component ────────────────────────────────────── */
export default function ParticlePlayground() {
  const canvasRef      = useRef(null);
  const videoRef       = useRef(null);
  const camCanvasRef   = useRef(null); // small camera preview canvas
  const stateRef       = useRef({
    mode: "repel",
    speed: 2,
    size: 3,
    linkDist: 110,
    force: 80,
    trail: 18,
    gravity: 0.18,
    palette: "cyan"
  });
  const animIdRef      = useRef(null);
  const pointersRef    = useRef([]);         // unified mouse/hand pointers: [{ x, y, down }]
  const particlesRef   = useRef([]);
  const explosionsRef  = useRef([]);
  const handsRef       = useRef(null);       // MediaPipe Hands instance
  const handLandmarks  = useRef(null);       // latest detected landmarks
  const handActiveRef  = useRef(false);      // whether hand tracking is running
  const fistWasDown    = useRef(false);      // for fist-detect explosion trigger

  const [mode,       setMode]       = useState("repel");
  const [palette,    setPalette]    = useState("cyan");
  const [count,      setCount]      = useState(180);
  const [speed,      setSpeed]      = useState(2);
  const [size,       setSize]       = useState(3);
  const [linkDist,   setLinkDist]   = useState(110);
  const [force,      setForce]      = useState(80);
  const [trail,      setTrail]      = useState(18);
  const [gravity,    setGravity]    = useState(0.18);
  const [showStats,  setShowStats]  = useState(true);
  const [fps,        setFps]        = useState(0);
  const [particleCount, setParticleCount] = useState(0);
  const [handMode,   setHandMode]   = useState(false);   // hand tracking toggle
  const [handStatus, setHandStatus] = useState("idle");  // idle | loading | active | error
  const [handDetected, setHandDetected] = useState(false);

  const [devices,      setDevices]      = useState([]);
  const [selectedDevice, setSelectedDevice] = useState("");

  const getDevices = useCallback(async () => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter((d) => d.kind === "videoinput");
      setDevices(videoDevices);
      setSelectedDevice((curr) => {
        if (videoDevices.length > 0 && !curr) {
          return videoDevices[0].deviceId;
        }
        return curr;
      });
    } catch (err) {
      console.warn("Failed to enumerate video inputs", err);
    }
  }, []);

  useEffect(() => {
    getDevices();
  }, [getDevices]);

  const getPalette = useCallback(() =>
    PALETTES.find(p => p.id === palette)?.colors || PALETTES[0].colors
  , [palette]);

  const spawnParticles = useCallback((canvas, n) => {
    const cols = getPalette();
    return Array.from({ length: n }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      r: Math.random() * size + 1,
      color: cols[Math.floor(Math.random() * cols.length)],
      alpha: Math.random() * 0.5 + 0.5,
      life: 1,
    }));
  }, [getPalette, size]);

  /* ── Load MediaPipe scripts dynamically ── */
  const loadScript = (src) => new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
    const s = document.createElement("script");
    s.src = src; s.crossOrigin = "anonymous";
    s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });

  /* ── Start hand tracking ── */
  const startHandTracking = useCallback(async (deviceIdOverride) => {
    setHandStatus("loading");
    try {
      // Load MediaPipe CDN scripts
      await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js");
      await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js");
      await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js");

      // Wait a tick for globals to register
      await new Promise(r => setTimeout(r, 200));

      const Hands = window.Hands;
      const Camera = window.Camera;
      if (!Hands || !Camera) throw new Error("MediaPipe not loaded");

      const hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
      });

      hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.6,
      });

      hands.onResults((results) => {
        const multiLms = results.multiHandLandmarks || [];
        setHandDetected(multiLms.length > 0);

        // Draw camera preview with skeleton
        const camCanvas = camCanvasRef.current;
        const video = videoRef.current;
        if (!camCanvas || !video) return;
        const cc = camCanvas.getContext("2d");
        cc.save();
        // Mirror flip
        cc.translate(camCanvas.width, 0);
        cc.scale(-1, 1);
        cc.drawImage(video, 0, 0, camCanvas.width, camCanvas.height);
        cc.restore();

        if (multiLms.length > 0 && window.drawConnectors && window.drawLandmarks) {
          multiLms.forEach(lms => {
            // Mirror the landmarks for display
            const mirrored = lms.map(lm => ({ ...lm, x: 1 - lm.x }));
            window.drawConnectors(cc, mirrored, window.HAND_CONNECTIONS,
              { color: "#00F5FF", lineWidth: 1.5 });
            window.drawLandmarks(cc, mirrored,
              { color: "#FF2E88", lineWidth: 1, radius: 3 });
          });
        }

        const newPointers = [];
        const canvas = canvasRef.current;

        multiLms.forEach(lms => {
          const lm = lms[PALM_CENTER];
          let px = -9999, py = -9999;
          if (canvas) {
            px = (1 - lm.x) * canvas.width;
            py = lm.y * canvas.height;
          }

          // Fist detection: all fingertips close to wrist → fist
          const wrist = lms[WRIST];
          const tips = [THUMB_TIP, INDEX_TIP, MIDDLE_TIP, RING_TIP, PINKY_TIP]
            .map(i => lms[i]);
          const avgDist = tips.reduce((acc, tip) => {
            const dx = tip.x - wrist.x;
            const dy = tip.y - wrist.y;
            return acc + Math.sqrt(dx * dx + dy * dy);
          }, 0) / tips.length;

          const isFist = avgDist < 0.15;
          if (isFist && !fistWasDown.current && stateRef.current.mode === "explode") {
            const cols = PALETTES.find(p => p.id === stateRef.current.palette)?.colors || PALETTES[0].colors;
            const blastParts = Array.from({ length: 80 }, () => {
              const angle = Math.random() * Math.PI * 2;
              const spd = Math.random() * 8 + 2;
              return { x: px, y: py, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd - 2,
                r: Math.random() * 4 + 1, color: cols[Math.floor(Math.random() * cols.length)], life: 1 };
            });
            explosionsRef.current.push({ particles: blastParts });
          }
          newPointers.push({ x: px, y: py, down: isFist });
        });

        pointersRef.current = newPointers;
        
        const anyFist = newPointers.some(pt => pt.down);
        fistWasDown.current = anyFist;
      });

      handsRef.current = hands;

      const activeDevId = deviceIdOverride || selectedDevice;
      let stream = null;
      let usedDeviceId = activeDevId;

      try {
        const constraints = usedDeviceId
          ? { video: { deviceId: { exact: usedDeviceId }, width: 320, height: 240 } }
          : { video: { facingMode: "user", width: 320, height: 240 } };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (firstErr) {
        console.warn("Primary camera stream failed:", firstErr);
        // Fallback: try all other enumerated devices
        if (devices.length > 1) {
          const alternativeDevices = devices.filter(d => d.deviceId !== usedDeviceId);
          for (const dev of alternativeDevices) {
            try {
              console.log(`Attempting fallback camera: ${dev.label || dev.deviceId}`);
              stream = await navigator.mediaDevices.getUserMedia({
                video: { deviceId: { exact: dev.deviceId }, width: 320, height: 240 }
              });
              usedDeviceId = dev.deviceId;
              setSelectedDevice(dev.deviceId); // sync back to state
              break;
            } catch (fallbackErr) {
              console.warn(`Fallback camera ${dev.label || dev.deviceId} failed:`, fallbackErr);
            }
          }
        }
        if (!stream) throw firstErr;
      }

      videoRef.current.srcObject = stream;
      videoRef.current.play();

      const camera = new Camera(videoRef.current, {
        onFrame: async () => { await hands.send({ image: videoRef.current }); },
        width: 320, height: 240,
      });
      camera.start();
      handActiveRef.current = true;
      setHandMode(true);
      setHandStatus("active");

      // Refresh devices to get labels
      getDevices();
    } catch (err) {
      console.error("[Hand Tracking]", err);
      setHandStatus("error");
      setHandMode(false);
    }
  }, [selectedDevice, devices, getDevices]);

  /* ── Stop hand tracking ── */
  const stopHandTracking = useCallback(() => {
    handActiveRef.current = false;
    handLandmarks.current = null;
    setHandDetected(false);
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    if (handsRef.current) {
      handsRef.current.close?.();
      handsRef.current = null;
    }
    pointersRef.current = [];
    setHandMode(false);
    setHandStatus("idle");
  }, []);

  const handleDeviceChange = useCallback(async (deviceId) => {
    setSelectedDevice(deviceId);
    if (handActiveRef.current) {
      stopHandTracking();
      setTimeout(() => {
        startHandTracking(deviceId);
      }, 300);
    }
  }, [startHandTracking, stopHandTracking]);

  /* ── Main animation loop ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    particlesRef.current = spawnParticles(canvas, count);

    let lastTime = performance.now();
    let frameCount = 0, fpsTime = performance.now();

    const loop = (now) => {
      animIdRef.current = requestAnimationFrame(loop);
      const dt = Math.min((now - lastTime) / 16, 3);
      lastTime = now;

      frameCount++;
      if (now - fpsTime > 500) {
        setFps(Math.round(frameCount / ((now - fpsTime) / 1000)));
        frameCount = 0; fpsTime = now;
        setParticleCount(particlesRef.current.length);
      }

      const {
        mode = "repel",
        speed = 2,
        linkDist = 110,
        force = 80,
        trail = 18,
        gravity = 0.18,
        palette: pal = "cyan"
      } = stateRef.current || {};
      const cols = PALETTES.find(p => p.id === pal)?.colors || PALETTES[0].colors;

      ctx.fillStyle = `rgba(2,6,23,${trail / 100})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const activePointers = pointersRef.current;

      // Trail: emit particles at hand/cursor
      if (mode === "trail") {
        activePointers.forEach(pt => {
          if (pt.x > 0 && pt.y > 0) {
            for (let i = 0; i < 4; i++) {
              particlesRef.current.push({
                x: pt.x + (Math.random() - 0.5) * 14,
                y: pt.y + (Math.random() - 0.5) * 14,
                vx: (Math.random() - 0.5) * 3,
                vy: (Math.random() - 0.5) * 3 - 1,
                r: Math.random() * stateRef.current.size + 1,
                color: cols[Math.floor(Math.random() * cols.length)],
                alpha: 1, life: 1, decay: 0.018,
              });
            }
          }
        });
        particlesRef.current = pointersRef.current.length > 0
          ? particlesRef.current.filter(p => (p.life ?? 1) > 0.05)
          : particlesRef.current;
        if (particlesRef.current.length > 800) particlesRef.current.splice(0, 100);
      }

      // Explosions
      const liveExp = [];
      for (const exp of explosionsRef.current) {
        const alive = [];
        for (const ep of exp.particles) {
          ep.x += ep.vx * dt; ep.y += ep.vy * dt;
          ep.vy += 0.08 * dt; ep.life -= 0.018 * dt;
          ep.vx *= 0.98; ep.vy *= 0.98;
          if (ep.life > 0) {
            ctx.beginPath();
            ctx.arc(ep.x, ep.y, ep.r * ep.life, 0, Math.PI * 2);
            ctx.fillStyle = ep.color;
            ctx.globalAlpha = ep.life;
            ctx.fill();
            ctx.globalAlpha = 1;
            alive.push(ep);
          }
        }
        if (alive.length) { exp.particles = alive; liveExp.push(exp); }
      }
      explosionsRef.current = liveExp;

      // Particles
      const sz = stateRef.current.size || 3;
      for (const p of particlesRef.current) {
        activePointers.forEach(pt => {
          if (pt.x <= 0 || pt.y <= 0) return;
          const dx = pt.x - p.x, dy = pt.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;

          if (mode === "repel" && dist < force) {
            const f = (force - dist) / force;
            p.vx -= (dx / dist) * f * 0.8 * dt;
            p.vy -= (dy / dist) * f * 0.8 * dt;
          } else if (mode === "attract" && dist < force * 2) {
            const f = (force - Math.min(dist, force)) / force;
            p.vx += (dx / dist) * f * 0.5 * dt;
            p.vy += (dy / dist) * f * 0.5 * dt;
          } else if (mode === "orbit") {
            if (dist < force * 2 && dist > 5) {
              const tx = -dy / dist, ty = dx / dist;
              const f = (1 - dist / (force * 2)) * 1.2;
              p.vx += tx * f * dt; p.vy += ty * f * dt;
              p.vx += (dx / dist) * 0.05 * dt;
              p.vy += (dy / dist) * 0.05 * dt;
            }
          } else if (mode === "vortex") {
            if (dist < canvas.width * 0.5) {
              const angle = Math.atan2(dy, dx);
              const f = (0.5 - dist / canvas.width) * 2;
              p.vx += Math.cos(angle + Math.PI / 2) * f * dt;
              p.vy += Math.sin(angle + Math.PI / 2) * f * dt;
              p.vx += (dx / dist) * 0.03 * dt;
              p.vy += (dy / dist) * 0.03 * dt;
            }
          }
        });

        if (mode === "gravity") {
          p.vy += gravity * dt;
          if (p.y > canvas.height - p.r) { p.y = canvas.height - p.r; p.vy *= -0.5; }
        }

        p.vx *= 0.97; p.vy *= 0.97;
        const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (spd > speed * 4) { p.vx = (p.vx / spd) * speed * 4; p.vy = (p.vy / spd) * speed * 4; }

        p.x += p.vx * dt * speed;
        p.y += p.vy * dt * speed;

        if (p.x < p.r) { p.x = p.r; p.vx = Math.abs(p.vx); }
        if (p.x > canvas.width - p.r) { p.x = canvas.width - p.r; p.vx = -Math.abs(p.vx); }
        if (mode !== "gravity") {
          if (p.y < p.r) { p.y = p.r; p.vy = Math.abs(p.vy); }
          if (p.y > canvas.height - p.r) { p.y = canvas.height - p.r; p.vy = -Math.abs(p.vy); }
        } else {
          if (p.y < p.r) { p.y = p.r; p.vy = Math.abs(p.vy); }
        }

        if (p.decay) {
          p.life = (p.life ?? 1) - p.decay * dt;
          if (p.life <= 0) continue;
        }

        const al = (p.life ?? 1) * (p.alpha ?? 0.8);
        const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, sz * 3);
        grd.addColorStop(0, p.color);
        grd.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(p.x, p.y, sz * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = grd; ctx.globalAlpha = al * 0.25; ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.5, sz * (p.life ?? 1)), 0, Math.PI * 2);
        ctx.fillStyle = p.color; ctx.globalAlpha = al; ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Web connections
      if (mode === "web") {
        const pts = particlesRef.current;
        for (let i = 0; i < pts.length; i++) {
          for (let j = i + 1; j < pts.length; j++) {
            const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < linkDist) {
              ctx.beginPath();
              ctx.moveTo(pts[i].x, pts[i].y);
              ctx.lineTo(pts[j].x, pts[j].y);
              ctx.strokeStyle = cols[0];
              ctx.globalAlpha = (1 - d / linkDist) * 0.45;
              ctx.lineWidth = 0.8; ctx.stroke();
              ctx.globalAlpha = 1;
            }
          }
        }
      }

      // Pointer indicators drawing
      activePointers.forEach(pt => {
        if (pt.x > 0 && pt.y > 0 && mode !== "trail") {
          const ringR = (mode === "repel" || mode === "attract") ? force : 60;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, ringR, 0, Math.PI * 2);
          ctx.strokeStyle = cols[0]; ctx.globalAlpha = 0.12; ctx.lineWidth = 1; ctx.stroke();
          ctx.globalAlpha = 1;

          // Hand mode: draw crosshair
          if (handActiveRef.current) {
            const cSize = 10;
            ctx.strokeStyle = cols[0]; ctx.globalAlpha = 0.8; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(pt.x - cSize, pt.y); ctx.lineTo(pt.x + cSize, pt.y); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(pt.x, pt.y - cSize); ctx.lineTo(pt.x, pt.y + cSize); ctx.stroke();
            ctx.globalAlpha = 1;
            // Outer glow ring
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 8, 0, Math.PI * 2);
            ctx.strokeStyle = cols[0]; ctx.globalAlpha = 0.6; ctx.lineWidth = 2; ctx.stroke();
            ctx.globalAlpha = 1;
          } else {
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = cols[0]; ctx.globalAlpha = 0.7; ctx.fill();
            ctx.globalAlpha = 1;
          }
        }
      });
    };

    animIdRef.current = requestAnimationFrame(loop);
    return () => { if (animIdRef.current) cancelAnimationFrame(animIdRef.current); ro.disconnect(); };
  }, []); // eslint-disable-line

  useEffect(() => {
    stateRef.current = { mode, speed, size, linkDist, force, trail, gravity, palette };
  }, [mode, speed, size, linkDist, force, trail, gravity, palette]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (mode === "trail") return;
    particlesRef.current = spawnParticles(canvas, count);
  }, [count, palette, spawnParticles, mode]);

  // Cleanup on unmount
  useEffect(() => () => { stopHandTracking(); }, [stopHandTracking]);

  /* ── Mouse handlers (only when hand mode off) ── */
  const onMouseMove = useCallback(e => {
    if (handActiveRef.current) return;
    const r = canvasRef.current?.getBoundingClientRect();
    if (!r) return;
    pointersRef.current = [{
      x: e.clientX - r.left,
      y: e.clientY - r.top,
      down: false
    }];
  }, []);

  const onMouseDown = useCallback(e => {
    if (handActiveRef.current) return;
    if (stateRef.current.mode === "explode") {
      const r = canvasRef.current?.getBoundingClientRect();
      if (!r) return;
      const cx = e.clientX - r.left, cy = e.clientY - r.top;
      const cols = PALETTES.find(p => p.id === stateRef.current.palette)?.colors || PALETTES[0].colors;
      const blastParts = Array.from({ length: 80 }, () => {
        const angle = Math.random() * Math.PI * 2, spd = Math.random() * 8 + 2;
        return { x: cx, y: cy, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd - 2,
          r: Math.random() * 4 + 1, color: cols[Math.floor(Math.random() * cols.length)], life: 1 };
      });
      explosionsRef.current.push({ particles: blastParts });
    }
  }, []);

  const onMouseLeave = useCallback(() => {
    if (handActiveRef.current) return;
    pointersRef.current = [];
  }, []);

  const resetParticles = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    explosionsRef.current = [];
    particlesRef.current = spawnParticles(canvas, count);
  }, [count, spawnParticles]);

  const currentPalette = getPalette();
  const primary = currentPalette[0];

  const handStatusColor = handStatus === "active" ? "#00FF88" : handStatus === "loading" ? "#FFD700" : handStatus === "error" ? "#FF2E88" : "rgba(148,163,184,0.4)";
  const handStatusLabel = { idle: "OFF", loading: "LOADING…", active: handDetected ? "✋ HAND DETECTED" : "SCANNING…", error: "ERROR" }[handStatus];

  return (
    <div style={{ display: "flex", height: "calc(100vh - 100px)", gap: 16, minHeight: 0 }}>
      {/* Hidden video for MediaPipe */}
      <video ref={videoRef} style={{ display: "none" }} playsInline muted />

      {/* ── Canvas ── */}
      <div style={{ flex: 1, position: "relative", borderRadius: 14, overflow: "hidden", border: `1px solid ${primary}22`, background: "#020617" }}>
        <canvas ref={canvasRef}
          style={{ width: "100%", height: "100%", display: "block", cursor: handMode ? "none" : mode === "explode" ? "crosshair" : "none" }}
          onMouseMove={onMouseMove} onMouseDown={onMouseDown} onMouseLeave={onMouseLeave}
        />

        {/* Mode badge */}
        <div style={{ position: "absolute", top: 14, left: 14, display: "flex", alignItems: "center", gap: 8,
          background: "rgba(2,6,23,0.8)", backdropFilter: "blur(10px)",
          border: `1px solid ${primary}33`, borderRadius: 10, padding: "8px 14px" }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: primary, boxShadow: `0 0 8px ${primary}` }} />
          <span style={{ fontFamily: "monospace", fontSize: 9.5, letterSpacing: "0.2em", color: primary }}>
            {MODES.find(m => m.id === mode)?.label} MODE
          </span>
          {handMode && (
            <span style={{ fontFamily: "monospace", fontSize: 9, color: "#00FF88", marginLeft: 6,
              background: "rgba(0,255,136,0.1)", border: "1px solid rgba(0,255,136,0.3)",
              borderRadius: 6, padding: "1px 7px", letterSpacing: "0.15em" }}>
              ✋ HAND ACTIVE
            </span>
          )}
        </div>

        {/* Camera preview (shown when hand mode active) */}
        {handStatus === "active" && (
          <div style={{ position: "absolute", top: 14, right: 14,
            borderRadius: 10, overflow: "hidden",
            border: `2px solid ${handDetected ? "#00FF88" : "#00F5FF"}44`,
            boxShadow: `0 0 20px ${handDetected ? "rgba(0,255,136,0.3)" : "rgba(0,245,255,0.2)"}` }}>
            <canvas ref={camCanvasRef} width={180} height={135}
              style={{ display: "block" }}
            />
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0,
              background: "rgba(2,6,23,0.7)", padding: "4px 8px", textAlign: "center",
              fontFamily: "monospace", fontSize: 8.5, letterSpacing: "0.15em",
              color: handDetected ? "#00FF88" : "#00F5FF" }}>
              {handDetected ? "✋ TRACKING" : "SCANNING…"}
            </div>
          </div>
        )}

        {/* Stats */}
        {showStats && (
          <div style={{ position: "absolute", bottom: 14, left: 14,
            background: "rgba(2,6,23,0.7)", backdropFilter: "blur(8px)",
            border: "1px solid rgba(0,245,255,0.1)", borderRadius: 8,
            padding: "8px 12px", fontFamily: "monospace", fontSize: 9,
            color: "rgba(148,163,184,0.55)", display: "flex", gap: 16 }}>
            <span>PARTICLES <span style={{ color: primary }}>{particleCount}</span></span>
            <span>FPS <span style={{ color: "#00FF88" }}>{fps}</span></span>
            <span>INPUT <span style={{ color: primary }}>{handMode ? "HAND" : "MOUSE"}</span></span>
          </div>
        )}

        {/* Explode hint */}
        {mode === "explode" && (
          <div style={{ position: "absolute", bottom: 14, right: 14,
            background: "rgba(255,46,136,0.1)", border: "1px solid rgba(255,46,136,0.3)",
            borderRadius: 8, padding: "8px 14px", fontFamily: "monospace",
            fontSize: 9.5, color: "#FF2E88", letterSpacing: "0.1em" }}>
            {handMode ? "✊ MAKE FIST TO DETONATE" : "✦ CLICK TO DETONATE"}
          </div>
        )}
      </div>

      {/* ── Controls ── */}
      <div style={{ width: 240, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12,
        overflowY: "auto", paddingRight: 2, scrollbarWidth: "thin", scrollbarColor: `${primary}33 transparent` }}>

        {/* ★ Hand Tracking panel */}
        <div style={{ background: handMode ? "rgba(0,255,136,0.04)" : "rgba(2,6,23,0.7)",
          border: handMode ? "1px solid rgba(0,255,136,0.25)" : "1px solid rgba(0,245,255,0.08)",
          borderRadius: 12, padding: "14px 14px", transition: "all 0.3s" }}>
          <div style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: "0.2em",
            color: "rgba(148,163,184,0.5)", marginBottom: 10, textTransform: "uppercase" }}>
            ◈ Hand Tracking
          </div>

          <button
            onClick={handMode ? stopHandTracking : startHandTracking}
            disabled={handStatus === "loading"}
            style={{ width: "100%", padding: "11px", borderRadius: 8, cursor: handStatus === "loading" ? "wait" : "pointer",
              fontFamily: "monospace", fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase",
              background: handMode ? "rgba(0,255,136,0.12)" : "rgba(0,245,255,0.08)",
              border: handMode ? "1px solid rgba(0,255,136,0.35)" : "1px solid rgba(0,245,255,0.25)",
              color: handMode ? "#00FF88" : "#00F5FF",
              boxShadow: handMode ? "0 0 16px rgba(0,255,136,0.2)" : "none",
              transition: "all 0.2s", marginBottom: 10 }}>
            {handMode ? "⬛ STOP TRACKING" : "✋ START HAND TRACKING"}
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 10px",
            background: "rgba(2,6,23,0.5)", borderRadius: 7,
            border: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: handStatusColor,
              boxShadow: handStatus === "active" ? `0 0 8px ${handStatusColor}` : "none",
              animation: handStatus === "loading" ? "ws-blink 0.8s ease infinite" : "none" }} />
            <span style={{ fontFamily: "monospace", fontSize: 9, color: handStatusColor, letterSpacing: "0.12em" }}>
              {handStatusLabel}
            </span>
          </div>

          {devices.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
              <span style={{ fontFamily: "monospace", fontSize: 8, color: "rgba(148,163,184,0.5)" }}>CAMERA SOURCE</span>
              <select
                value={selectedDevice}
                onChange={(e) => handleDeviceChange(e.target.value)}
                style={{
                  width: "100%",
                  background: "rgba(15,23,42,0.85)",
                  border: "1px solid rgba(0,245,255,0.22)",
                  borderRadius: 6,
                  color: "#e2e8f0",
                  padding: "5px 8px",
                  fontSize: 9.5,
                  fontFamily: "monospace",
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                {devices.map((d, idx) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Camera Channel ${idx}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {handStatus === "active" && (
            <div style={{ marginTop: 9, fontFamily: "monospace", fontSize: 8.5, color: "rgba(148,163,184,0.4)", lineHeight: 1.6 }}>
              Move your <span style={{ color: "#00FF88" }}>hand</span> in front of the camera.<br />
              EXPLODE mode: make a <span style={{ color: "#FF2E88" }}>fist ✊</span> to blast.
            </div>
          )}
          {handStatus === "error" && (
            <div style={{ marginTop: 9, fontFamily: "monospace", fontSize: 8.5, color: "#FF2E88", lineHeight: 1.6 }}>
              ⚠ Camera permission denied or MediaPipe failed to load. Check browser permissions.
            </div>
          )}
        </div>

        {/* Mode selector */}
        <div style={{ background: "rgba(2,6,23,0.7)", border: "1px solid rgba(0,245,255,0.08)", borderRadius: 12, padding: "14px 14px" }}>
          <div style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: "0.2em", color: "rgba(148,163,184,0.5)", marginBottom: 10, textTransform: "uppercase" }}>
            ◈ Interaction Mode
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {MODES.map(m => (
              <button key={m.id} onClick={() => setMode(m.id)}
                style={{ padding: "7px 6px", borderRadius: 7, cursor: "pointer",
                  fontFamily: "monospace", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase",
                  transition: "all 0.15s",
                  background: mode === m.id ? `${primary}18` : "rgba(255,255,255,0.03)",
                  border: mode === m.id ? `1px solid ${primary}55` : "1px solid rgba(255,255,255,0.06)",
                  color: mode === m.id ? primary : "rgba(148,163,184,0.6)",
                  boxShadow: mode === m.id ? `0 0 10px ${primary}22` : "none" }}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Palette */}
        <div style={{ background: "rgba(2,6,23,0.7)", border: "1px solid rgba(0,245,255,0.08)", borderRadius: 12, padding: "14px 14px" }}>
          <div style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: "0.2em", color: "rgba(148,163,184,0.5)", marginBottom: 10, textTransform: "uppercase" }}>
            ◈ Color Palette
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {PALETTES.map(p => (
              <button key={p.id} onClick={() => setPalette(p.id)}
                style={{ padding: "7px 8px", borderRadius: 7, cursor: "pointer",
                  fontFamily: "monospace", fontSize: 9, letterSpacing: "0.1em",
                  display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s",
                  background: palette === p.id ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.02)",
                  border: palette === p.id ? `1px solid ${p.colors[0]}55` : "1px solid rgba(255,255,255,0.06)",
                  color: palette === p.id ? "#fff" : "rgba(148,163,184,0.55)" }}>
                <div style={{ display: "flex", gap: 2 }}>
                  {p.colors.map((c, i) => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: c }} />)}
                </div>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sliders */}
        <div style={{ background: "rgba(2,6,23,0.7)", border: "1px solid rgba(0,245,255,0.08)", borderRadius: 12, padding: "14px 14px" }}>
          <div style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: "0.2em", color: "rgba(148,163,184,0.5)", marginBottom: 12, textTransform: "uppercase" }}>
            ◈ Parameters
          </div>
          <Slider label="Particle Count" value={count}   min={20}  max={500} step={10}  onChange={setCount} />
          <Slider label="Speed"          value={speed}   min={0.2} max={8}   step={0.1} onChange={setSpeed}  unit="x" />
          <Slider label="Size"           value={size}    min={1}   max={10}  step={0.5} onChange={setSize}   unit="px" />
          <Slider label="Force Radius"   value={force}   min={20}  max={250} step={5}   onChange={setForce}  unit="px" />
          {mode === "web"     && <Slider label="Link Distance" value={linkDist} min={30} max={250} step={5}    onChange={setLinkDist} unit="px" />}
          {mode === "gravity" && <Slider label="Gravity"       value={gravity}  min={0.01} max={1} step={0.01} onChange={setGravity}  unit="g" />}
          <Slider label="Trail Fade"     value={trail}   min={5}   max={100} step={1}   onChange={setTrail}  unit="%" />
        </div>

        {/* Actions */}
        <div style={{ background: "rgba(2,6,23,0.7)", border: "1px solid rgba(0,245,255,0.08)", borderRadius: 12, padding: "14px 14px" }}>
          <div style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: "0.2em", color: "rgba(148,163,184,0.5)", marginBottom: 10, textTransform: "uppercase" }}>
            ◈ Actions
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <button onClick={resetParticles}
              style={{ padding: "9px", borderRadius: 8, cursor: "pointer",
                fontFamily: "monospace", fontSize: 9.5, letterSpacing: "0.12em", textTransform: "uppercase",
                background: "rgba(110,86,255,0.12)", border: "1px solid rgba(110,86,255,0.3)",
                color: "#a78bfa", transition: "all 0.15s" }}>
              ↺ RESET PARTICLES
            </button>
            <button onClick={() => setShowStats(s => !s)}
              style={{ padding: "9px", borderRadius: 8, cursor: "pointer",
                fontFamily: "monospace", fontSize: 9.5, letterSpacing: "0.12em", textTransform: "uppercase",
                background: showStats ? "rgba(0,245,255,0.08)" : "rgba(255,255,255,0.03)",
                border: showStats ? "1px solid rgba(0,245,255,0.25)" : "1px solid rgba(255,255,255,0.07)",
                color: showStats ? "#00F5FF" : "rgba(148,163,184,0.5)", transition: "all 0.15s" }}>
              {showStats ? "◉ STATS ON" : "○ STATS OFF"}
            </button>
          </div>
        </div>

        {/* Tips */}
        <div style={{ background: "rgba(2,6,23,0.5)", border: "1px solid rgba(255,255,255,0.04)",
          borderRadius: 10, padding: "12px 13px",
          fontFamily: "monospace", fontSize: 8.5, color: "rgba(148,163,184,0.35)", lineHeight: 1.7 }}>
          <div style={{ color: "rgba(148,163,184,0.6)", marginBottom: 5, fontSize: 9, letterSpacing: "0.15em" }}>◈ TIPS</div>
          <span style={{ color: primary }}>HAND MODE</span>: hold hand in frame.<br />
          <span style={{ color: primary }}>EXPLODE</span>: make a fist ✊ or click.<br />
          <span style={{ color: primary }}>TRAIL</span>: wave hand for streaks.<br />
          <span style={{ color: primary }}>ORBIT</span>: circle hand slowly.
        </div>
      </div>

      <style>{`
        input[type=range] { -webkit-appearance:none; height:3px; background:rgba(0,245,255,0.12); border-radius:4px; outline:none; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; width:13px; height:13px; border-radius:50%; background:#00F5FF; cursor:pointer; box-shadow:0 0 8px rgba(0,245,255,0.7); }
        @keyframes ws-blink { 0%,100%{opacity:1} 50%{opacity:0.2} }
      `}</style>
    </div>
  );
}
