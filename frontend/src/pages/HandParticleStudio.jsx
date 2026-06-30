import { useEffect, useRef, useState, useCallback } from "react";

/* ──────────────────────────────────────────────────────────
   Constants & helpers
────────────────────────────────────────────────────────── */
const PALETTES = [
  { id: "cyber",  label: "CYBER",  colors: ["#00F5FF", "#6E56FF", "#00FF88"] },
  { id: "fire",   label: "FIRE",   colors: ["#FF4500", "#FF8C00", "#FFD700"] },
  { id: "plasma", label: "PLASMA", colors: ["#FF2E88", "#BF00FF", "#6E56FF"] },
  { id: "matrix", label: "MATRIX", colors: ["#00FF41", "#00CC33", "#009922"] },
  { id: "ice",    label: "ICE",    colors: ["#A8EDFF", "#7EC8E3", "#0080C0"] },
  { id: "gold",   label: "GOLD",   colors: ["#FFD700", "#FFA500", "#FF6347"] },
];

const EFFECTS = [
  { id: "attract", label: "ATTRACT",   desc: "Particles swarm the hand" },
  { id: "repel",   label: "REPEL",     desc: "Hand blows particles away" },
  { id: "orbit",   label: "ORBIT",     desc: "Particles orbit the hand" },
  { id: "trail",   label: "TRAIL",     desc: "Hand paints glowing trails" },
  { id: "vortex",  label: "VORTEX",   desc: "Spiral field around hand" },
  { id: "firework",label: "FIREWORK",  desc: "Fist ✊ launches burst" },
  { id: "galaxy",  label: "GALAXY",   desc: "Dense galaxy around palm" },
  { id: "paint",   label: "PAINT",    desc: "Brush sprays particles" },
];

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/* Binary-search interpolated frame in recording with multiple pointers */
function getRecordedFrame(frames, t) {
  if (!frames.length) return null;
  if (t <= frames[0].t) return frames[0];
  if (t >= frames[frames.length - 1].t) return frames[frames.length - 1];
  let lo = 0, hi = frames.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    frames[mid].t <= t ? (lo = mid) : (hi = mid);
  }
  const a = frames[lo], b = frames[hi];
  const r = (t - a.t) / (b.t - a.t);
  
  // Interpolate list of pointers between frame a and frame b
  const pointersA = a.pointers || [];
  const pointersB = b.pointers || [];
  const maxLength = Math.max(pointersA.length, pointersB.length);
  const pointers = [];
  for (let i = 0; i < maxLength; i++) {
    const pA = pointersA[i] || pointersB[i];
    const pB = pointersB[i] || pointersA[i];
    if (pA && pB) {
      pointers.push({
        x: lerp(pA.x, pB.x, r),
        y: lerp(pA.y, pB.y, r),
        isFist: pA.isFist
      });
    }
  }
  return { pointers };
}

/* Load a CDN script once */
function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
    const s = document.createElement("script");
    s.src = src; s.crossOrigin = "anonymous";
    s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

