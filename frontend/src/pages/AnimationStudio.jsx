import { useEffect, useRef, useState, useCallback } from "react";

/* ──────────────────────────────────────────────────────────
   Utilities
────────────────────────────────────────────────────────── */
let _oid = 1;
const uid = () => `obj_${_oid++}`;

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}
function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, "0")).join("");
}
function lerpColor(c1, c2, t) {
  const [r1, g1, b1] = hexToRgb(c1);
  const [r2, g2, b2] = hexToRgb(c2);
  return rgbToHex(lerp(r1, r2, t), lerp(g1, g2, t), lerp(b1, b2, t));
}

/* Interpolate object properties between two keyframes */
function interpKF(kfA, kfB, t) {
  const r = (t - kfA.time) / (kfB.time - kfA.time);
  const ease = r < 0.5 ? 2 * r * r : -1 + (4 - 2 * r) * r; // ease-in-out
  return {
    x: lerp(kfA.x, kfB.x, ease),
    y: lerp(kfA.y, kfB.y, ease),
    w: lerp(kfA.w, kfB.w, ease),
    h: lerp(kfA.h, kfB.h, ease),
    rotation: lerp(kfA.rotation, kfB.rotation, ease),
    opacity: lerp(kfA.opacity, kfB.opacity, ease),
    color: lerpColor(kfA.color, kfB.color, ease),
  };
}

/* Get interpolated props for an object at given time */
function getPropsAt(obj, time) {
  const kfs = [...obj.keyframes].sort((a, b) => a.time - b.time);
  if (!kfs.length) return { x: obj.x, y: obj.y, w: obj.w, h: obj.h, rotation: obj.rotation, opacity: obj.opacity, color: obj.color };
  if (time <= kfs[0].time) return kfs[0];
  if (time >= kfs[kfs.length - 1].time) return kfs[kfs.length - 1];
  let a = kfs[0], b = kfs[1];
  for (let i = 0; i < kfs.length - 1; i++) {
    if (time >= kfs[i].time && time <= kfs[i + 1].time) { a = kfs[i]; b = kfs[i + 1]; break; }
  }
  return interpKF(a, b, time);
}

