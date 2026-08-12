import { useState, useEffect, useRef, useCallback } from "react";
import {
  Mic, MicOff, Volume2, VolumeX, Globe, Languages, Sparkles, ChevronDown,
  RotateCcw, Settings, X, Send, Copy, Download,
  MessageSquare, Radio, Activity, Brain, Info, Check
} from "lucide-react";
import { API } from "../lib/api";
import { toast } from "../components/Toast";
import { speak as ttsSpeak, stopSpeaking as ttsStop, preloadVoices } from "../lib/tts";

// ─── Language Registry ──────────────────────────────────────────────────────
const LANGUAGES = [
  { code: "en-IN", label: "English (India)", short: "EN", flag: "🇮🇳" },
  { code: "en-US", label: "English (US)", short: "EN", flag: "🇺🇸" },
  { code: "hi-IN", label: "हिंदी (Hindi)", short: "HI", flag: "🇮🇳" },
  { code: "ur-PK", label: "اردو (Urdu)", short: "UR", flag: "🇵🇰" },
  { code: "pa-IN", label: "ਪੰਜਾਬੀ (Punjabi)", short: "PA", flag: "🇮🇳" },
  { code: "bn-IN", label: "বাংলা (Bengali)", short: "BN", flag: "🇮🇳" },
  { code: "ta-IN", label: "தமிழ் (Tamil)", short: "TA", flag: "🇮🇳" },
  { code: "te-IN", label: "తెలుగు (Telugu)", short: "TE", flag: "🇮🇳" },
  { code: "mr-IN", label: "मराठी (Marathi)", short: "MR", flag: "🇮🇳" },
  { code: "gu-IN", label: "ગુજરાતી (Gujarati)", short: "GU", flag: "🇮🇳" },
  { code: "kn-IN", label: "ಕನ್ನಡ (Kannada)", short: "KN", flag: "🇮🇳" },
  { code: "ml-IN", label: "മലയാളം (Malayalam)", short: "ML", flag: "🇮🇳" },
  { code: "ja-JP", label: "日本語 (Japanese)", short: "JA", flag: "🇯🇵" },
  { code: "ko-KR", label: "한국어 (Korean)", short: "KO", flag: "🇰🇷" },
  { code: "zh-CN", label: "中文 (Chinese)", short: "ZH", flag: "🇨🇳" },
  { code: "fr-FR", label: "Français (French)", short: "FR", flag: "🇫🇷" },
  { code: "de-DE", label: "Deutsch (German)", short: "DE", flag: "🇩🇪" },
  { code: "es-ES", label: "Español (Spanish)", short: "ES", flag: "🇪🇸" },
  { code: "pt-BR", label: "Português (Portuguese)", short: "PT", flag: "🇧🇷" },
  { code: "ar-SA", label: "العربية (Arabic)", short: "AR", flag: "🇸🇦" },
  { code: "ru-RU", label: "Русский (Russian)", short: "RU", flag: "🇷🇺" },
  { code: "it-IT", label: "Italiano (Italian)", short: "IT", flag: "🇮🇹" },
  { code: "nl-NL", label: "Nederlands (Dutch)", short: "NL", flag: "🇳🇱" },
  { code: "tr-TR", label: "Türkçe (Turkish)", short: "TR", flag: "🇹🇷" },
  { code: "pl-PL", label: "Polski (Polish)", short: "PL", flag: "🇵🇱" },
  { code: "sv-SE", label: "Svenska (Swedish)", short: "SV", flag: "🇸🇪" },
  { code: "th-TH", label: "ภาษาไทย (Thai)", short: "TH", flag: "🇹🇭" },
  { code: "vi-VN", label: "Tiếng Việt (Vietnamese)", short: "VI", flag: "🇻🇳" },
  { code: "id-ID", label: "Bahasa Indonesia", short: "ID", flag: "🇮🇩" },
  { code: "ms-MY", label: "Bahasa Melayu", short: "MS", flag: "🇲🇾" },
];

const VOICE_PERSONAS = [
  { id: "nexus", name: "NEXUS", desc: "Futuristic & precise", gender: "neutral" },
  { id: "aether", name: "AETHER", desc: "Calm & authoritative", gender: "male" },
  { id: "nova", name: "NOVA", desc: "Warm & expressive", gender: "female" },
  { id: "orion", name: "ORION", desc: "Deep & resonant", gender: "male" },
];

const LS_KEY = "nexus_hologram_settings";
const LS_HISTORY_KEY = "nexus_hologram_history";
const WAKE_WORD = "hey nexus";