/* ══════════════════════════════════════════════════════════
   Main Component
══════════════════════════════════════════════════════════ */
export default function HandParticleStudio() {
  /* ─ Refs ─ */
  const canvasRef      = useRef(null);
  const camCanvasRef   = useRef(null);
  const videoRef       = useRef(null);
  const animIdRef      = useRef(null);
  const particlesRef   = useRef([]);
  const explosionsRef  = useRef([]);
  const stateRef       = useRef({
    effect: "attract",
    speed: 2.2,
    size: 3,
    force: 100,
    trailFade: 14,
    palette: "cyber",
    bgColor: "#020617",
    looping: true
  });          // live config for RAF
  const pointersRef    = useRef([]);          // Array of pointers: [{x, y, isFist}]
  const handActiveRef  = useRef(false);
  const fistWasRef     = useRef(false);

  /* Recording */
  const recordingRef   = useRef(false);
  const recordStartRef = useRef(0);
  const framesRef      = useRef([]);          // [{t, x, y, isFist}]

  /* Playback */
  const playingRef     = useRef(false);
  const playStartRef   = useRef(0);
  const playOffsetRef  = useRef(0);           // paused-at time

  /* ─ State ─ */
  const [palette,      setPalette]      = useState("cyber");
  const [effect,       setEffect]       = useState("attract");
  const [count,        setCount]        = useState(220);
  const [speed,        setSpeed]        = useState(2.2);
  const [size,         setSize]         = useState(3);
  const [force,        setForce]        = useState(100);
  const [trailFade,    setTrailFade]    = useState(14);

  const [handStatus,   setHandStatus]   = useState("idle");   // idle|loading|active|error
  const [handDetected, setHandDetected] = useState(false);

  const [recState,     setRecState]     = useState("idle");   // idle|recording|recorded
  const [playing,      setPlaying]      = useState(false);
  const [recDuration,  setRecDuration]  = useState(0);
  const [playTime,     setPlayTime]     = useState(0);
  const [looping,      setLooping]      = useState(true);
  const [showCam,      setShowCam]      = useState(true);
  const [fps,          setFps]          = useState(0);
  const [particleCount,setParticleCount]= useState(0);
  const [bgColor,      setBgColor]      = useState("#020617");

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

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("nexus-hand-status", {
      detail: { status: handStatus, detected: handDetected }
    }));
  }, [handStatus, handDetected]);

  const getPalette = useCallback(() =>
    PALETTES.find(p => p.id === palette)?.colors || PALETTES[0].colors
  , [palette]);

  /* ── Spawn initial particles ── */
  const spawnParticles = useCallback((canvas) => {
    const cols = getPalette();
    return Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 1.5,
      vy: (Math.random() - 0.5) * 1.5,
      r: Math.random() * size + 1,
      color: cols[Math.floor(Math.random() * cols.length)],
      alpha: Math.random() * 0.5 + 0.5,
      life: 1,
    }));
  }, [getPalette, count, size]);

  /* ── Main RAF draw loop ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    particlesRef.current = spawnParticles(canvas);

    let lastT = performance.now(), frameCount = 0, fpsTimer = performance.now();

    const loop = (now) => {
      animIdRef.current = requestAnimationFrame(loop);
      const dt = Math.min((now - lastT) / 16, 3);
      lastT = now;

      // FPS meter
      frameCount++;
      if (now - fpsTimer > 600) {
        setFps(Math.round(frameCount / ((now - fpsTimer) / 1000)));
        frameCount = 0; fpsTimer = now;
        setParticleCount(particlesRef.current.length);
      }

      const {
        effect = "attract",
        speed = 2.2,
        force = 100,
        trailFade = 14,
        size: sz = 3,
        palette: pal = "cyber",
        bgColor: bg = "#020617",
        looping = true
      } = stateRef.current || {};
      const cols = PALETTES.find(p => p.id === pal)?.colors || PALETTES[0].colors;

      /* Decide pointer positions: playback overrides mouse/hand.
         pointersRef is always current - set by onMouseMove OR hand tracking callback */
      let activePointers = [];

      if (playingRef.current && framesRef.current.length) {
        const elapsed = (now - playStartRef.current) / 1000 + playOffsetRef.current;
        const dur = framesRef.current[framesRef.current.length - 1].t;
        let t = elapsed;
        if (t > dur) {
          if (stateRef.current.looping) {
            t = t % dur;
            playStartRef.current = now - (t * 1000);
            playOffsetRef.current = 0;
          } else {
            playingRef.current = false;
            setPlaying(false);
            t = dur;
          }
        }
        setPlayTime(t);
        const frame = getRecordedFrame(framesRef.current, t);
        if (frame && frame.pointers) {
          activePointers = frame.pointers.map(p => ({
            x: p.x * canvas.width,
            y: p.y * canvas.height,
            isFist: p.isFist
          }));
        }
      } else {
        activePointers = pointersRef.current;
      }

      /* Record frame (record all pointers for multi-hand) */
      if (recordingRef.current && activePointers.length > 0) {
        const framePointers = activePointers
          .filter(pt => pt.x > 0)
          .map(pt => ({
            x: pt.x / canvas.width,
            y: pt.y / canvas.height,
            isFist: pt.isFist
          }));
        if (framePointers.length > 0) {
          const t = (now - recordStartRef.current) / 1000;
          framesRef.current.push({ t, pointers: framePointers });
        }
      }

      /* Clear with fade */
      ctx.fillStyle = `${bg}${Math.round((trailFade / 100) * 255).toString(16).padStart(2, "0")}`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      /* Trail / Paint: emit from hand */
      if (effect === "trail" || effect === "paint") {
        activePointers.forEach(pt => {
          if (pt.x > 0 && pt.y > 0) {
            const count2 = effect === "paint" ? 6 : 3;
            for (let i = 0; i < count2; i++) {
              particlesRef.current.push({
                x: pt.x + (Math.random() - 0.5) * (effect === "paint" ? 22 : 10),
                y: pt.y + (Math.random() - 0.5) * (effect === "paint" ? 22 : 10),
                vx: (Math.random() - 0.5) * 3,
                vy: (Math.random() - 0.5) * 3 - 0.5,
                r: Math.random() * sz + 1,
                color: cols[Math.floor(Math.random() * cols.length)],
                alpha: 1, life: 1, decay: effect === "paint" ? 0.012 : 0.02,
              });
            }
          }
        });
        particlesRef.current = pointersRef.current.length > 0
          ? particlesRef.current.filter(p => (p.life ?? 1) > 0.04)
          : particlesRef.current;
        if (particlesRef.current.length > 900) particlesRef.current.splice(0, 80);
      }

      /* Galaxy: dense particle cloud at hand */
      if (effect === "galaxy") {
        activePointers.forEach(pt => {
          if (pt.x > 0 && pt.y > 0) {
            for (let i = 0; i < 2; i++) {
              const angle = Math.random() * Math.PI * 2;
              const r2 = Math.random() * 60 + 10;
              particlesRef.current.push({
                x: pt.x + Math.cos(angle) * r2, y: pt.y + Math.sin(angle) * r2,
                vx: Math.cos(angle + Math.PI / 2) * (Math.random() * 2 + 1),
                vy: Math.sin(angle + Math.PI / 2) * (Math.random() * 2 + 1),
                r: Math.random() * sz * 0.8 + 0.5,
                color: cols[Math.floor(Math.random() * cols.length)],
                alpha: 0.9, life: 1, decay: 0.015,
              });
            }
          }
        });
        particlesRef.current = pointersRef.current.length > 0
          ? particlesRef.current.filter(p => (p.life ?? 1) > 0.04)
          : particlesRef.current;
        if (particlesRef.current.length > 900) particlesRef.current.splice(0, 80);
      }

      /* Firework on fist */
      if (effect === "firework") {
        const anyFist = activePointers.some(pt => pt.isFist);
        if (anyFist && !fistWasRef.current) {
          activePointers.forEach(pt => {
            if (pt.isFist && pt.x > 0) {
              const blastCount = 60;
              for (let i = 0; i < blastCount; i++) {
                const angle = (i / blastCount) * Math.PI * 2;
                const spd = Math.random() * 10 + 4;
                particlesRef.current.push({
                  x: pt.x, y: pt.y,
                  vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd - 2,
                  r: Math.random() * sz * 1.5 + 1,
                  color: cols[Math.floor(Math.random() * cols.length)],
                  alpha: 1, life: 1, decay: 0.016,
                });
              }
            }
          });
        }
        fistWasRef.current = anyFist;
      }

      /* Update particles */
      for (const p of particlesRef.current) {
        activePointers.forEach(pt => {
          if (pt.x <= 0 || pt.y <= 0) return;
          const dx = pt.x - p.x, dy = pt.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;

          if (effect === "attract" && dist < force * 2) {
            const f = (force - Math.min(dist, force)) / force;
            p.vx += (dx / dist) * f * 0.6 * dt;
            p.vy += (dy / dist) * f * 0.6 * dt;
          } else if (effect === "repel" && dist < force) {
            const f = (force - dist) / force;
            p.vx -= (dx / dist) * f * 0.9 * dt;
            p.vy -= (dy / dist) * f * 0.9 * dt;
          } else if (effect === "orbit" && dist < force * 2.5 && dist > 8) {
            const tx = -dy / dist, ty = dx / dist;
            const f = (1 - dist / (force * 2.5)) * 1.3;
            p.vx += tx * f * dt; p.vy += ty * f * dt;
            p.vx += (dx / dist) * 0.04 * dt; p.vy += (dy / dist) * 0.04 * dt;
          } else if (effect === "vortex" && pt.x > 0) {
            const angle = Math.atan2(dy, dx);
            const f = Math.max(0, (force * 2 - dist) / (force * 2)) * 1.5;
            p.vx += Math.cos(angle + Math.PI / 2) * f * dt;
            p.vy += Math.sin(angle + Math.PI / 2) * f * dt;
            p.vx += (dx / dist) * 0.04 * dt; p.vy += (dy / dist) * 0.04 * dt;
          } else if (effect === "galaxy" && dist < force * 3) {
            const angle = Math.atan2(dy, dx);
            const f = (1 - dist / (force * 3)) * 0.8;
            p.vx += Math.cos(angle + Math.PI / 2) * f * dt;
            p.vy += Math.sin(angle + Math.PI / 2) * f * dt;
            p.vx += (dx / dist) * 0.08 * dt; p.vy += (dy / dist) * 0.08 * dt;
          }
        });

        p.vx *= 0.97; p.vy *= 0.97;
        const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (spd > speed * 5) { p.vx = (p.vx / spd) * speed * 5; p.vy = (p.vy / spd) * speed * 5; }
        p.x += p.vx * dt * speed; p.y += p.vy * dt * speed;

        /* Bounce */
        if (p.x < p.r) { p.x = p.r; p.vx = Math.abs(p.vx); }
        if (p.x > canvas.width - p.r) { p.x = canvas.width - p.r; p.vx = -Math.abs(p.vx); }
        if (p.y < p.r) { p.y = p.r; p.vy = Math.abs(p.vy); }
        if (p.y > canvas.height - p.r) { p.y = canvas.height - p.r; p.vy = -Math.abs(p.vy); }

        /* Decay */
        if (p.decay) {
          p.life = (p.life ?? 1) - p.decay * dt;
          if (p.life <= 0) continue;
        }

        const al = (p.life ?? 1) * (p.alpha ?? 0.8);

        /* Glow */
        const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, sz * 3.5);
        grd.addColorStop(0, p.color); grd.addColorStop(1, "transparent");
        ctx.beginPath(); ctx.arc(p.x, p.y, sz * 3, 0, Math.PI * 2);
        ctx.fillStyle = grd; ctx.globalAlpha = al * 0.2; ctx.fill();

        /* Core */
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.4, sz * (p.life ?? 1)), 0, Math.PI * 2);
        ctx.fillStyle = p.color; ctx.globalAlpha = al; ctx.fill();
        ctx.globalAlpha = 1;
      }

      /* Draw hand position indicators */
      activePointers.forEach(pt => {
        if (pt.x > 0 && pt.y > 0) {
          const c = cols[0];
          /* Outer pulse ring */
          const ringPulse = (Math.sin(now * 0.004) + 1) * 0.5;
          const ringR = force * 0.6 + ringPulse * 15;
          ctx.beginPath(); ctx.arc(pt.x, pt.y, ringR, 0, Math.PI * 2);
          ctx.strokeStyle = c; ctx.globalAlpha = 0.1 + ringPulse * 0.08; ctx.lineWidth = 1; ctx.stroke();
          ctx.globalAlpha = 1;

          /* Core crosshair */
          ctx.strokeStyle = c; ctx.globalAlpha = pt.isFist ? 0.9 : 0.6; ctx.lineWidth = pt.isFist ? 2.5 : 1.5;
          const cs = pt.isFist ? 16 : 12;
          ctx.beginPath(); ctx.moveTo(pt.x - cs, pt.y); ctx.lineTo(pt.x + cs, pt.y); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(pt.x, pt.y - cs); ctx.lineTo(pt.x, pt.y + cs); ctx.stroke();

          /* Center dot */
          ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.isFist ? 7 : 4, 0, Math.PI * 2);
          ctx.fillStyle = c; ctx.globalAlpha = pt.isFist ? 1 : 0.8; ctx.fill();
          ctx.globalAlpha = 1;

          /* Fist label */
          if (pt.isFist && effect === "firework") {
            ctx.font = "bold 11px monospace"; ctx.fillStyle = "#FF2E88"; ctx.globalAlpha = 0.9;
            ctx.textAlign = "center"; ctx.fillText("✊ BLAST", pt.x, pt.y - 28); ctx.globalAlpha = 1;
          }
        }
      });

      /* Recording dot overlay */
      if (recordingRef.current) {
        const blink = Math.sin(now * 0.008) > 0;
        if (blink) {
          ctx.beginPath(); ctx.arc(canvas.width - 24, 24, 7, 0, Math.PI * 2);
          ctx.fillStyle = "#FF2E88"; ctx.globalAlpha = 0.95; ctx.fill(); ctx.globalAlpha = 1;
          ctx.font = "bold 10px monospace"; ctx.fillStyle = "#FF2E88"; ctx.textAlign = "right";
          ctx.fillText(`● REC ${((now - recordStartRef.current) / 1000).toFixed(1)}s`, canvas.width - 36, 28);
        }
      }
    };

    animIdRef.current = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(animIdRef.current); ro.disconnect(); };
  }, []); // eslint-disable-line

  /* Sync config ref */
  useEffect(() => {
    stateRef.current = { effect, speed, force, trailFade, size, palette, bgColor, looping };
  }, [effect, speed, force, trailFade, size, palette, bgColor, looping]);

  /* Re-spawn on palette / count / size change */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || effect === "trail" || effect === "paint" || effect === "galaxy") return;
    particlesRef.current = spawnParticles(canvas);
  }, [palette, count, size, spawnParticles, effect]);

  /* Cleanup on unmount */
  useEffect(() => () => {
    if (videoRef.current?.srcObject) videoRef.current.srcObject.getTracks().forEach(t => t.stop());
  }, []);

  /* ── MediaPipe Hand Tracking ── */
  const startHand = useCallback(async (deviceIdOverride) => {
    setHandStatus("loading");
    try {
      await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js");
      await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js");
      await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js");
      await new Promise(r => setTimeout(r, 250));

      const { Hands, Camera } = window;
      if (!Hands || !Camera) throw new Error("MediaPipe unavailable");

      const hands = new Hands({
        locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`,
      });
      hands.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.7, minTrackingConfidence: 0.6 });

      hands.onResults(results => {
        const multiLms = results.multiHandLandmarks || [];
        setHandDetected(multiLms.length > 0);

        /* Draw camera preview */
        const cam = camCanvasRef.current;
        const vid = videoRef.current;
        if (cam && vid) {
          const cc = cam.getContext("2d");
          cc.save(); cc.translate(cam.width, 0); cc.scale(-1, 1);
          cc.drawImage(vid, 0, 0, cam.width, cam.height);
          cc.restore();
          if (multiLms.length > 0 && window.drawConnectors && window.drawLandmarks) {
            multiLms.forEach(lms => {
              const mir = lms.map(l => ({ ...l, x: 1 - l.x }));
              window.drawConnectors(cc, mir, window.HAND_CONNECTIONS, { color: "#00F5FF", lineWidth: 1.5 });
              window.drawLandmarks(cc, mir, { color: "#FF2E88", lineWidth: 1, radius: 3 });
            });
          }
        }

        const newPointers = [];
        const canvas = canvasRef.current;

        multiLms.forEach(lms => {
          const palm = lms[9];
          let px = -9999, py = -9999;
          if (canvas) {
            px = (1 - palm.x) * canvas.width;
            py = palm.y * canvas.height;
          }
          /* Fist detection */
          const wrist = lms[0];
          const tips = [4, 8, 12, 16, 20].map(i => lms[i]);
          const avgD = tips.reduce((s, t) => {
            const dx = t.x - wrist.x, dy = t.y - wrist.y;
            return s + Math.sqrt(dx * dx + dy * dy);
          }, 0) / tips.length;
          const isFist = avgD < 0.15;
          newPointers.push({ x: px, y: py, isFist });
        });

        pointersRef.current = newPointers;
      });

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

      videoRef.current.srcObject = stream; videoRef.current.play();
      const camera = new Camera(videoRef.current, {
        onFrame: async () => { await hands.send({ image: videoRef.current }); },
        width: 320, height: 240,
      });
      camera.start();
      handActiveRef.current = true;
      setHandStatus("active");
      
      // Refresh devices to get labels
      getDevices();
    } catch (e) {
      console.error(e);
      // Show specific error for device-in-use (another tab/app using camera)
      const msg = e?.name === "NotReadableError" ? "device_busy" : "denied";
      setHandStatus(msg === "device_busy" ? "busy" : "error");
    }
  }, [selectedDevice, devices, getDevices]);

  const stopHand = useCallback(() => {
    handActiveRef.current = false;
    pointersRef.current = [];
    setHandDetected(false);
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setHandStatus("idle");
  }, []);

  const handleDeviceChange = useCallback(async (deviceId) => {
    setSelectedDevice(deviceId);
    if (handActiveRef.current) {
      stopHand();
      setTimeout(() => {
        startHand(deviceId);
      }, 300);
    }
  }, [startHand, stopHand]);

  /* ── Recording controls ── */
  const startRecording = useCallback(() => {
    framesRef.current = [];
    recordStartRef.current = performance.now();
    recordingRef.current = true;
    setRecState("recording");
  }, []);

  const stopRecording = useCallback(() => {
    recordingRef.current = false;
    const dur = framesRef.current.length > 0
      ? framesRef.current[framesRef.current.length - 1].t : 0;
    setRecDuration(dur);
    setRecState(dur > 0.3 ? "recorded" : "idle");
  }, []);

  /* ── Playback controls ── */
  const startPlayback = useCallback(() => {
    if (!framesRef.current.length) return;
    playOffsetRef.current = 0;
    playStartRef.current = performance.now();
    playingRef.current = true;
    setPlaying(true);
    setPlayTime(0);
  }, []);

  const pausePlayback = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
  }, []);

  const clearRecording = useCallback(() => {
    framesRef.current = [];
    recordingRef.current = false;
    playingRef.current = false;
    setPlaying(false);
    setRecState("idle");
    setRecDuration(0);
    setPlayTime(0);
  }, []);

  /* Scrub playback */
  const onScrub = (e) => {
    if (recState !== "recorded") return;
    const r = e.currentTarget.getBoundingClientRect();
    const frac = clamp((e.clientX - r.left) / r.width, 0, 1);
    const t = frac * recDuration;
    playOffsetRef.current = t;
    playStartRef.current = performance.now();
    setPlayTime(t);
  };

  const onMouseMove = (e) => {
    if (handActiveRef.current) return; // hand tracking takes priority
    const r = canvasRef.current?.getBoundingClientRect();
    if (!r) return;
    pointersRef.current = [{
      x: e.clientX - r.left,
      y: e.clientY - r.top,
      isFist: false
    }];
  };
  const onMouseLeave = () => {
    if (!handActiveRef.current) pointersRef.current = [];
  };
  const onCanvasClick = (e) => {
    // Click = fist trigger for firework in mouse mode
    if (!handActiveRef.current && stateRef.current.effect === "firework") {
      if (pointersRef.current[0]) {
        pointersRef.current[0].isFist = true;
        setTimeout(() => {
          if (pointersRef.current[0]) pointersRef.current[0].isFist = false;
        }, 200);
      }
    }
  };

  /* ── UI helpers ── */
  const primary = PALETTES.find(p => p.id === palette)?.colors[0] || "#00F5FF";
  const statusColor = { idle: "rgba(148,163,184,0.4)", loading: "#FFD700", active: "#00FF88", error: "#FF2E88", busy: "#FFA500" }[handStatus];

  const fmtTime = t => `${Math.floor(t)}:${String(Math.round((t % 1) * 10)).padStart(2, "0")}`;

  return (
    <div style={{ display: "flex", height: "calc(100vh - 90px)", gap: 0, borderRadius: 12, overflow: "hidden", border: "1px solid rgba(0,245,255,0.08)" }}>
      <video ref={videoRef} style={{ display: "none" }} playsInline muted />

      {/* ── Canvas ── */}
      <div style={{ flex: 1, position: "relative", background: bgColor }}>
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }}
          onMouseMove={onMouseMove} onMouseLeave={onMouseLeave} onClick={onCanvasClick} />

        {/* Top-left HUD */}
        <div style={{ position: "absolute", top: 12, left: 12, display: "flex", flexDirection: "column", gap: 6, zIndex: 5 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 12px",
            background: "rgba(2,6,23,0.75)", backdropFilter: "blur(10px)",
            border: `1px solid ${primary}33`, borderRadius: 10 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: primary, boxShadow: `0 0 8px ${primary}` }} />
            <span style={{ fontFamily: "monospace", fontSize: 9.5, letterSpacing: "0.2em", color: primary }}>
              {EFFECTS.find(e => e.id === effect)?.label}
            </span>
            {handStatus === "active" && (
              <span style={{ fontFamily: "monospace", fontSize: 8.5, color: handDetected ? "#00FF88" : "#FFD700",
                padding: "1px 7px", background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.2)", borderRadius: 5 }}>
                {handDetected ? "✋ TRACKING" : "SCANNING…"}
              </span>
            )}
          </div>

          {/* Recording / Playback badge */}
          {recState === "recording" && (
            <div style={{ padding: "5px 12px", background: "rgba(255,46,136,0.12)",
              border: "1px solid rgba(255,46,136,0.4)", borderRadius: 8, fontFamily: "monospace",
              fontSize: 9.5, color: "#FF2E88", display: "flex", alignItems: "center", gap: 7 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#FF2E88",
                animation: "hps-blink 0.6s ease infinite" }} />
              RECORDING
            </div>
          )}
          {playing && (
            <div style={{ padding: "5px 12px", background: "rgba(0,245,255,0.08)",
              border: "1px solid rgba(0,245,255,0.3)", borderRadius: 8, fontFamily: "monospace",
              fontSize: 9.5, color: "#00F5FF", display: "flex", alignItems: "center", gap: 7 }}>
              <span>▶</span> PLAYBACK {fmtTime(playTime)} / {fmtTime(recDuration)}
            </div>
          )}
        </div>

        {/* Camera preview */}
        {handStatus === "active" && showCam && (
          <div style={{ position: "absolute", bottom: 12, right: 12, borderRadius: 10, overflow: "hidden",
            border: `2px solid ${handDetected ? "#00FF88" : "#00F5FF"}44`,
            boxShadow: `0 0 20px ${handDetected ? "rgba(0,255,136,0.25)" : "rgba(0,245,255,0.15)"}`, zIndex: 5 }}>
            <canvas ref={camCanvasRef} width={180} height={135} style={{ display: "block" }} />
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0,
              background: "rgba(2,6,23,0.8)", padding: "3px 8px", textAlign: "center",
              fontFamily: "monospace", fontSize: 8, color: handDetected ? "#00FF88" : "#00F5FF" }}>
              {handDetected ? "✋ PALM TRACKED" : "SCANNING HAND…"}
            </div>
          </div>
        )}



        {/* Stats */}
        <div style={{ position: "absolute", bottom: 12, left: 12, fontFamily: "monospace", fontSize: 8.5,
          color: "rgba(148,163,184,0.4)", display: "flex", gap: 14,
          background: "rgba(2,6,23,0.6)", backdropFilter: "blur(6px)",
          padding: "5px 10px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.04)" }}>
          <span>⬡ <span style={{ color: primary }}>{particleCount}</span></span>
          <span>FPS <span style={{ color: "#00FF88" }}>{fps}</span></span>
          {recState === "recorded" && <span>REC <span style={{ color: "#FF2E88" }}>{fmtTime(recDuration)}</span></span>}
        </div>
      </div>

      {/* ── Side controls ── */}
      <div style={{ width: 250, flexShrink: 0, background: "rgba(2,6,23,0.92)", borderLeft: "1px solid rgba(0,245,255,0.07)",
        display: "flex", flexDirection: "column", overflowY: "auto", gap: 0 }}>

        {/* Hand tracking */}
        <Section label="✋ HAND TRACKING">
          <button onClick={handStatus === "active" ? stopHand : startHand}
            disabled={handStatus === "loading"}
            style={{ width: "100%", padding: 10, borderRadius: 8, cursor: handStatus === "loading" ? "wait" : "pointer",
              fontFamily: "monospace", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
              background: handStatus === "active" ? "rgba(0,255,136,0.1)" : "rgba(0,245,255,0.08)",
              border: handStatus === "active" ? "1px solid rgba(0,255,136,0.35)" : "1px solid rgba(0,245,255,0.25)",
              color: handStatus === "active" ? "#00FF88" : "#00F5FF",
              boxShadow: handStatus === "active" ? "0 0 14px rgba(0,255,136,0.15)" : "none",
              transition: "all 0.2s", marginBottom: 8 }}>
            {handStatus === "idle" ? "START HAND TRACKING" : handStatus === "loading" ? "LOADING…" : handStatus === "active" ? "⬛ STOP TRACKING" : handStatus === "busy" ? "⚠ CAM BUSY — RETRY" : "⚠ ERROR — RETRY"}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor,
              boxShadow: handStatus === "active" ? `0 0 6px ${statusColor}` : "none",
              animation: handStatus === "loading" ? "hps-blink 0.7s ease infinite" : "none" }} />
            <span style={{ fontFamily: "monospace", fontSize: 8.5, color: statusColor }}>
              {{ idle: "OFFLINE — mouse mode active", loading: "INITIALIZING…", active: handDetected ? "✋ HAND DETECTED" : "SCANNING…", error: "PERMISSION DENIED — check browser settings", busy: "CAMERA IN USE BY ANOTHER APP" }[handStatus]}
            </span>
          </div>
          {devices.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
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
          {/* Mouse mode notice when hand tracking is off */}
          {handStatus !== "active" && (
            <div style={{ padding: "7px 10px", background: "rgba(0,245,255,0.05)", border: "1px solid rgba(0,245,255,0.12)",
              borderRadius: 7, fontFamily: "monospace", fontSize: 8.5, color: "rgba(148,163,184,0.5)", lineHeight: 1.6 }}>
              🖥️ <span style={{ color: "#00F5FF" }}>Mouse mode active</span> — move mouse on canvas. Click = fist (FIREWORK).
            </div>
          )}
          {handStatus === "active" && (
            <button onClick={() => setShowCam(s => !s)}
              style={{ marginTop: 8, width: "100%", padding: "6px", borderRadius: 7, cursor: "pointer",
                fontFamily: "monospace", fontSize: 9, background: showCam ? "rgba(0,245,255,0.06)" : "rgba(255,255,255,0.03)",
                border: showCam ? "1px solid rgba(0,245,255,0.2)" : "1px solid rgba(255,255,255,0.06)",
                color: showCam ? "#00F5FF" : "rgba(148,163,184,0.4)", textTransform: "uppercase" }}>
              {showCam ? "◉ CAMERA PREVIEW ON" : "○ CAMERA PREVIEW OFF"}
            </button>
          )}
        </Section>

        {/* Record & Playback */}
        <Section label="⏺ RECORD & PLAY">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
            {recState !== "recording" ? (
              <button onClick={startRecording}
                style={{ padding: "9px", borderRadius: 8, cursor: "pointer", fontFamily: "monospace",
                  fontSize: 9.5, textTransform: "uppercase",
                  background: "rgba(255,46,136,0.1)", border: "1px solid rgba(255,46,136,0.3)", color: "#FF2E88" }}>
                ● REC
              </button>
            ) : (
              <button onClick={stopRecording}
                style={{ padding: "9px", borderRadius: 8, cursor: "pointer", fontFamily: "monospace",
                  fontSize: 9.5, textTransform: "uppercase", animation: "hps-blink 0.8s ease infinite",
                  background: "rgba(255,46,136,0.2)", border: "1px solid rgba(255,46,136,0.6)", color: "#FF2E88" }}>
                ■ STOP
              </button>
            )}
            <button onClick={playing ? pausePlayback : startPlayback}
              disabled={recState !== "recorded"}
              style={{ padding: "9px", borderRadius: 8, cursor: recState === "recorded" ? "pointer" : "not-allowed",
                fontFamily: "monospace", fontSize: 9.5, textTransform: "uppercase",
                background: playing ? "rgba(110,86,255,0.15)" : "rgba(0,245,255,0.08)",
                border: playing ? "1px solid rgba(110,86,255,0.4)" : "1px solid rgba(0,245,255,0.2)",
                color: playing ? "#a78bfa" : recState === "recorded" ? "#00F5FF" : "rgba(148,163,184,0.3)" }}>
              {playing ? "⏸ PAUSE" : "▶ PLAY"}
            </button>
          </div>

          {/* Timeline scrubber */}
          {recState === "recorded" && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4,
                fontFamily: "monospace", fontSize: 8.5, color: "rgba(148,163,184,0.45)" }}>
                <span>0:0</span>
                <span style={{ color: "#00F5FF" }}>{fmtTime(playTime)}</span>
                <span>{fmtTime(recDuration)}</span>
              </div>
              <div style={{ position: "relative", height: 18, cursor: "pointer",
                background: "rgba(0,245,255,0.06)", border: "1px solid rgba(0,245,255,0.15)", borderRadius: 6 }}
                onClick={onScrub} onMouseMove={e => { if (e.buttons) onScrub(e); }}>
                {/* Progress fill */}
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 6,
                  width: `${(playTime / recDuration) * 100}%`,
                  background: "linear-gradient(90deg, rgba(0,245,255,0.25), rgba(110,86,255,0.25))" }} />
                {/* Playhead */}
                <div style={{ position: "absolute", top: "50%", left: `${(playTime / recDuration) * 100}%`,
                  transform: "translate(-50%,-50%)", width: 10, height: 10, borderRadius: "50%",
                  background: "#00F5FF", boxShadow: "0 0 8px rgba(0,245,255,0.8)", pointerEvents: "none" }} />
                {/* Frame markers (sparse) */}
                {framesRef.current.filter((_, i) => i % 15 === 0).map((f, i) => (
                  <div key={i} style={{ position: "absolute", left: `${(f.t / recDuration) * 100}%`,
                    top: 0, bottom: 0, width: 1, background: (f.pointers ? f.pointers.some(pt => pt.isFist) : f.isFist) ? "rgba(255,46,136,0.6)" : "rgba(0,245,255,0.2)" }} />
                ))}
              </div>
              <div style={{ fontFamily: "monospace", fontSize: 8, color: "rgba(148,163,184,0.3)", marginTop: 3 }}>
                {framesRef.current.length} frames · pink marks = fist
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setLooping(l => !l)}
              style={{ flex: 1, padding: "7px", borderRadius: 7, cursor: "pointer",
                fontFamily: "monospace", fontSize: 9, textTransform: "uppercase",
                background: looping ? "rgba(110,86,255,0.1)" : "rgba(255,255,255,0.03)",
                border: looping ? "1px solid rgba(110,86,255,0.3)" : "1px solid rgba(255,255,255,0.06)",
                color: looping ? "#a78bfa" : "rgba(148,163,184,0.4)" }}>
              ↺ LOOP
            </button>
            <button onClick={clearRecording}
              style={{ flex: 1, padding: "7px", borderRadius: 7, cursor: "pointer",
                fontFamily: "monospace", fontSize: 9, textTransform: "uppercase",
                background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}>
              🗑 CLEAR
            </button>
          </div>
        </Section>

        {/* Effect selector */}
        <Section label="⚡ PARTICLE EFFECT">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
            {EFFECTS.map(ef => (
              <button key={ef.id} onClick={() => setEffect(ef.id)} title={ef.desc}
                style={{ padding: "6px 4px", borderRadius: 7, cursor: "pointer",
                  fontFamily: "monospace", fontSize: 8.5, letterSpacing: "0.06em", textTransform: "uppercase",
                  transition: "all 0.12s",
                  background: effect === ef.id ? `${primary}18` : "rgba(255,255,255,0.03)",
                  border: effect === ef.id ? `1px solid ${primary}55` : "1px solid rgba(255,255,255,0.06)",
                  color: effect === ef.id ? primary : "rgba(148,163,184,0.6)",
                  boxShadow: effect === ef.id ? `0 0 10px ${primary}20` : "none" }}>
                {ef.label}
              </button>
            ))}
          </div>
        </Section>

        {/* Palette */}
        <Section label="🎨 COLOR PALETTE">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
            {PALETTES.map(p => (
              <button key={p.id} onClick={() => setPalette(p.id)}
                style={{ padding: "6px 8px", borderRadius: 7, cursor: "pointer",
                  fontFamily: "monospace", fontSize: 8.5,
                  display: "flex", alignItems: "center", gap: 5, transition: "all 0.12s",
                  background: palette === p.id ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.02)",
                  border: palette === p.id ? `1px solid ${p.colors[0]}55` : "1px solid rgba(255,255,255,0.06)",
                  color: palette === p.id ? "#fff" : "rgba(148,163,184,0.5)" }}>
                <div style={{ display: "flex", gap: 2 }}>
                  {p.colors.map((c, i) => <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: c }} />)}
                </div>
                {p.label}
              </button>
            ))}
          </div>
        </Section>

        {/* Parameters */}
        <Section label="⚙ PARAMETERS">
          <SL label="COUNT"  value={count}     min={40}  max={500} step={10}  onChange={setCount}     unit="" />
          <SL label="SPEED"  value={speed}     min={0.5} max={8}   step={0.1} onChange={setSpeed}     unit="x" />
          <SL label="SIZE"   value={size}      min={1}   max={12}  step={0.5} onChange={setSize}      unit="px" />
          <SL label="FORCE"  value={force}     min={20}  max={280} step={5}   onChange={setForce}     unit="px" />
          <SL label="TRAIL"  value={trailFade} min={4}   max={100} step={1}   onChange={setTrailFade} unit="%" />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
            <span style={{ fontFamily: "monospace", fontSize: 9, color: "rgba(148,163,184,0.5)" }}>BG COLOR</span>
            <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)}
              style={{ width: 36, height: 22, border: "none", background: "none", cursor: "pointer" }} />
          </div>
        </Section>

        {/* Tips */}
        <div style={{ padding: "10px 12px 14px", fontFamily: "monospace", fontSize: 8.5, color: "rgba(148,163,184,0.3)", lineHeight: 1.7 }}>
          <div style={{ color: "rgba(148,163,184,0.5)", marginBottom: 4, letterSpacing: "0.15em" }}>◈ HOW TO USE</div>
          1. <span style={{ color: primary }}>Start Hand Tracking</span><br />
          2. <span style={{ color: "#FF2E88" }}>● REC</span> to record your hand animation<br />
          3. <span style={{ color: "#FF2E88" }}>■ STOP</span> when done<br />
          4. <span style={{ color: "#00F5FF" }}>▶ PLAY</span> to replay with particles<br />
          <span style={{ color: "#a78bfa" }}>FIREWORK: clench fist ✊ to blast</span>
        </div>
      </div>

      <style>{`
        @keyframes hps-blink { 0%,100%{opacity:1} 50%{opacity:0.2} }
        input[type=range] { -webkit-appearance:none; height:3px; background:rgba(0,245,255,0.12); border-radius:4px; outline:none; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; width:12px; height:12px; border-radius:50%; background:#00F5FF; cursor:pointer; box-shadow:0 0 7px rgba(0,245,255,0.7); }
        @keyframes hps-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes hps-pulse-ring {
          0% { transform: scale(0.95); opacity: 0.8; }
          50% { transform: scale(1.15); opacity: 0.2; }
          100% { transform: scale(0.95); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}

/* ─── Sub-components ─── */
function Section({ label, children }) {
  return (
    <div style={{ padding: "12px 12px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <div style={{ fontFamily: "monospace", fontSize: 8, letterSpacing: "0.2em",
        color: "rgba(148,163,184,0.4)", textTransform: "uppercase", marginBottom: 9 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function SL({ label, value, min, max, step, onChange, unit }) {
  return (
    <div style={{ marginBottom: 11 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontFamily: "monospace", fontSize: 8.5, color: "rgba(148,163,184,0.5)", letterSpacing: "0.1em" }}>{label}</span>
        <span style={{ fontFamily: "monospace", fontSize: 8.5, color: "#00F5FF" }}>{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "#00F5FF" }} />
    </div>
  );
}