/* Draw a single object on a canvas context */
function drawObject(ctx, obj, props, selected) {
  const { x, y, w, h, rotation, opacity, color } = props;
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate((rotation * Math.PI) / 180);

  if (obj.type === "rect") {
    ctx.fillStyle = color;
    ctx.beginPath();
    const r = Math.min(obj.borderRadius || 0, Math.min(w, h) / 2);
    ctx.roundRect(-w / 2, -h / 2, w, h, r);
    ctx.fill();
    if (obj.stroke) { ctx.strokeStyle = obj.stroke; ctx.lineWidth = obj.strokeWidth || 2; ctx.stroke(); }
  } else if (obj.type === "circle") {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    if (obj.stroke) { ctx.strokeStyle = obj.stroke; ctx.lineWidth = obj.strokeWidth || 2; ctx.stroke(); }
  } else if (obj.type === "star") {
    const points = obj.starPoints || 5;
    const outerR = Math.min(w, h) / 2;
    const innerR = outerR * 0.42;
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r2 = i % 2 === 0 ? outerR : innerR;
      const a = (i * Math.PI) / points - Math.PI / 2;
      i === 0 ? ctx.moveTo(Math.cos(a) * r2, Math.sin(a) * r2) : ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
    }
    ctx.closePath(); ctx.fill();
    if (obj.stroke) { ctx.strokeStyle = obj.stroke; ctx.lineWidth = obj.strokeWidth || 2; ctx.stroke(); }
  } else if (obj.type === "triangle") {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -h / 2);
    ctx.lineTo(w / 2, h / 2);
    ctx.lineTo(-w / 2, h / 2);
    ctx.closePath(); ctx.fill();
    if (obj.stroke) { ctx.strokeStyle = obj.stroke; ctx.lineWidth = obj.strokeWidth || 2; ctx.stroke(); }
  } else if (obj.type === "text") {
    ctx.fillStyle = color;
    ctx.font = `${obj.bold ? "bold " : ""}${obj.fontSize || 28}px ${obj.fontFamily || "'JetBrains Mono', monospace"}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(obj.text || "TEXT", 0, 0);
  } else if (obj.type === "line") {
    ctx.strokeStyle = color;
    ctx.lineWidth = obj.lineWidth || 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0);
    ctx.lineTo(w / 2, 0);
    ctx.stroke();
  }

  // Selection handles
  if (selected) {
    ctx.strokeStyle = "#00F5FF";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8);
    ctx.setLineDash([]);
    // Corner handles
    for (const [hx, hy] of [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]) {
      ctx.fillStyle = "#00F5FF";
      ctx.fillRect(hx - 4, hy - 4, 8, 8);
    }
  }
  ctx.restore();
}

/* ─── Presets ──────────────────────────────────────────── */
const PRESETS = [
  {
    id: "bounce", label: "BOUNCE", desc: "Jump up and down",
    apply: (obj, dur) => [
      { time: 0, ...snapProps(obj) },
      { time: dur * 0.25, ...snapProps(obj), y: obj.y - 80 },
      { time: dur * 0.5,  ...snapProps(obj) },
      { time: dur * 0.75, ...snapProps(obj), y: obj.y - 40 },
      { time: dur,        ...snapProps(obj) },
    ],
  },
  {
    id: "spin", label: "SPIN", desc: "Rotate 360°",
    apply: (obj, dur) => [
      { time: 0,   ...snapProps(obj), rotation: 0 },
      { time: dur, ...snapProps(obj), rotation: 360 },
    ],
  },
  {
    id: "fade", label: "FADE IN", desc: "Fade from invisible",
    apply: (obj, dur) => [
      { time: 0,   ...snapProps(obj), opacity: 0 },
      { time: dur, ...snapProps(obj), opacity: 1 },
    ],
  },
  {
    id: "fadeout", label: "FADE OUT", desc: "Fade to invisible",
    apply: (obj, dur) => [
      { time: 0,   ...snapProps(obj), opacity: 1 },
      { time: dur, ...snapProps(obj), opacity: 0 },
    ],
  },
  {
    id: "pulse", label: "PULSE", desc: "Scale in and out",
    apply: (obj, dur) => [
      { time: 0,          ...snapProps(obj) },
      { time: dur * 0.5,  ...snapProps(obj), w: obj.w * 1.4, h: obj.h * 1.4 },
      { time: dur,        ...snapProps(obj) },
    ],
  },
  {
    id: "shake", label: "SHAKE", desc: "Vibrate sideways",
    apply: (obj, dur) => [
      { time: 0,          ...snapProps(obj) },
      { time: dur * 0.2,  ...snapProps(obj), x: obj.x + 18 },
      { time: dur * 0.4,  ...snapProps(obj), x: obj.x - 18 },
      { time: dur * 0.6,  ...snapProps(obj), x: obj.x + 12 },
      { time: dur * 0.8,  ...snapProps(obj), x: obj.x - 12 },
      { time: dur,        ...snapProps(obj) },
    ],
  },
  {
    id: "slidein", label: "SLIDE IN", desc: "Enter from left",
    apply: (obj, dur) => [
      { time: 0,   ...snapProps(obj), x: -obj.w - 40, opacity: 0 },
      { time: dur, ...snapProps(obj), opacity: 1 },
    ],
  },
  {
    id: "color", label: "COLOR SHIFT", desc: "Cycle through colors",
    apply: (obj, dur) => [
      { time: 0,          ...snapProps(obj), color: "#00F5FF" },
      { time: dur * 0.33, ...snapProps(obj), color: "#FF2E88" },
      { time: dur * 0.66, ...snapProps(obj), color: "#6E56FF" },
      { time: dur,        ...snapProps(obj), color: "#00FF88" },
    ],
  },
];

function snapProps(obj) {
  return { x: obj.x, y: obj.y, w: obj.w, h: obj.h, rotation: obj.rotation, opacity: obj.opacity, color: obj.color };
}

/* ─── Default object factory ──────────────────────────── */
function makeObject(type, x, y) {
  const base = {
    id: uid(), type, x, y, rotation: 0, opacity: 1, keyframes: [],
    color: "#00F5FF", stroke: null, strokeWidth: 2, visible: true, locked: false,
    name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${_oid}`,
  };
  if (type === "rect")     return { ...base, w: 120, h: 80, borderRadius: 6 };
  if (type === "circle")   return { ...base, w: 90,  h: 90 };
  if (type === "star")     return { ...base, w: 90,  h: 90, starPoints: 5 };
  if (type === "triangle") return { ...base, w: 100, h: 90 };
  if (type === "text")     return { ...base, w: 160, h: 50, text: "NEXUS", fontSize: 32, bold: true, fontFamily: "'JetBrains Mono', monospace" };
  if (type === "line")     return { ...base, w: 140, h: 4, lineWidth: 3 };
  return base;
}

/* ─── Timeline constants ──────────────────────────────── */
const DURATION   = 10;   // seconds
const PX_PER_SEC = 70;   // px per second in timeline
const TOTAL_W    = DURATION * PX_PER_SEC;