// ─── Holographic Face Canvas ─────────────────────────────────────────────────
function HologramFace({ speaking, listening, thinking }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const timeRef = useRef(0);
  const blinkRef = useRef(0);
  const mouthRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width = 300;
    const H = canvas.height = 300;
    const cx = W / 2, cy = H / 2;

    const draw = (ts) => {
      timeRef.current = ts / 1000;
      const t = timeRef.current;
      ctx.clearRect(0, 0, W, H);

      // Ambient glow background
      const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 140);
      grad.addColorStop(0, "rgba(0,245,255,0.08)");
      grad.addColorStop(0.5, "rgba(110,86,255,0.05)");
      grad.addColorStop(1, "transparent");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // Outer ring (rotating)
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.3);
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const r = 130;
        const dotX = Math.cos(angle) * r;
        const dotY = Math.sin(angle) * r;
        const pulse = Math.max(0, 0.4 + 0.6 * Math.sin(t * 2 + i * 0.5));
        ctx.beginPath();
        ctx.arc(dotX, dotY, Math.max(0.1, 2.5 * pulse), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,245,255,${0.3 * pulse})`;
        ctx.fill();
      }
      ctx.restore();

      // Inner ring (counter rotating)
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-t * 0.5);
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const r = 110;
        const dotX = Math.cos(angle) * r;
        const dotY = Math.sin(angle) * r;
        ctx.beginPath();
        ctx.arc(dotX, dotY, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(110,86,255,0.5)`;
        ctx.fill();
      }
      ctx.restore();

      // Face oval
      const floatY = Math.sin(t * 0.8) * 4;
      ctx.save();
      ctx.translate(cx, cy + floatY);

      // Face glow
      const faceGrad = ctx.createRadialGradient(0, -10, 20, 0, 0, 75);
      faceGrad.addColorStop(0, "rgba(6,13,34,0.92)");
      faceGrad.addColorStop(0.7, "rgba(6,13,34,0.88)");
      faceGrad.addColorStop(1, "rgba(0,245,255,0.15)");
      ctx.beginPath();
      ctx.ellipse(0, 0, 72, 88, 0, 0, Math.PI * 2);
      ctx.fillStyle = faceGrad;
      ctx.fill();
      ctx.strokeStyle = "rgba(0,245,255,0.4)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Thinking shimmer
      if (thinking) {
        const shimmer = (Math.sin(t * 6) + 1) / 2;
        ctx.strokeStyle = `rgba(110,86,255,${0.3 + shimmer * 0.5})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, 74, 90, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Eyes
      const eyeY = -22;
      const eyeGap = 22;
      blinkRef.current += 0.016;
      const blink = blinkRef.current > 3.5 ? Math.max(0, 1 - (blinkRef.current - 3.5) * 8) : 1;
      if (blinkRef.current > 3.7) blinkRef.current = 0;

      [{ x: -eyeGap }, { x: eyeGap }].forEach(({ x }) => {
        // Eye socket
        const eyeGrad = ctx.createRadialGradient(x, eyeY, 1, x, eyeY, 12);
        eyeGrad.addColorStop(0, "rgba(0,245,255,0.9)");
        eyeGrad.addColorStop(0.4, "rgba(0,245,255,0.4)");
        eyeGrad.addColorStop(1, "rgba(0,245,255,0.05)");

        ctx.save();
        ctx.scale(1, blink || 0.05);
        ctx.beginPath();
        ctx.ellipse(x, eyeY / (blink || 0.05), 11, 11, 0, 0, Math.PI * 2);
        ctx.fillStyle = eyeGrad;
        ctx.fill();
        ctx.restore();

        // Pupil
        if (blink > 0.3) {
          const lookX = x + Math.sin(t * 0.6) * 2;
          const lookY = eyeY + Math.cos(t * 0.4) * 1.5;
          ctx.beginPath();
          ctx.arc(lookX, lookY, 4, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(0,20,40,0.95)";
          ctx.fill();
          ctx.beginPath();
          ctx.arc(lookX + 1.5, lookY - 1.5, 1.5, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255,255,255,0.8)";
          ctx.fill();
        }

        // Listening glow around eyes
        if (listening) {
          const lp = (Math.sin(t * 8) + 1) / 2;
          ctx.beginPath();
          ctx.ellipse(x, eyeY, 14, 14, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(0,255,136,${0.3 + lp * 0.5})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      });

      // Nose bridge (subtle)
      ctx.beginPath();
      ctx.moveTo(-4, -5);
      ctx.quadraticCurveTo(0, 5, 4, 8);
      ctx.strokeStyle = "rgba(0,245,255,0.15)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Mouth
      const mouthY = 28;
      if (speaking) {
        mouthRef.current += 0.18;
        const openness = Math.abs(Math.sin(mouthRef.current)) * 14;
        // Upper lip
        ctx.beginPath();
        ctx.moveTo(-20, mouthY);
        ctx.quadraticCurveTo(0, mouthY - 6, 20, mouthY);
        ctx.strokeStyle = "rgba(0,245,255,0.7)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // Lower lip
        ctx.beginPath();
        ctx.moveTo(-18, mouthY + 2);
        ctx.quadraticCurveTo(0, mouthY + 4 + openness, 18, mouthY + 2);
        ctx.strokeStyle = "rgba(0,245,255,0.7)";
        ctx.stroke();
        // Inner mouth glow
        if (openness > 4) {
          ctx.beginPath();
          ctx.ellipse(0, mouthY + 4, 14, Math.max(0.1, openness * 0.5), 0, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(0,245,255,${openness / 40})`;
          ctx.fill();
        }
      } else {
        // Neutral smile
        const smileAmt = listening ? 0.15 : 0.05;
        ctx.beginPath();
        ctx.moveTo(-18, mouthY);
        ctx.quadraticCurveTo(0, mouthY + smileAmt * 80, 18, mouthY);
        ctx.strokeStyle = "rgba(0,245,255,0.5)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Cheek circuit lines
      [[-1, 1], [1, 1]].forEach(([sx]) => {
        const startX = sx * 55, startY = 10;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(startX + sx * 10, startY);
        ctx.lineTo(startX + sx * 10, startY + 15);
        ctx.lineTo(startX + sx * 18, startY + 15);
        ctx.strokeStyle = `rgba(0,245,255,${0.12 + 0.08 * Math.sin(t * 3)})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();

        // Junction dot
        ctx.beginPath();
        ctx.arc(startX + sx * 18, startY + 15, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,245,255,0.3)`;
        ctx.fill();
      });

      // Data stream lines (forehead)
      for (let i = 0; i < 3; i++) {
        const progress = ((t * 0.5 + i * 0.33) % 1);
        const lineX = -30 + i * 30;
        const lineYStart = -75;
        const lineYEnd = -55;
        const dotY2 = lineYStart + (lineYEnd - lineYStart) * progress;
        ctx.beginPath();
        ctx.moveTo(lineX, lineYStart);
        ctx.lineTo(lineX, lineYEnd);
        ctx.strokeStyle = "rgba(0,245,255,0.08)";
        ctx.lineWidth = 0.8;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(lineX, dotY2, 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,245,255,${0.6 - progress * 0.5})`;
        ctx.fill();
      }

      ctx.restore();

      // Scan line
      const scanY = ((t * 60) % (H + 20)) - 10;
      const scanGrad = ctx.createLinearGradient(0, scanY - 6, 0, scanY + 6);
      scanGrad.addColorStop(0, "transparent");
      scanGrad.addColorStop(0.5, "rgba(0,245,255,0.08)");
      scanGrad.addColorStop(1, "transparent");
      ctx.fillStyle = scanGrad;
      ctx.fillRect(0, scanY - 6, W, 12);

      // Status indicator (bottom of face)
      const statusColor = thinking ? "#6E56FF" : listening ? "#00FF88" : speaking ? "#FF2E88" : "#00F5FF";
      ctx.beginPath();
      ctx.arc(cx, cy + floatY + 96, 5, 0, Math.PI * 2);
      ctx.fillStyle = statusColor;
      ctx.shadowColor = statusColor;
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [speaking, listening, thinking]);

  return (
    <canvas
      ref={canvasRef}
      width={300}
      height={300}
      style={{ display: "block", margin: "0 auto" }}
    />
  );
}

// ─── Sound Wave Visualizer ────────────────────────────────────────────────────
function SoundWave({ active, color = "#00F5FF", bars = 28 }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const tRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width = canvas.offsetWidth * 2;
    const H = canvas.height = 48;

    const draw = (ts) => {
      tRef.current = ts / 1000;
      const t = tRef.current;
      ctx.clearRect(0, 0, W, H);

      const gap = W / bars;
      for (let i = 0; i < bars; i++) {
        const base = active
          ? Math.abs(Math.sin(t * 4 + i * 0.4)) * 0.7 + Math.abs(Math.sin(t * 7 + i * 0.25)) * 0.3
          : Math.abs(Math.sin(t * 1.2 + i * 0.3)) * 0.12 + 0.05;

        const barH = base * (H - 8) + 4;
        const x = i * gap + gap * 0.2;
        const y = (H - barH) / 2;
        const barW = gap * 0.55;

        const grad = ctx.createLinearGradient(x, y, x, y + barH);
        grad.addColorStop(0, active ? color.replace(")", ",0.9)").replace("rgb", "rgba") : `${color}33`);
        grad.addColorStop(1, `${color}11`);

        ctx.fillStyle = active ? color + "cc" : color + "33";
        ctx.beginPath();
        ctx.roundRect(x, y, barW, barH, 2);
        ctx.fill();
      }
      animRef.current = requestAnimationFrame(draw);
    };
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [active, color, bars]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: 48, display: "block" }}
    />
  );
}

// ─── Language Selector ────────────────────────────────────────────────────────
function LangSelector({ value, onChange, label }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);
  const current = LANGUAGES.find(l => l.code === value) || LANGUAGES[0];
  const filtered = LANGUAGES.filter(l =>
    l.label.toLowerCase().includes(search.toLowerCase()) ||
    l.short.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {label && <div className="hud-label" style={{ marginBottom: 4, fontSize: "0.55rem" }}>{label}</div>}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 6, padding: "6px 10px",
          background: "rgba(0,245,255,0.06)", border: "1px solid rgba(0,245,255,0.2)",
          borderRadius: 8, color: "#00F5FF", cursor: "pointer", fontSize: 11, fontFamily: "monospace",
          width: "100%", justifyContent: "space-between"
        }}
      >
        <span>{current.flag} {current.short}</span>
        <ChevronDown style={{ width: 11, height: 11, opacity: 0.6 }} />
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 99,
          background: "rgba(6,13,34,0.98)", border: "1px solid rgba(0,245,255,0.2)",
          borderRadius: 10, padding: 6, minWidth: 200, backdropFilter: "blur(20px)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)"
        }}>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search language…"
            autoFocus
            style={{
              width: "100%", padding: "6px 10px", background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(0,245,255,0.15)", borderRadius: 6, color: "#fff",
              fontSize: 11, fontFamily: "monospace", outline: "none", marginBottom: 4
            }}
          />
          <div style={{ maxHeight: 200, overflowY: "auto" }}>
            {filtered.map(l => (
              <button key={l.code} onClick={() => { onChange(l.code); setOpen(false); setSearch(""); }}
                style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "6px 8px",
                  borderRadius: 6, width: "100%", textAlign: "left", border: "none",
                  background: l.code === value ? "rgba(0,245,255,0.12)" : "transparent",
                  color: l.code === value ? "#00F5FF" : "rgba(200,220,240,0.85)",
                  fontSize: 11, fontFamily: "monospace", cursor: "pointer"
                }}
              >
                <span>{l.flag}</span>
                <span style={{ flex: 1 }}>{l.label}</span>
                {l.code === value && <Check style={{ width: 10, height: 10 }} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function NexusHologram() {
  // Settings
  const [settings, setSettings] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY) || "{}");
    } catch { return {}; }
  });
  const lang = settings.lang || "en-IN";
  const voicePersona = settings.voicePersona || "nexus";
  const speechRate = settings.speechRate ?? 1.0;
  const speechPitch = settings.speechPitch ?? 1.0;
  const memoryEnabled = settings.memoryEnabled ?? true;
  const ttsEnabled = settings.ttsEnabled ?? true;

  const saveSettings = useCallback((patch) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  // Conversation
  const [messages, setMessages] = useState(() => {
    try {
      const hist = JSON.parse(localStorage.getItem(LS_HISTORY_KEY) || "[]");
      return Array.isArray(hist) ? hist.slice(-40) : [];
    } catch { return []; }
  });
  const addMessage = useCallback((msg) => {
    setMessages(prev => {
      const next = [...prev, { ...msg, id: Date.now() + Math.random(), ts: Date.now() }];
      if (memoryEnabled) {
        try { localStorage.setItem(LS_HISTORY_KEY, JSON.stringify(next.slice(-40))); } catch {}
      }
      return next;
    });
  }, [memoryEnabled]);
  const clearHistory = () => {
    setMessages([]);
    try { localStorage.removeItem(LS_HISTORY_KEY); } catch {}
    toast.success("Conversation cleared");
  };

  // Voice & UI states
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [textInput, setTextInput] = useState("");
  const [muted, setMuted] = useState(false);
  const [wakeWordReady, setWakeWordReady] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTranslate, setShowTranslate] = useState(false);
  const [translateText, setTranslateText] = useState("");
  const [translateResult, setTranslateResult] = useState("");
  const [translateTarget, setTranslateTarget] = useState("hi-IN");
  const [translating, setTranslating] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");

  const recogRef = useRef(null);
  const chatBottomRef = useRef(null);
  const sessionId = useRef(`hologram-${Date.now()}`);
  const abortRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);

  // Stale closure guards for voice recognition
  const listeningRef = useRef(listening);
  useEffect(() => { listeningRef.current = listening; }, [listening]);

  const wakeWordReadyRef = useRef(wakeWordReady);
  useEffect(() => { wakeWordReadyRef.current = wakeWordReady; }, [wakeWordReady]);

  const wakeRecogRef = useRef(null);
  const startListeningRef = useRef(null);

  // Preload voices so they're ready before first Speak
  useEffect(() => { preloadVoices(); }, []);

  // ── Wake word background listener ──────────────────────────────────────────
  useEffect(() => {
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const wake = new SR();
    wake.continuous = true;
    wake.interimResults = true;
    wake.lang = "en-US";

    wake.onresult = (e) => {
      const all = Array.from(e.results).map(r => r[0].transcript.toLowerCase()).join(" ");
      if (all.includes(WAKE_WORD) && !listeningRef.current) {
        toast.info("🎙 Hey Nexus detected!");
        if (startListeningRef.current) {
          startListeningRef.current();
        }
      }
    };
    wake.onerror = () => {};
    wake.onend = () => {
      if (wakeWordReadyRef.current) {
        try { wake.start(); } catch {}
      }
    };

    wakeRecogRef.current = wake;
    setWakeWordReady(true);
    wakeWordReadyRef.current = true;
    try { wake.start(); } catch {}
    return () => {
      wakeWordReadyRef.current = false;
      try { wake.stop(); } catch {}
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-scroll chat ───────────────────────────────────────────────────────
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  // ── Speak via TTS ──────────────────────────────────────────────────────────
  const speak = useCallback((text, langCode = lang) => {
    if (muted || !ttsEnabled) return;
    synthRef.current?.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = langCode;
    utter.rate = speechRate;
    utter.pitch = speechPitch;

    const voices = synthRef.current?.getVoices() || [];
    // Try to find voice matching language
    const matchVoice = voices.find(v => v.lang.startsWith(langCode.split("-")[0])) ||
                       voices.find(v => v.lang.startsWith("en"));
    if (matchVoice) utter.voice = matchVoice;

    utter.onstart = () => setSpeaking(true);
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    synthRef.current?.speak(utter);
  }, [lang, muted, ttsEnabled, speechRate, speechPitch]);

  // ── AI response (streaming) ────────────────────────────────────────────────
  const sendToAI = useCallback(async (userText, langCode = lang) => {
    if (!userText.trim()) return;
    const langLabel = LANGUAGES.find(l => l.code === langCode)?.label || "English";

    addMessage({ role: "user", text: userText, lang: langCode });
    setThinking(true);
    setStreaming(true);
    setStreamingContent("");

    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    try {
      const systemPrompt = `You are NEXUS — a next-generation multilingual AI assistant embedded in the NEXUS AI Operating System. 
You speak natively in ${langLabel}. You are intelligent, futuristic, warm yet precise.
Always respond in the SAME language the user spoke in: ${langLabel} (${langCode}).
Keep responses conversational and concise (2-4 sentences unless asked for detail).
You have a vast knowledge base and can discuss technology, science, culture, and more.`;

      const history = messages.slice(-10).map(m => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.text
      }));

      const res = await fetch(`${API}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId.current,
          agent: "nexus_hologram",
          message: userText,
          system_override: systemPrompt,
          history,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) throw new Error("Stream error");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let fullResponse = "";

      setThinking(false);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() || "";
        for (const p of parts) {
          const line = p.trim();
          if (!line.startsWith("data:")) continue;
          try {
            const evt = JSON.parse(line.slice(5).trim());
            if (evt.type === "delta") {
              fullResponse += evt.content;
              setStreamingContent(fullResponse);
            }
          } catch {}
        }
      }

      setStreaming(false);
      setStreamingContent("");
      const finalText = fullResponse || "I'm processing your request. Please try again.";
      addMessage({ role: "assistant", text: finalText, lang: langCode });
      speak(finalText, langCode);
    } catch (err) {
      setThinking(false);
      setStreaming(false);
      setStreamingContent("");
      if (err.name !== "AbortError") {
        const fallback = "I encountered an issue connecting to the AI core. Please check your connection.";
        addMessage({ role: "assistant", text: fallback, lang: langCode });
        speak(fallback);
      }
    }
  }, [lang, messages, addMessage, speak]);

  // ── STT: Start listening ───────────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
      toast.error("Speech Recognition not supported in this browser");
      return;
    }

    // Stop wake word listener before starting voice query session
    setWakeWordReady(false);
    wakeWordReadyRef.current = false;
    if (wakeRecogRef.current) {
      try { wakeRecogRef.current.stop(); } catch {}
    }

    if (recogRef.current) { try { recogRef.current.stop(); } catch {} }
    synthRef.current?.cancel();

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recog = new SR();
    recog.lang = lang;
    recog.continuous = false;
    recog.interimResults = true;
    recog.maxAlternatives = 1;

    // Local var — avoids stale `transcript` closure captured at useCallback creation time
    let capturedTranscript = "";

    recog.onstart = () => { setListening(true); setTranscript(""); setInterimTranscript(""); capturedTranscript = ""; };
    recog.onresult = (e) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      setInterimTranscript(interim);
      if (final) {
        capturedTranscript = final; // capture synchronously — reliable in onend
        setTranscript(final);
        setInterimTranscript("");
      } else if (interim) {
        // Fallback: save interim transcript in case session ends without final confirmation
        capturedTranscript = interim;
      }
    };
    recog.onend = () => {
      setListening(false);
      const spoken = capturedTranscript.trim(); // always current — no stale closure
      if (spoken) sendToAI(spoken, lang);

      // Re-enable and restart wake word listener
      setWakeWordReady(true);
      wakeWordReadyRef.current = true;
      if (wakeRecogRef.current) {
        try { wakeRecogRef.current.start(); } catch {}
      }
    };
    recog.onerror = (e) => {
      setListening(false);
      if (e.error !== "no-speech" && e.error !== "aborted") {
        toast.error(`Mic error: ${e.error}`);
      }

      // Re-enable and restart wake word listener
      setWakeWordReady(true);
      wakeWordReadyRef.current = true;
      if (wakeRecogRef.current) {
        try { wakeRecogRef.current.start(); } catch {}
      }
    };
    // Note: Do not call recog.stop() inside onspeechend.
    // For continuous=false mode, the browser's SpeechRecognition API automatically handles silence detection 
    // and naturally terminates via onend. Forcing stop() in onspeechend immediately halts audio capture 
    // and terminates the session prematurely before the last voice buffers have been compiled, causing blank responses.
    recog.onspeechend = () => {
      // Allow the API to resolve the final results natively
    };

    recogRef.current = recog;
    try { recog.start(); } catch (err) { toast.error("Could not start microphone"); }
  }, [lang, sendToAI]);

  // Keep startListeningRef updated
  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  const stopListening = useCallback(() => {
    try { recogRef.current?.stop(); } catch {}
    setListening(false);
  }, []);

  const stopSpeaking = useCallback(() => {
    ttsStop();
    setSpeaking(false);
  }, []);

  // ── Text submit ────────────────────────────────────────────────────────────
  const handleTextSend = () => {
    if (!textInput.trim() || streaming || thinking) return;
    const txt = textInput.trim();
    setTextInput("");
    sendToAI(txt, lang);
  };

  // ── Translation ────────────────────────────────────────────────────────────
  const handleTranslate = async () => {
    if (!translateText.trim()) return;
    setTranslating(true);
    setTranslateResult("");
    try {
      const targetLangCode = translateTarget.split("-")[0];
      const res = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(translateText)}&langpair=auto|${targetLangCode}`
      );
      const data = await res.json();
      if (data?.responseData?.translatedText) {
        setTranslateResult(data.responseData.translatedText);
      } else {
        setTranslateResult("Translation unavailable. Please try again.");
      }
    } catch {
      setTranslateResult("Translation service unavailable.");
    }
    setTranslating(false);
  };

  // ── Export conversation ────────────────────────────────────────────────────
  const exportConversation = () => {
    const text = messages.map(m =>
      `[${new Date(m.ts).toLocaleTimeString()}] ${m.role === "user" ? "YOU" : "NEXUS"}: ${m.text}`
    ).join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "nexus-conversation.txt"; a.click();
    URL.revokeObjectURL(url);
    toast.success("Conversation exported");
  };

  const currentLang = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];
  const STT_SUPPORTED = !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20, height: "calc(100vh - 100px)", minHeight: 600 }}>

      {/* ── LEFT: Hologram Panel ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Face */}
        <div className="nx-glass" style={{
          borderRadius: 20, padding: "20px 16px 14px", textAlign: "center",
          position: "relative", overflow: "hidden",
          background: "rgba(2,6,23,0.85)",
          border: `1px solid ${listening ? "rgba(0,255,136,0.4)" : speaking ? "rgba(255,46,136,0.35)" : thinking ? "rgba(110,86,255,0.4)" : "rgba(0,245,255,0.22)"}`,
          boxShadow: listening ? "0 0 30px rgba(0,255,136,0.15)" : speaking ? "0 0 30px rgba(255,46,136,0.15)" : "0 0 24px rgba(0,245,255,0.08)",
          transition: "all 0.4s ease"
        }}>
          {/* Header HUD */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div className="hud-label" style={{ fontSize: "0.55rem" }}>NEXUS · HOLOGRAM</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="nx-pulse" style={{ width: 5, height: 5, borderRadius: "50%", background: thinking ? "#6E56FF" : listening ? "#00FF88" : speaking ? "#FF2E88" : "#00F5FF", display: "inline-block" }} />
              <span style={{ fontSize: 9, fontFamily: "monospace", color: thinking ? "#6E56FF" : listening ? "#00FF88" : speaking ? "#FF2E88" : "#00F5FF" }}>
                {thinking ? "PROCESSING" : listening ? "LISTENING" : speaking ? "SPEAKING" : "STANDBY"}
              </span>
            </div>
          </div>

          <HologramFace speaking={speaking} listening={listening} thinking={thinking} />

          {/* Language indicator */}
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Globe style={{ width: 10, height: 10, color: "#00F5FF" }} />
            <span style={{ fontSize: 10, fontFamily: "monospace", color: "rgba(0,245,255,0.7)" }}>
              {currentLang.flag} {currentLang.short} · {currentLang.label.split("(")[1]?.replace(")", "") || "English"}
            </span>
          </div>

          {/* Scan line overlay */}
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,245,255,0.012) 2px, rgba(0,245,255,0.012) 4px)"
          }} />
        </div>

        {/* Sound Wave */}
        <div className="nx-glass" style={{ borderRadius: 14, padding: "10px 14px" }}>
          <div className="hud-label" style={{ marginBottom: 6, fontSize: "0.55rem" }}>AUDIO WAVEFORM</div>
          <SoundWave
            active={listening || speaking}
            color={listening ? "#00FF88" : speaking ? "#FF2E88" : "#00F5FF"}
          />
        </div>

        {/* Controls */}
        <div className="nx-glass" style={{ borderRadius: 14, padding: 14 }}>
          <div className="hud-label" style={{ marginBottom: 10, fontSize: "0.55rem" }}>VOICE CONTROLS</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
            {/* Main mic button */}
            <button
              onClick={listening ? stopListening : startListening}
              disabled={!STT_SUPPORTED || thinking || streaming}
              style={{
                gridColumn: "1 / -1",
                padding: "12px", borderRadius: 12, cursor: "pointer",
                background: listening
                  ? "linear-gradient(135deg, rgba(0,255,136,0.25), rgba(0,255,136,0.12))"
                  : "linear-gradient(135deg, rgba(0,245,255,0.18), rgba(0,245,255,0.08))",
                border: `1px solid ${listening ? "rgba(0,255,136,0.5)" : "rgba(0,245,255,0.3)"}`,
                color: listening ? "#00FF88" : "#00F5FF",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                fontFamily: "monospace", fontSize: 12, fontWeight: 700,
                boxShadow: listening ? "0 0 20px rgba(0,255,136,0.3)" : "0 0 12px rgba(0,245,255,0.1)",
                transition: "all 0.2s", letterSpacing: "0.1em",
                opacity: (!STT_SUPPORTED || thinking || streaming) ? 0.4 : 1,
                animation: listening ? "pulse-loc 1.2s ease-in-out infinite" : "none"
              }}
            >
              {listening ? <MicOff style={{ width: 16, height: 16 }} /> : <Mic style={{ width: 16, height: 16 }} />}
              {listening ? "STOP LISTENING" : "START VOICE"}
            </button>

            <button onClick={() => { setMuted(m => !m); stopSpeaking(); }}
              style={{
                padding: "9px", borderRadius: 10, border: `1px solid ${muted ? "rgba(255,199,87,0.3)" : "rgba(0,245,255,0.15)"}`,
                background: muted ? "rgba(255,199,87,0.1)" : "rgba(0,245,255,0.05)",
                color: muted ? "#FFC857" : "rgba(148,163,184,0.7)", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6, fontSize: 10, fontFamily: "monospace"
              }}
            >
              {muted ? <VolumeX style={{ width: 12, height: 12 }} /> : <Volume2 style={{ width: 12, height: 12 }} />}
              {muted ? "MUTED" : "SOUND"}
            </button>

            <button onClick={() => setShowSettings(s => !s)}
              style={{
                padding: "9px", borderRadius: 10, border: `1px solid ${showSettings ? "rgba(110,86,255,0.4)" : "rgba(0,245,255,0.15)"}`,
                background: showSettings ? "rgba(110,86,255,0.1)" : "rgba(0,245,255,0.05)",
                color: showSettings ? "#6E56FF" : "rgba(148,163,184,0.7)", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6, fontSize: 10, fontFamily: "monospace"
              }}
            >
              <Settings style={{ width: 12, height: 12 }} /> CONFIG
            </button>
          </div>

          {/* Language selector */}
          <LangSelector value={lang} onChange={v => saveSettings({ lang: v })} label="CONVERSATION LANGUAGE" />

          {!STT_SUPPORTED && (
            <div style={{ marginTop: 8, padding: "6px 10px", borderRadius: 6, background: "rgba(255,199,87,0.08)", border: "1px solid rgba(255,199,87,0.2)", fontSize: 10, fontFamily: "monospace", color: "#FFC857" }}>
              <Info style={{ width: 10, height: 10, display: "inline", marginRight: 4 }} />
              Voice requires Chrome/Edge
            </div>
          )}
        </div>

        {/* Wake word indicator */}
        <div style={{
          padding: "8px 14px", borderRadius: 10,
          background: "rgba(0,245,255,0.04)", border: "1px solid rgba(0,245,255,0.1)",
          display: "flex", alignItems: "center", gap: 8
        }}>
          <Radio style={{ width: 11, height: 11, color: wakeWordReady ? "#00FF88" : "#94a3b8" }} />
          <span style={{ fontSize: 10, fontFamily: "monospace", color: wakeWordReady ? "#00FF88" : "rgba(148,163,184,0.5)" }}>
            {wakeWordReady ? "Say \"Hey Nexus\" to activate" : "Wake word unavailable"}
          </span>
        </div>
      </div>

      {/* ── RIGHT: Conversation + Panels ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14, minHeight: 0 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div className="hud-label" style={{ marginBottom: 3 }}>MULTILINGUAL ENGINE</div>
            <h1 className="font-display nx-neon-cyan" style={{ fontSize: 24, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
              <Sparkles style={{ width: 20, height: 20, color: "#00F5FF" }} />
              Nexus Hologram
            </h1>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setShowTranslate(t => !t)}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8,
                background: showTranslate ? "rgba(110,86,255,0.15)" : "rgba(0,245,255,0.06)",
                border: `1px solid ${showTranslate ? "rgba(110,86,255,0.4)" : "rgba(0,245,255,0.2)"}`,
                color: showTranslate ? "#6E56FF" : "#00F5FF", cursor: "pointer", fontSize: 11, fontFamily: "monospace"
              }}
            >
              <Languages style={{ width: 13, height: 13 }} /> TRANSLATE
            </button>
            <button onClick={exportConversation}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8,
                background: "rgba(0,255,136,0.06)", border: "1px solid rgba(0,255,136,0.2)",
                color: "#00FF88", cursor: "pointer", fontSize: 11, fontFamily: "monospace"
              }}
            >
              <Download style={{ width: 13, height: 13 }} /> EXPORT
            </button>
            <button onClick={clearHistory}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8,
                background: "rgba(255,75,75,0.06)", border: "1px solid rgba(255,75,75,0.2)",
                color: "#FF4D4D", cursor: "pointer", fontSize: 11, fontFamily: "monospace"
              }}
            >
              <RotateCcw style={{ width: 13, height: 13 }} /> CLEAR
            </button>
          </div>
        </div>

        {/* Translation Panel */}
        {showTranslate && (
          <div className="nx-glass" style={{ borderRadius: 14, padding: 16, border: "1px solid rgba(110,86,255,0.3)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Languages style={{ width: 14, height: 14, color: "#6E56FF" }} />
                <span className="hud-label" style={{ color: "#6E56FF" }}>INSTANT TRANSLATION</span>
              </div>
              <button onClick={() => setShowTranslate(false)} style={{ background: "none", border: "none", color: "rgba(148,163,184,0.5)", cursor: "pointer" }}>
                <X style={{ width: 14, height: 14 }} />
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 10, alignItems: "start" }}>
              <div>
                <div className="hud-label" style={{ marginBottom: 4, fontSize: "0.55rem" }}>SOURCE TEXT</div>
                <textarea
                  value={translateText} onChange={e => setTranslateText(e.target.value)}
                  placeholder="Enter text to translate…"
                  rows={3}
                  style={{
                    width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff",
                    fontSize: 12, fontFamily: "monospace", outline: "none", resize: "none"
                  }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, paddingTop: 20 }}>
                <LangSelector value={translateTarget} onChange={setTranslateTarget} label="TO" />
                <button onClick={handleTranslate} disabled={translating || !translateText.trim()}
                  style={{
                    padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(110,86,255,0.4)",
                    background: "rgba(110,86,255,0.15)", color: "#6E56FF", cursor: "pointer",
                    fontSize: 11, fontFamily: "monospace", opacity: translating ? 0.5 : 1
                  }}
                >
                  {translating ? "…" : "TRANSLATE"}
                </button>
              </div>
              <div>
                <div className="hud-label" style={{ marginBottom: 4, fontSize: "0.55rem" }}>TRANSLATION</div>
                <div style={{
                  minHeight: 72, padding: "8px 10px", background: "rgba(110,86,255,0.06)",
                  border: "1px solid rgba(110,86,255,0.2)", borderRadius: 8,
                  fontSize: 12, fontFamily: "monospace", color: "#c4b5fd", lineHeight: 1.5
                }}>
                  {translateResult || <span style={{ color: "rgba(148,163,184,0.3)" }}>Translation appears here…</span>}
                </div>
                {translateResult && (
                  <button
                    onClick={() => { speak(translateResult, translateTarget); }}
                    style={{
                      marginTop: 6, display: "flex", alignItems: "center", gap: 5,
                      background: "none", border: "1px solid rgba(110,86,255,0.2)", borderRadius: 6,
                      padding: "4px 10px", color: "#6E56FF", cursor: "pointer", fontSize: 10, fontFamily: "monospace"
                    }}
                  >
                    <Volume2 style={{ width: 10, height: 10 }} /> SPEAK
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Settings Panel */}
        {showSettings && (
          <div className="nx-glass" style={{ borderRadius: 14, padding: 16, border: "1px solid rgba(110,86,255,0.3)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Settings style={{ width: 14, height: 14, color: "#6E56FF" }} />
                <span className="hud-label" style={{ color: "#6E56FF" }}>HOLOGRAM CONFIGURATION</span>
              </div>
              <button onClick={() => setShowSettings(false)} style={{ background: "none", border: "none", color: "rgba(148,163,184,0.5)", cursor: "pointer" }}>
                <X style={{ width: 14, height: 14 }} />
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              {/* TTS Speed */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span className="hud-label" style={{ fontSize: "0.55rem" }}>SPEECH RATE</span>
                  <span style={{ fontSize: 10, fontFamily: "monospace", color: "#00F5FF" }}>{speechRate.toFixed(1)}x</span>
                </div>
                <input type="range" min="0.5" max="2.0" step="0.1" value={speechRate}
                  onChange={e => saveSettings({ speechRate: +e.target.value })}
                  style={{ width: "100%", accentColor: "#00F5FF" }}
                />
              </div>
              {/* TTS Pitch */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span className="hud-label" style={{ fontSize: "0.55rem" }}>PITCH</span>
                  <span style={{ fontSize: 10, fontFamily: "monospace", color: "#6E56FF" }}>{speechPitch.toFixed(1)}</span>
                </div>
                <input type="range" min="0.5" max="2.0" step="0.1" value={speechPitch}
                  onChange={e => saveSettings({ speechPitch: +e.target.value })}
                  style={{ width: "100%", accentColor: "#6E56FF" }}
                />
              </div>
              {/* Toggles */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 10, fontFamily: "monospace" }}>
                  <input type="checkbox" checked={ttsEnabled} onChange={e => saveSettings({ ttsEnabled: e.target.checked })} style={{ accentColor: "#00F5FF" }} />
                  VOICE RESPONSE
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 10, fontFamily: "monospace" }}>
                  <input type="checkbox" checked={memoryEnabled} onChange={e => saveSettings({ memoryEnabled: e.target.checked })} style={{ accentColor: "#00F5FF" }} />
                  MEMORY (PERSIST)
                </label>
              </div>
            </div>
            {/* Voice persona */}
            <div style={{ marginTop: 14 }}>
              <div className="hud-label" style={{ marginBottom: 8, fontSize: "0.55rem" }}>AI VOICE PERSONA</div>
              <div style={{ display: "flex", gap: 8 }}>
                {VOICE_PERSONAS.map(p => (
                  <button key={p.id} onClick={() => saveSettings({ voicePersona: p.id })}
                    style={{
                      flex: 1, padding: "8px 4px", borderRadius: 10, border: `1px solid ${voicePersona === p.id ? "rgba(0,245,255,0.5)" : "rgba(255,255,255,0.1)"}`,
                      background: voicePersona === p.id ? "rgba(0,245,255,0.1)" : "rgba(255,255,255,0.03)",
                      color: voicePersona === p.id ? "#00F5FF" : "rgba(148,163,184,0.6)",
                      cursor: "pointer", fontSize: 10, fontFamily: "monospace"
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>{p.name}</div>
                    <div style={{ fontSize: 8, opacity: 0.6, marginTop: 2 }}>{p.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Conversation Timeline */}
        <div className="nx-glass" style={{
          borderRadius: 16, flex: 1, display: "flex", flexDirection: "column",
          overflow: "hidden", minHeight: 0
        }}>
          {/* Chat header */}
          <div style={{
            padding: "10px 16px", borderBottom: "1px solid rgba(0,245,255,0.1)",
            display: "flex", alignItems: "center", gap: 8, flexShrink: 0
          }}>
            <MessageSquare style={{ width: 13, height: 13, color: "#00F5FF" }} />
            <span className="hud-label" style={{ fontSize: "0.55rem" }}>CONVERSATION TIMELINE</span>
            <span style={{ marginLeft: "auto", fontSize: 10, fontFamily: "monospace", color: "rgba(148,163,184,0.4)" }}>
              {messages.length} messages
            </span>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
            {messages.length === 0 && !streaming && (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🌐</div>
                <div className="font-display" style={{ fontSize: 15, color: "rgba(0,245,255,0.7)", marginBottom: 6 }}>
                  Multilingual AI Active
                </div>
                <div style={{ fontSize: 11, fontFamily: "monospace", color: "rgba(148,163,184,0.4)", lineHeight: 1.7, maxWidth: 300, margin: "0 auto" }}>
                  Speak or type in any of 30+ supported languages.<br />
                  Say <strong style={{ color: "#00F5FF" }}>"Hey Nexus"</strong> to start with voice.
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginTop: 16 }}>
                  {["What can you do?", "नमस्ते, आप कैसे हैं?", "Bonjour, comment ça va?", "こんにちは！"].map(s => (
                    <button key={s} onClick={() => sendToAI(s, lang)}
                      style={{
                        padding: "5px 12px", borderRadius: 20, border: "1px solid rgba(0,245,255,0.2)",
                        background: "rgba(0,245,255,0.05)", color: "rgba(0,245,255,0.8)",
                        fontSize: 11, fontFamily: "monospace", cursor: "pointer"
                      }}
                    >{s}</button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => {
              const isUser = msg.role === "user";
              const msgLang = LANGUAGES.find(l => l.code === msg.lang);
              return (
                <div key={msg.id} style={{
                  display: "flex", flexDirection: "column",
                  alignItems: isUser ? "flex-end" : "flex-start",
                  animation: "nx-fadeIn 0.3s ease forwards"
                }}>
                  {/* Sender label */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    {!isUser && (
                      <>
                        <div style={{
                          width: 20, height: 20, borderRadius: "50%",
                          background: "linear-gradient(135deg, #00F5FF22, #6E56FF22)",
                          border: "1px solid rgba(0,245,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center"
                        }}>
                          <Brain style={{ width: 10, height: 10, color: "#00F5FF" }} />
                        </div>
                        <span style={{ fontSize: 9, fontFamily: "monospace", color: "#00F5FF", letterSpacing: "0.15em" }}>NEXUS</span>
                      </>
                    )}
                    {msgLang && (
                      <span style={{
                        fontSize: 9, padding: "1px 6px", borderRadius: 10,
                        background: "rgba(0,245,255,0.08)", border: "1px solid rgba(0,245,255,0.15)",
                        color: "rgba(0,245,255,0.6)", fontFamily: "monospace"
                      }}>{msgLang.flag} {msgLang.short}</span>
                    )}
                    <span style={{ fontSize: 9, fontFamily: "monospace", color: "rgba(148,163,184,0.3)" }}>
                      {new Date(msg.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {isUser && (
                      <span style={{ fontSize: 9, fontFamily: "monospace", color: "rgba(148,163,184,0.5)", letterSpacing: "0.1em" }}>YOU</span>
                    )}
                  </div>

                  {/* Bubble */}
                  <div style={{
                    maxWidth: "82%", padding: "10px 14px", borderRadius: isUser ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
                    background: isUser
                      ? "linear-gradient(135deg, rgba(0,245,255,0.15), rgba(110,86,255,0.1))"
                      : "rgba(255,255,255,0.04)",
                    border: `1px solid ${isUser ? "rgba(0,245,255,0.25)" : "rgba(255,255,255,0.07)"}`,
                    fontSize: 13, lineHeight: 1.6, color: "#e2e8f0", fontFamily: "monospace",
                    position: "relative"
                  }}>
                    {msg.text}
                    {/* Copy button */}
                    <button
                      onClick={() => { navigator.clipboard.writeText(msg.text); toast.success("Copied"); }}
                      style={{
                        position: "absolute", top: 6, right: 6, background: "none", border: "none",
                        color: "rgba(148,163,184,0.3)", cursor: "pointer", padding: 3, borderRadius: 4,
                        opacity: 0, transition: "opacity 0.15s"
                      }}
                      className="msg-copy-btn"
                      onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                      onMouseLeave={e => e.currentTarget.style.opacity = "0"}
                    >
                      <Copy style={{ width: 10, height: 10 }} />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Streaming message */}
            {streaming && streamingContent && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%",
                    background: "linear-gradient(135deg, #00F5FF22, #6E56FF22)",
                    border: "1px solid rgba(0,245,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center"
                  }}>
                    <Brain style={{ width: 10, height: 10, color: "#00F5FF" }} />
                  </div>
                  <span style={{ fontSize: 9, fontFamily: "monospace", color: "#00F5FF" }}>NEXUS</span>
                  <Activity style={{ width: 10, height: 10, color: "#00F5FF", animation: "nx-pulse-cyan 0.8s ease-in-out infinite" }} />
                </div>
                <div style={{
                  maxWidth: "82%", padding: "10px 14px", borderRadius: "4px 16px 16px 16px",
                  background: "rgba(0,245,255,0.04)", border: "1px solid rgba(0,245,255,0.12)",
                  fontSize: 13, lineHeight: 1.6, color: "#e2e8f0", fontFamily: "monospace"
                }}>
                  {streamingContent}<span className="nx-caret" />
                </div>
              </div>
            )}

            {/* Thinking indicator */}
            {thinking && !streaming && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px" }}>
                <Brain style={{ width: 13, height: 13, color: "#6E56FF", animation: "nx-spin-slow 2s linear infinite" }} />
                <span style={{ fontSize: 11, fontFamily: "monospace", color: "#6E56FF" }}>NEXUS is processing…</span>
              </div>
            )}

            {/* Live transcript */}
            {(listening && (interimTranscript || transcript)) && (
              <div style={{
                padding: "8px 14px", borderRadius: 10, background: "rgba(0,255,136,0.05)",
                border: "1px solid rgba(0,255,136,0.2)", fontSize: 12, fontFamily: "monospace",
                color: "#00FF88", fontStyle: "italic"
              }}>
                🎙 {interimTranscript || transcript}
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>

          {/* Text input */}
          <div style={{
            padding: "12px 14px", borderTop: "1px solid rgba(0,245,255,0.1)",
            display: "flex", gap: 8, flexShrink: 0
          }}>
            <div style={{ flex: 1, position: "relative" }}>
              <input
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleTextSend(); } }}
                placeholder={`Type in ${currentLang.label.split("(")[0].trim()} or any language… (Enter to send)`}
                style={{
                  width: "100%", padding: "10px 14px", paddingRight: 40,
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(0,245,255,0.15)",
                  borderRadius: 10, color: "#fff", fontSize: 12, fontFamily: "monospace",
                  outline: "none", transition: "border-color 0.2s"
                }}
                onFocus={e => e.target.style.borderColor = "rgba(0,245,255,0.4)"}
                onBlur={e => e.target.style.borderColor = "rgba(0,245,255,0.15)"}
              />
            </div>
            <button
              onClick={handleTextSend}
              disabled={!textInput.trim() || streaming || thinking}
              style={{
                padding: "10px 16px", borderRadius: 10, border: "1px solid rgba(0,245,255,0.3)",
                background: "rgba(0,245,255,0.1)", color: "#00F5FF", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontFamily: "monospace",
                opacity: (!textInput.trim() || streaming || thinking) ? 0.4 : 1,
                transition: "all 0.2s"
              }}
            >
              <Send style={{ width: 13, height: 13 }} /> SEND
            </button>
            <button
              onClick={listening ? stopListening : startListening}
              disabled={!STT_SUPPORTED || thinking || streaming}
              style={{
                padding: "10px 14px", borderRadius: 10,
                border: `1px solid ${listening ? "rgba(0,255,136,0.4)" : "rgba(0,245,255,0.2)"}`,
                background: listening ? "rgba(0,255,136,0.12)" : "rgba(0,245,255,0.05)",
                color: listening ? "#00FF88" : "#00F5FF", cursor: "pointer",
                opacity: (!STT_SUPPORTED || thinking || streaming) ? 0.4 : 1,
                animation: listening ? "pulse-loc 1.2s ease-in-out infinite" : "none"
              }}
            >
              {listening ? <MicOff style={{ width: 14, height: 14 }} /> : <Mic style={{ width: 14, height: 14 }} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