/* ══════════════════════════════════════════════════════════
   Main Component
══════════════════════════════════════════════════════════ */
export default function AnimationStudio() {
  const canvasRef    = useRef(null);
  const animIdRef    = useRef(null);
  const playingRef   = useRef(false);
  const currentTimeRef = useRef(0);
  const lastRAFTime  = useRef(null);
  const objectsRef   = useRef([]);   // live copy for RAF
  const dragRef      = useRef(null); // { objId, startX, startY, objStartX, objStartY }

  const [objects,      setObjects]      = useState([]);
  const [selectedId,   setSelectedId]   = useState(null);
  const [tool,         setTool]         = useState("select");
  const [playing,      setPlaying]      = useState(false);
  const [looping,      setLooping]      = useState(true);
  const [currentTime,  setCurrentTime]  = useState(0);
  const [bgColor,      setBgColor]      = useState("#020617");
  const canvasW = 800;
  const canvasH = 450;
  const [zoom,         setZoom]         = useState(1);
  const timelineRef  = useRef(null);

  /* sync objects ref */
  useEffect(() => { objectsRef.current = objects; }, [objects]);
  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);

  /* ── Canvas render ── */
  const render = useCallback((time = currentTimeRef.current) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Ensure canvas internal dimensions are set
    if (canvas.width !== canvasW) canvas.width = canvasW;
    if (canvas.height !== canvasH) canvas.height = canvasH;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const objs = objectsRef.current;
    for (const obj of objs) {
      if (!obj.visible) continue;
      const props = obj.keyframes.length ? getPropsAt(obj, time) : snapProps(obj);
      drawObject(ctx, obj, props, obj.id === selectedId);
    }
  }, [bgColor, selectedId]);

  /* ── RAF playback loop ── */
  useEffect(() => {
    if (!playing) { render(); return; }

    const loop = (now) => {
      if (!lastRAFTime.current) lastRAFTime.current = now;
      const dt = (now - lastRAFTime.current) / 1000;
      lastRAFTime.current = now;

      let t = currentTimeRef.current + dt;
      if (t >= DURATION) {
        t = looping ? 0 : DURATION;
        if (!looping) { setPlaying(false); playingRef.current = false; }
      }
      currentTimeRef.current = t;
      setCurrentTime(t);
      render(t);
      if (playingRef.current) animIdRef.current = requestAnimationFrame(loop);
    };

    playingRef.current = true;
    lastRAFTime.current = null;
    animIdRef.current = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(animIdRef.current); playingRef.current = false; };
  }, [playing, looping, render]);

  /* Re-render when time or objects change (while paused) */
  useEffect(() => { if (!playing) render(currentTime); }, [playing, currentTime, objects, bgColor, selectedId, render]);

  /* ── Add shape ── */
  const addShape = useCallback((type) => {
    const cx = canvasW / 2 - 60 + Math.random() * 40;
    const cy = canvasH / 2 - 40 + Math.random() * 40;
    const obj = makeObject(type, cx, cy);
    setObjects(prev => [...prev, obj]);
    setSelectedId(obj.id);
    setTool("select");
  }, []);

  /* ── Delete selected ── */
  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    setObjects(prev => prev.filter(o => o.id !== selectedId));
    setSelectedId(null);
  }, [selectedId]);

  /* ── Add keyframe at current time for selected obj ── */
  const addKeyframe = useCallback(() => {
    if (!selectedId) return;
    const t = currentTimeRef.current;
    setObjects(prev => prev.map(obj => {
      if (obj.id !== selectedId) return obj;
      const props = snapProps(obj);
      const existing = obj.keyframes.filter(k => Math.abs(k.time - t) > 0.05);
      return { ...obj, keyframes: [...existing, { time: t, ...props }].sort((a, b) => a.time - b.time) };
    }));
  }, [selectedId]);

  /* ── Apply preset ── */
  const applyPreset = useCallback((preset) => {
    if (!selectedId) return;
    setObjects(prev => prev.map(obj => {
      if (obj.id !== selectedId) return obj;
      const kfs = preset.apply(obj, Math.min(DURATION, 4));
      return { ...obj, keyframes: kfs };
    }));
  }, [selectedId]);

  /* ── Update selected object property ── */
  const updateObj = useCallback((id, patch) => {
    setObjects(prev => prev.map(o => o.id === id ? { ...o, ...patch } : o));
  }, []);

  /* ── Canvas mouse events ── */
  const getCanvasXY = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    // r.width = canvasW * zoom (CSS scaled), so divide by r.width then multiply by canvasW
    const scaleX = canvasW / r.width;
    const scaleY = canvasH / r.height;
    return { x: (e.clientX - r.left) * scaleX, y: (e.clientY - r.top) * scaleY };
  };

  const hitTest = (x, y) => {
    const objs = [...objectsRef.current].reverse();
    for (const obj of objs) {
      if (!obj.visible || obj.locked) continue;
      const props = obj.keyframes.length ? getPropsAt(obj, currentTimeRef.current) : snapProps(obj);
      const cx = props.x + props.w / 2, cy = props.y + props.h / 2;
      const dx = x - cx, dy = y - cy;
      const rad = (-props.rotation * Math.PI) / 180;
      const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
      const ly = dx * Math.sin(rad) + dy * Math.cos(rad);
      if (Math.abs(lx) <= props.w / 2 + 5 && Math.abs(ly) <= props.h / 2 + 5) return obj;
    }
    return null;
  };

  const onCanvasMouseDown = (e) => {
    const { x, y } = getCanvasXY(e);
    if (tool === "select") {
      const hit = hitTest(x, y);
      setSelectedId(hit?.id || null);
      if (hit) {
        dragRef.current = { objId: hit.id, startX: x, startY: y, objStartX: hit.x, objStartY: hit.y };
      }
    } else {
      // Create new shape
      addShape(tool);
    }
  };

  const onCanvasMouseMove = (e) => {
    if (!dragRef.current) return;
    const { x, y } = getCanvasXY(e);
    const { objId, startX, startY, objStartX, objStartY } = dragRef.current;
    const nx = objStartX + (x - startX);
    const ny = objStartY + (y - startY);
    updateObj(objId, { x: nx, y: ny });
  };

  const onCanvasMouseUp = () => { dragRef.current = null; };

  /* ── Timeline scrub ── */
  const onTimelineScrub = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    const t = clamp(x / PX_PER_SEC, 0, DURATION);
    setCurrentTime(t);
    if (!playing) render(t);
  };

  /* ── Play/Pause ── */
  const togglePlay = () => {
    if (playing) { setPlaying(false); }
    else { if (currentTime >= DURATION) setCurrentTime(0); setPlaying(true); }
  };

  const stop = () => { setPlaying(false); setCurrentTime(0); render(0); };

  /* selected object */
  const sel = objects.find(o => o.id === selectedId);

  /* format time */
  const fmtTime = (t) => `${Math.floor(t)}:${String(Math.round((t % 1) * 10)).padStart(2, "0")}`;

  const TOOLS = [
    { id: "select",   icon: "↖", label: "SELECT" },
    { id: "rect",     icon: "▬", label: "RECT" },
    { id: "circle",   icon: "●", label: "CIRCLE" },
    { id: "star",     icon: "★", label: "STAR" },
    { id: "triangle", icon: "▲", label: "TRI" },
    { id: "text",     icon: "T", label: "TEXT" },
    { id: "line",     icon: "—", label: "LINE" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 90px)", gap: 0, background: "#020617", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(0,245,255,0.08)" }}>

      {/* ══ Top bar ══ */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid rgba(0,245,255,0.08)", background: "rgba(2,6,23,0.9)", flexShrink: 0 }}>
        {/* Tool buttons */}
        <div style={{ display: "flex", gap: 4 }}>
          {TOOLS.map(t => (
            <button key={t.id} onClick={() => { setTool(t.id); if (t.id !== "select") addShape(t.id); }}
              title={t.label}
              style={{ padding: "5px 10px", borderRadius: 7, cursor: "pointer",
                fontFamily: "monospace", fontSize: 13, transition: "all 0.12s",
                background: tool === t.id ? "rgba(0,245,255,0.12)" : "rgba(255,255,255,0.04)",
                border: tool === t.id ? "1px solid rgba(0,245,255,0.35)" : "1px solid rgba(255,255,255,0.07)",
                color: tool === t.id ? "#00F5FF" : "rgba(148,163,184,0.7)" }}>
              {t.icon}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.08)", margin: "0 4px" }} />

        {/* Playback controls */}
        <button onClick={stop} title="Stop"
          style={{ padding: "5px 10px", borderRadius: 7, cursor: "pointer", fontFamily: "monospace", fontSize: 11,
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(148,163,184,0.7)" }}>
          ■
        </button>
        <button onClick={togglePlay} title={playing ? "Pause" : "Play"}
          style={{ padding: "5px 14px", borderRadius: 7, cursor: "pointer", fontFamily: "monospace", fontSize: 11,
            background: playing ? "rgba(255,46,136,0.12)" : "rgba(0,245,255,0.12)",
            border: playing ? "1px solid rgba(255,46,136,0.3)" : "1px solid rgba(0,245,255,0.3)",
            color: playing ? "#FF2E88" : "#00F5FF", fontWeight: 700 }}>
          {playing ? "⏸ PAUSE" : "▶ PLAY"}
        </button>
        <button onClick={() => setLooping(l => !l)} title="Toggle Loop"
          style={{ padding: "5px 10px", borderRadius: 7, cursor: "pointer", fontFamily: "monospace", fontSize: 10,
            background: looping ? "rgba(110,86,255,0.12)" : "rgba(255,255,255,0.04)",
            border: looping ? "1px solid rgba(110,86,255,0.3)" : "1px solid rgba(255,255,255,0.07)",
            color: looping ? "#a78bfa" : "rgba(148,163,184,0.5)" }}>
          ↺ LOOP
        </button>

        <span style={{ fontFamily: "monospace", fontSize: 11, color: "#00F5FF", minWidth: 44, textAlign: "center",
          background: "rgba(0,245,255,0.06)", border: "1px solid rgba(0,245,255,0.15)", borderRadius: 6, padding: "3px 8px" }}>
          {fmtTime(currentTime)}
        </span>

        <div style={{ flex: 1 }} />

        {/* BG color */}
        <label style={{ fontFamily: "monospace", fontSize: 9, color: "rgba(148,163,184,0.5)", letterSpacing: "0.1em", display: "flex", alignItems: "center", gap: 6 }}>
          BG
          <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)}
            style={{ width: 28, height: 22, border: "none", background: "none", cursor: "pointer", borderRadius: 4 }} />
        </label>

        {/* Zoom */}
        <label style={{ fontFamily: "monospace", fontSize: 9, color: "rgba(148,163,184,0.5)", letterSpacing: "0.1em", display: "flex", alignItems: "center", gap: 6 }}>
          ZOOM
          <select value={zoom} onChange={e => setZoom(Number(e.target.value))}
            style={{ background: "rgba(2,6,23,0.9)", border: "1px solid rgba(0,245,255,0.15)", borderRadius: 6,
              color: "#00F5FF", fontFamily: "monospace", fontSize: 10, padding: "2px 6px", cursor: "pointer" }}>
            {[0.5, 0.75, 1, 1.25, 1.5].map(z => <option key={z} value={z}>{Math.round(z * 100)}%</option>)}
          </select>
        </label>

        {selectedId && (
          <button onClick={deleteSelected}
            style={{ padding: "5px 12px", borderRadius: 7, cursor: "pointer", fontFamily: "monospace", fontSize: 10,
              background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}>
            🗑 DELETE
          </button>
        )}
      </div>

      {/* ══ Middle: canvas + properties ══ */}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>

        {/* Layer panel */}
        <div style={{ width: 150, flexShrink: 0, borderRight: "1px solid rgba(0,245,255,0.07)",
          background: "rgba(2,6,23,0.6)", display: "flex", flexDirection: "column", overflowY: "auto" }}>
          <div style={{ padding: "8px 10px", fontFamily: "monospace", fontSize: 8.5,
            letterSpacing: "0.18em", color: "rgba(148,163,184,0.45)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            ◈ LAYERS
          </div>
          {[...objects].reverse().map(obj => (
            <div key={obj.id} onClick={() => setSelectedId(obj.id)}
              style={{ padding: "7px 10px", cursor: "pointer", transition: "background 0.1s",
                background: obj.id === selectedId ? "rgba(0,245,255,0.08)" : "transparent",
                borderBottom: "1px solid rgba(255,255,255,0.03)",
                borderLeft: obj.id === selectedId ? "2px solid #00F5FF" : "2px solid transparent",
                display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ fontSize: 11 }}>
                {obj.type === "rect" ? "▬" : obj.type === "circle" ? "●" : obj.type === "star" ? "★" :
                  obj.type === "triangle" ? "▲" : obj.type === "text" ? "T" : "—"}
              </span>
              <span style={{ fontFamily: "monospace", fontSize: 9, color: obj.id === selectedId ? "#00F5FF" : "rgba(148,163,184,0.6)",
                flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {obj.name}
              </span>
              <button onClick={e => { e.stopPropagation(); updateObj(obj.id, { visible: !obj.visible }); }}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11,
                  color: obj.visible ? "rgba(148,163,184,0.6)" : "rgba(148,163,184,0.2)", padding: 0 }}>
                {obj.visible ? "👁" : "🚫"}
              </button>
            </div>
          ))}
          {objects.length === 0 && (
            <div style={{ padding: 14, fontFamily: "monospace", fontSize: 9, color: "rgba(148,163,184,0.25)", textAlign: "center", lineHeight: 1.6 }}>
              Click a shape tool above to add objects
            </div>
          )}
        </div>

        {/* Canvas workspace */}
        <div style={{ flex: 1, overflow: "auto", display: "flex", alignItems: "center", justifyContent: "center",
          background: "repeating-linear-gradient(45deg,rgba(255,255,255,0.01) 0,rgba(255,255,255,0.01) 1px,transparent 0,transparent 50%)", backgroundSize: "20px 20px" }}>
          <div style={{ transform: `scale(${zoom})`, transformOrigin: "center center", boxShadow: "0 0 60px rgba(0,245,255,0.08), 0 0 0 1px rgba(0,245,255,0.12)" }}>
            <canvas ref={canvasRef} width={canvasW} height={canvasH}
              style={{ display: "block", cursor: tool === "select" ? "default" : "crosshair" }}
              onMouseDown={onCanvasMouseDown}
              onMouseMove={onCanvasMouseMove}
              onMouseUp={onCanvasMouseUp}
            />
          </div>
        </div>

        {/* Properties panel */}
        <div style={{ width: 220, flexShrink: 0, borderLeft: "1px solid rgba(0,245,255,0.07)",
          background: "rgba(2,6,23,0.7)", overflowY: "auto", padding: "0 0 12px 0" }}>
          <div style={{ padding: "8px 12px", fontFamily: "monospace", fontSize: 8.5,
            letterSpacing: "0.18em", color: "rgba(148,163,184,0.45)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            ◈ PROPERTIES
          </div>

          {sel ? (
            <div style={{ padding: "10px 12px" }}>
              {/* Name */}
              <input value={sel.name} onChange={e => updateObj(sel.id, { name: e.target.value })}
                style={{ width: "100%", background: "rgba(2,6,23,0.8)", border: "1px solid rgba(0,245,255,0.15)",
                  borderRadius: 6, color: "#e2e8f0", padding: "5px 8px", fontFamily: "monospace", fontSize: 10,
                  outline: "none", marginBottom: 12, boxSizing: "border-box" }} />

              {/* Transform */}
              <PropSection label="TRANSFORM">
                <PropRow label="X" value={Math.round(sel.x)} onChange={v => updateObj(sel.id, { x: v })} />
                <PropRow label="Y" value={Math.round(sel.y)} onChange={v => updateObj(sel.id, { y: v })} />
                {sel.type !== "line" && <>
                  <PropRow label="W" value={Math.round(sel.w)} onChange={v => updateObj(sel.id, { w: Math.max(10, v) })} />
                  <PropRow label="H" value={Math.round(sel.h)} onChange={v => updateObj(sel.id, { h: Math.max(10, v) })} />
                </>}
                <PropRow label="ROT" value={Math.round(sel.rotation)} onChange={v => updateObj(sel.id, { rotation: v })} unit="°" min={-360} max={360} />
                <PropRow label="OPACITY" value={Math.round(sel.opacity * 100)} onChange={v => updateObj(sel.id, { opacity: v / 100 })} unit="%" min={0} max={100} />
              </PropSection>

              {/* Appearance */}
              <PropSection label="APPEARANCE">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontFamily: "monospace", fontSize: 9, color: "rgba(148,163,184,0.55)" }}>COLOR</span>
                  <input type="color" value={sel.color} onChange={e => updateObj(sel.id, { color: e.target.value })}
                    style={{ width: 36, height: 22, border: "none", background: "none", cursor: "pointer" }} />
                </div>
                {sel.type === "text" && <>
                  <PropRow label="FONT SIZE" value={sel.fontSize || 28} onChange={v => updateObj(sel.id, { fontSize: v })} min={8} max={120} />
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ fontFamily: "monospace", fontSize: 9, color: "rgba(148,163,184,0.55)", display: "block", marginBottom: 4 }}>TEXT CONTENT</label>
                    <input value={sel.text || ""} onChange={e => updateObj(sel.id, { text: e.target.value })}
                      style={{ width: "100%", background: "rgba(2,6,23,0.8)", border: "1px solid rgba(0,245,255,0.15)",
                        borderRadius: 6, color: "#e2e8f0", padding: "4px 8px", fontFamily: "monospace", fontSize: 10,
                        outline: "none", boxSizing: "border-box" }} />
                  </div>
                </>}
                {sel.type === "rect" && (
                  <PropRow label="RADIUS" value={sel.borderRadius || 0} onChange={v => updateObj(sel.id, { borderRadius: v })} min={0} max={60} />
                )}
                {sel.type === "star" && (
                  <PropRow label="POINTS" value={sel.starPoints || 5} onChange={v => updateObj(sel.id, { starPoints: Math.max(3, v) })} min={3} max={12} />
                )}
              </PropSection>

              {/* Keyframes */}
              <PropSection label="KEYFRAMES">
                <button onClick={addKeyframe}
                  style={{ width: "100%", padding: "8px", borderRadius: 7, cursor: "pointer",
                    fontFamily: "monospace", fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase",
                    background: "rgba(0,245,255,0.1)", border: "1px solid rgba(0,245,255,0.3)", color: "#00F5FF",
                    marginBottom: 8 }}>
                  ◆ ADD KEYFRAME @ {fmtTime(currentTime)}
                </button>
                {sel.keyframes.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {sel.keyframes.map((kf, i) => (
                      <button key={i} onClick={() => setCurrentTime(kf.time)}
                        style={{ padding: "3px 7px", borderRadius: 5, cursor: "pointer",
                          fontFamily: "monospace", fontSize: 8.5, background: "rgba(110,86,255,0.12)",
                          border: "1px solid rgba(110,86,255,0.3)", color: "#a78bfa" }}>
                        {kf.time.toFixed(1)}s
                      </button>
                    ))}
                    <button onClick={() => updateObj(sel.id, { keyframes: [] })}
                      style={{ padding: "3px 7px", borderRadius: 5, cursor: "pointer",
                        fontFamily: "monospace", fontSize: 8.5, background: "rgba(239,68,68,0.08)",
                        border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}>
                      CLEAR
                    </button>
                  </div>
                )}
              </PropSection>

              {/* Presets */}
              <PropSection label="ANIMATION PRESETS">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                  {PRESETS.map(p => (
                    <button key={p.id} onClick={() => applyPreset(p)} title={p.desc}
                      style={{ padding: "6px 4px", borderRadius: 6, cursor: "pointer",
                        fontFamily: "monospace", fontSize: 8.5, letterSpacing: "0.08em", textTransform: "uppercase",
                        background: "rgba(110,86,255,0.08)", border: "1px solid rgba(110,86,255,0.2)",
                        color: "#a78bfa", transition: "all 0.12s" }}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </PropSection>
            </div>
          ) : (
            <div style={{ padding: 16, fontFamily: "monospace", fontSize: 9, color: "rgba(148,163,184,0.3)", textAlign: "center", lineHeight: 1.7, marginTop: 20 }}>
              Select an object<br />to edit its properties<br />and keyframes
            </div>
          )}
        </div>
      </div>

      {/* ══ Timeline ══ */}
      <div style={{ height: 160, flexShrink: 0, borderTop: "1px solid rgba(0,245,255,0.08)",
        background: "rgba(2,6,23,0.85)", display: "flex", flexDirection: "column" }}>

        {/* Timeline header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 12px",
          borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          <span style={{ fontFamily: "monospace", fontSize: 8.5, letterSpacing: "0.2em", color: "rgba(148,163,184,0.45)" }}>◈ TIMELINE</span>
          <span style={{ fontFamily: "monospace", fontSize: 9, color: "#00F5FF" }}>{fmtTime(currentTime)} / {DURATION}s</span>
          <div style={{ flex: 1 }} />
          <span style={{ fontFamily: "monospace", fontSize: 8.5, color: "rgba(148,163,184,0.3)" }}>
            {objects.length} object{objects.length !== 1 ? "s" : ""} · {objects.reduce((a, o) => a + o.keyframes.length, 0)} keyframes
          </span>
        </div>

        {/* Scrollable track area */}
        <div style={{ flex: 1, overflowX: "auto", overflowY: "auto", position: "relative" }} ref={timelineRef}>
          <div style={{ minWidth: TOTAL_W + 150, position: "relative" }}>

            {/* Time ruler + scrubber */}
            <div style={{ position: "relative", height: 22, borderBottom: "1px solid rgba(255,255,255,0.05)",
              marginLeft: 120, cursor: "pointer" }}
              onClick={onTimelineScrub} onMouseMove={e => { if (e.buttons) onTimelineScrub(e); }}>
              {Array.from({ length: DURATION + 1 }, (_, i) => (
                <div key={i} style={{ position: "absolute", left: i * PX_PER_SEC, top: 0, bottom: 0,
                  display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ width: 1, height: i % 5 === 0 ? 10 : 5, background: "rgba(148,163,184,0.2)", marginTop: "auto" }} />
                  {i % 2 === 0 && <span style={{ fontFamily: "monospace", fontSize: 7.5, color: "rgba(148,163,184,0.4)", position: "absolute", bottom: 0, transform: "translateX(-50%)" }}>{i}s</span>}
                </div>
              ))}
              {/* Scrubber line */}
              <div style={{ position: "absolute", left: currentTime * PX_PER_SEC, top: 0, bottom: -10000,
                width: 2, background: "#FF2E88", zIndex: 10, pointerEvents: "none",
                boxShadow: "0 0 6px rgba(255,46,136,0.7)" }}>
                <div style={{ width: 10, height: 10, background: "#FF2E88", borderRadius: "50%",
                  position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)" }} />
              </div>
            </div>

            {/* Object tracks */}
            {objects.map(obj => (
              <div key={obj.id} style={{ display: "flex", height: 32, borderBottom: "1px solid rgba(255,255,255,0.03)",
                background: obj.id === selectedId ? "rgba(0,245,255,0.03)" : "transparent" }}>
                {/* Label */}
                <div style={{ width: 120, flexShrink: 0, padding: "0 8px", display: "flex", alignItems: "center",
                  borderRight: "1px solid rgba(255,255,255,0.05)", cursor: "pointer" }}
                  onClick={() => setSelectedId(obj.id)}>
                  <span style={{ fontFamily: "monospace", fontSize: 8.5, overflow: "hidden", textOverflow: "ellipsis",
                    whiteSpace: "nowrap", color: obj.id === selectedId ? "#00F5FF" : "rgba(148,163,184,0.55)" }}>
                    {obj.name}
                  </span>
                </div>
                {/* Track */}
                <div style={{ flex: 1, position: "relative", cursor: "pointer" }}
                  onClick={e => { setSelectedId(obj.id); onTimelineScrub(e); }}>
                  {/* Duration bar */}
                  {obj.keyframes.length >= 2 && (() => {
                    const kfs = [...obj.keyframes].sort((a, b) => a.time - b.time);
                    const left = kfs[0].time * PX_PER_SEC;
                    const right = kfs[kfs.length - 1].time * PX_PER_SEC;
                    return (
                      <div style={{ position: "absolute", left, top: "50%", transform: "translateY(-50%)",
                        width: right - left, height: 4, background: "rgba(0,245,255,0.15)",
                        borderRadius: 4, border: "1px solid rgba(0,245,255,0.2)" }} />
                    );
                  })()}
                  {/* Keyframe diamonds */}
                  {obj.keyframes.map((kf, i) => (
                    <div key={i} onClick={e => { e.stopPropagation(); setCurrentTime(kf.time); setSelectedId(obj.id); }}
                      style={{ position: "absolute", left: kf.time * PX_PER_SEC, top: "50%",
                        transform: "translate(-50%,-50%) rotate(45deg)",
                        width: 9, height: 9,
                        background: obj.id === selectedId ? "#00F5FF" : "#6E56FF",
                        cursor: "pointer", border: "1px solid rgba(0,245,255,0.5)",
                        boxShadow: obj.id === selectedId ? "0 0 6px rgba(0,245,255,0.7)" : "none",
                        zIndex: 2 }}
                      title={`${kf.time.toFixed(2)}s`}
                    />
                  ))}
                </div>
              </div>
            ))}

            {objects.length === 0 && (
              <div style={{ padding: "16px 130px", fontFamily: "monospace", fontSize: 9, color: "rgba(148,163,184,0.2)" }}>
                No objects yet — add shapes using the toolbar above
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); }
        ::-webkit-scrollbar-thumb { background: rgba(0,245,255,0.2); border-radius: 3px; }
      `}</style>
    </div>
  );
}

/* ─── Helper sub-components ─────────────────────────────── */
function PropSection({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontFamily: "monospace", fontSize: 8, letterSpacing: "0.2em",
        color: "rgba(148,163,184,0.4)", textTransform: "uppercase", marginBottom: 7,
        paddingBottom: 4, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function PropRow({ label, value, onChange, unit = "", min = -9999, max = 9999 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
      <span style={{ fontFamily: "monospace", fontSize: 8.5, color: "rgba(148,163,184,0.5)", minWidth: 40 }}>{label}</span>
      <input type="number" value={value} min={min} max={max}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: 70, background: "rgba(2,6,23,0.9)", border: "1px solid rgba(0,245,255,0.12)",
          borderRadius: 5, color: "#e2e8f0", padding: "3px 6px", fontFamily: "monospace", fontSize: 10,
          outline: "none", textAlign: "right" }} />
      {unit && <span style={{ fontFamily: "monospace", fontSize: 8.5, color: "rgba(148,163,184,0.35)", marginLeft: 3 }}>{unit}</span>}
    </div>
  );
}
