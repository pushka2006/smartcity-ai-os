import { useEffect, useState, useRef } from "react";
import { useVoice } from "../lib/VoiceContext";

/* ─────────────────────────────────────────────
   Boot diagnostic log entries
───────────────────────────────────────────── */
const BOOT_DIAGNOSTICS = [
  { threshold: 5,  text: "INITIALIZING NEXUS CORE FIRMWARE v4.7.2 ........", ok: false },
  { threshold: 12, text: "MOUNTING SECURE FILESYSTEM ...................... [ OK ]", ok: true },
  { threshold: 22, text: "LOADING NEURAL INFERENCE ENGINE .................. [ OK ]", ok: true },
  { threshold: 35, text: "SYNCING BIOMETRIC SHIELD MODULES ................. [ OK ]", ok: true },
  { threshold: 48, text: "ESTABLISHING ENCRYPTED DATABASE LINKS ............ [ OK ]", ok: true },
  { threshold: 60, text: "CALIBRATING AMBIENT VOICE WAKE-WORD FILTERS ...... [ OK ]", ok: true },
  { threshold: 72, text: "VERIFYING CRYPTOGRAPHIC IDENTITY TOKENS .......... [ OK ]", ok: true },
  { threshold: 84, text: "LOADING AI INFERENCE MODELS ...................... [ OK ]", ok: true },
  { threshold: 93, text: "RUNNING INTEGRITY SELF-DIAGNOSTIC ................ [ OK ]", ok: true },
  { threshold: 99, text: "ALL TELEMETRY CHANNELS NOMINAL ─ BOOT COMPLETE ✦", ok: true },
];

/* ─────────────────────────────────────────────
   Animated particle canvas
───────────────────────────────────────────── */
function ParticleCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let animId;
    const particles = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Spawn particles
    for (let i = 0; i < 90; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.5 + 0.4,
        alpha: Math.random() * 0.55 + 0.1,
        color: Math.random() > 0.6 ? "#00F5FF" : Math.random() > 0.5 ? "#6E56FF" : "#FF2E88",
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw connecting lines
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(0,245,255,${0.04 * (1 - dist / 100)})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw particles
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
        ctx.globalAlpha = 1;

        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
      }

      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 1,
        pointerEvents: "none",
      }}
    />
  );
}

/* ─────────────────────────────────────────────
   Glitch text component
───────────────────────────────────────────── */
function GlitchText({ text, style }) {
  const [glitched, setGlitched] = useState(false);

  useEffect(() => {
    const glitchInterval = setInterval(() => {
      setGlitched(true);
      setTimeout(() => setGlitched(false), 80);
    }, 2400 + Math.random() * 1200);
    return () => clearInterval(glitchInterval);
  }, []);

  return (
    <span
      style={{
        ...style,
        position: "relative",
        display: "inline-block",
        textShadow: glitched
          ? "2px 0 #FF2E88, -2px 0 #00F5FF, 0 0 20px rgba(0,245,255,0.9)"
          : "0 0 20px rgba(0,245,255,0.55)",
        transform: glitched ? "skewX(-1.5deg)" : "none",
        transition: "text-shadow 0.05s",
      }}
    >
      {text}
      {glitched && (
        <span
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(110,86,255,0.06)",
            clipPath: "inset(40% 0 30% 0)",
            transform: "translateX(-3px)",
            pointerEvents: "none",
          }}
        >
          {text}
        </span>
      )}
    </span>
  );
}

/* ─────────────────────────────────────────────
   Animated HUD circle logo
───────────────────────────────────────────── */
function HUDLogo({ progress }) {
  const size = 160;
  const r = 68;
  const circ = 2 * Math.PI * r;
  const dashOffset = circ * (1 - progress / 100);

  return (
    <div style={{ position: "relative", width: size, height: size, marginBottom: 32 }}>
      {/* Outer glow burst */}
      <div
        style={{
          position: "absolute",
          inset: -20,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0,245,255,0.08) 0%, transparent 70%)",
          animation: "ws-pulse-glow 2.4s ease-in-out infinite alternate",
        }}
      />

      {/* SVG progress arc */}
      <svg
        width={size}
        height={size}
        style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}
      >
        {/* Track ring */}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,245,255,0.07)" strokeWidth={3} />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#arcGrad)"
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 0.06s linear", filter: "drop-shadow(0 0 6px rgba(0,245,255,0.8))" }}
        />
        <defs>
          <linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6E56FF" />
            <stop offset="100%" stopColor="#00F5FF" />
          </linearGradient>
        </defs>
      </svg>

      {/* Dashed spinning ring 1 */}
      <div
        style={{
          position: "absolute",
          inset: 8,
          borderRadius: "50%",
          border: "1.5px dashed rgba(0,245,255,0.28)",
          animation: "ws-spin 5s linear infinite",
        }}
      />
      {/* Dashed ring 2 reverse */}
      <div
        style={{
          position: "absolute",
          inset: 18,
          borderRadius: "50%",
          border: "1px solid rgba(255,46,136,0.18)",
          borderTopColor: "rgba(255,46,136,0.45)",
          animation: "ws-spin-rev 8s linear infinite",
        }}
      />

      {/* Center nexus mark */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {/* Hexagon-ish icon via borders */}
        <div
          style={{
            width: 36,
            height: 36,
            background: "linear-gradient(135deg, #6E56FF, #00F5FF)",
            borderRadius: "30% 70% 70% 30% / 30% 30% 70% 70%",
            boxShadow: "0 0 20px rgba(0,245,255,0.55), inset 0 0 10px rgba(255,255,255,0.15)",
            animation: "ws-morph 4s ease-in-out infinite alternate",
          }}
        />
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 10,
            color: "#00F5FF",
            letterSpacing: "0.18em",
            marginTop: 4,
            textShadow: "0 0 8px rgba(0,245,255,0.8)",
          }}
        >
          {progress.toFixed(0)}%
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Big Robot component (Voice-reactive / Animated)
   ───────────────────────────────────────────── */
function BigRobot({ progress, phase }) {
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    if (phase === "welcome") {
      setIsSpeaking(true);
      // Voice greeting lasts ~6 seconds
      const timer = setTimeout(() => {
        setIsSpeaking(false);
      }, 6200);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  // 9 equalizer-like lines for the mouth
  const bars = Array.from({ length: 9 });

  return (
    <div style={{
      position: "relative",
      width: 220,
      height: 200,
      marginBottom: 24,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center"
    }}>
      {/* Robot Head Frame */}
      <svg width="220" height="200" viewBox="0 0 220 200" style={{ filter: "drop-shadow(0 0 15px rgba(0, 245, 255, 0.25))" }}>
        <defs>
          <linearGradient id="helmGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0b1329" />
            <stop offset="100%" stopColor="#020617" />
          </linearGradient>
          <linearGradient id="neonGlow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6E56FF" />
            <stop offset="100%" stopColor="#00F5FF" />
          </linearGradient>
        </defs>

        {/* Outer Halo Rings */}
        <circle cx="110" cy="100" r="95" fill="none" stroke="rgba(0, 245, 255, 0.04)" strokeWidth="1" strokeDasharray="5,10" />
        <circle cx="110" cy="100" r="90" fill="none" stroke="rgba(110, 86, 255, 0.08)" strokeWidth="2" style={{ transformOrigin: "center", animation: "ws-spin 20s linear infinite" }} />
        
        {/* Antennas / Ear Plates */}
        <rect x="25" y="85" width="8" height="30" rx="4" fill="rgba(110, 86, 255, 0.35)" stroke="#6E56FF" strokeWidth="1" />
        <rect x="187" y="85" width="8" height="30" rx="4" fill="rgba(110, 86, 255, 0.35)" stroke="#6E56FF" strokeWidth="1" />
        
        <line x1="30" y1="85" x2="15" y2="60" stroke="#00F5FF" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="15" cy="60" r="3" fill="#00F5FF" style={{ animation: "ws-blink 1.5s infinite" }} />

        <line x1="190" y1="85" x2="205" y2="60" stroke="#00F5FF" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="205" cy="60" r="3" fill="#00F5FF" style={{ animation: "ws-blink 1.5s infinite" }} />

        {/* Neck / Collar */}
        <path d="M80 155 L140 155 L130 180 L90 180 Z" fill="rgba(15, 23, 42, 0.9)" stroke="rgba(0, 245, 255, 0.15)" strokeWidth="2" />
        <line x1="100" y1="165" x2="120" y2="165" stroke="#6E56FF" strokeWidth="2" />

        {/* Head Chassis Shape */}
        <path d="M50 70 C50 40, 170 40, 170 70 L170 130 C170 150, 150 160, 110 160 C70 160, 50 150, 50 130 Z" 
          fill="url(#helmGrad)" stroke="url(#neonGlow)" strokeWidth="2.5" />

        {/* Forehead Hexagon Core */}
        <polygon points="110,48 122,55 122,69 110,76 98,69 98,55" fill="rgba(2, 6, 23, 0.9)" stroke="#00F5FF" strokeWidth="1.5" />
        <polygon points="110,51 119,56 119,68 110,73 101,68 101,56" fill="#00F5FF" style={{
          opacity: 0.1 + (progress / 100) * 0.9,
          filter: "drop-shadow(0 0 4px #00F5FF)",
          transition: "opacity 0.2s"
        }} />

        {/* Main Visor Screen */}
        <path d="M60 85 C60 80, 160 80, 160 85 L165 110 C165 118, 155 125, 110 125 C65 125, 55 118, 55 110 Z" 
          fill="#020617" stroke="rgba(0, 245, 255, 0.3)" strokeWidth="1.5" />

        {/* Visor display */}
        {phase === "boot" ? (
          <>
            <rect x="62" y="88" width="96" height="30" rx="3" fill="rgba(0, 245, 255, 0.05)" />
            <line x1="65" y1={88 + (progress % 30)} x2="155" y2={88 + (progress % 30)} stroke="#00F5FF" strokeWidth="1.5" style={{ opacity: 0.8 }} />
            <text x="110" y="106" fill="#00F5FF" fontFamily="monospace" fontSize="10" textAnchor="middle" letterSpacing="1" style={{ opacity: 0.8 }}>
              BOOTING: {progress.toFixed(0)}%
            </text>
          </>
        ) : (
          <>
            <rect x="62" y="88" width="96" height="30" rx="3" fill="rgba(0, 255, 136, 0.06)" />
            <circle cx="90" cy="102" r="6" fill="#00FF88" style={{ filter: "drop-shadow(0 0 5px #00FF88)", animation: "ws-blink 4s ease infinite" }} />
            <circle cx="130" cy="102" r="6" fill="#00FF88" style={{ filter: "drop-shadow(0 0 5px #00FF88)", animation: "ws-blink 4s ease infinite" }} />
            <path d="M80 102 A10 10 0 0 1 100 102" fill="none" stroke="rgba(0, 255, 136, 0.25)" strokeWidth="1" strokeDasharray="2,2" />
            <path d="M120 102 A10 10 0 0 1 140 102" fill="none" stroke="rgba(0, 255, 136, 0.25)" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="110" y1="108" x2="110" y2="114" stroke="#00FF88" strokeWidth="1" strokeLinecap="round" />
          </>
        )}
      </svg>

      {/* Mouth Equalizer bars */}
      <div style={{
        position: "absolute",
        bottom: 50,
        display: "flex",
        alignItems: "center",
        gap: 3,
        height: 18,
        justifyContent: "center",
        width: 60
      }}>
        {bars.map((_, i) => (
          <div
            key={i}
            style={{
              width: 3,
              borderRadius: 1.5,
              background: phase === "welcome" ? "#00FF88" : "#00F5FF",
              boxShadow: phase === "welcome" ? "0 0 6px #00FF88" : "0 0 4px #00F5FF",
              height: 3,
              animation: isSpeaking 
                ? `ws-soundbar-${(i % 3) + 1} 0.5s ease-in-out infinite alternate`
                : phase === "welcome" ? "none" : `ws-soundbar-slow 1.5s ease-in-out ${i * 0.15}s infinite alternate`
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main WelcomeScreen
───────────────────────────────────────────── */
export default function WelcomeScreen() {
  const { speak } = useVoice();
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState([]);
  const [phase, setPhase] = useState("boot"); // boot | welcome | fadeout
  const [visible, setVisible] = useState(true);
  const [scanY, setScanY] = useState(0);
  const [showWelcomeText, setShowWelcomeText] = useState(false);
  const spokenRef = useRef(false);
  const logIndexRef = useRef(0);

  /* ── Progress bar ── */
  useEffect(() => {
    const DURATION = 4800; // 4.8s boot
    const INTERVAL = 30;
    const inc = 100 / (DURATION / INTERVAL);
    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = Math.min(prev + inc, 100);
        if (next >= 100) clearInterval(timer);
        return next;
      });
    }, INTERVAL);
    return () => clearInterval(timer);
  }, []);

  /* ── Scan line animation ── */
  useEffect(() => {
    let y = 0;
    const id = setInterval(() => {
      y = (y + 2) % 100;
      setScanY(y);
    }, 20);
    return () => clearInterval(id);
  }, []);

  /* ── Boot log drip ── */
  useEffect(() => {
    const pending = BOOT_DIAGNOSTICS.filter(
      (d) => d.threshold <= progress && !logs.some((l) => l.text === d.text)
    );
    if (pending.length > 0) {
      setLogs((prev) => [...prev, ...pending]);
    }
  }, [progress]); // eslint-disable-line

  /* ── At 100%: show welcome card then speak ── */
  useEffect(() => {
    if (progress < 100 || spokenRef.current) return;
    spokenRef.current = true;

    setPhase("welcome");
    setShowWelcomeText(true);

    // Voice greeting — dramatic, multi-sentence
    const greetingTimer = setTimeout(() => {
      speak(
        "Welcome back, Operator. NEXUS operating system is fully online. " +
        "All neural cores, biometric shields, and AI inference modules are nominal. " +
        "Awaiting your directive."
      );
    }, 600);

    // Fade out after welcome card shown
    const fadeTimer = setTimeout(() => setPhase("fadeout"), 4200);
    const unmountTimer = setTimeout(() => setVisible(false), 5200);

    return () => {
      clearTimeout(greetingTimer);
      clearTimeout(fadeTimer);
      clearTimeout(unmountTimer);
    };
  }, [progress, speak]);

  if (!visible) return null;

  const isFading = phase === "fadeout";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10005,
        background: "#020617",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity: isFading ? 0 : 1,
        transition: "opacity 1s ease-in-out",
        pointerEvents: isFading ? "none" : "auto",
        overflow: "hidden",
      }}
    >
      {/* ── Particle field ── */}
      <ParticleCanvas />

      {/* ── Scan line sweep ── */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: `${scanY}%`,
          height: 2,
          background: "linear-gradient(90deg, transparent 0%, rgba(0,245,255,0.12) 30%, rgba(0,245,255,0.25) 50%, rgba(0,245,255,0.12) 70%, transparent 100%)",
          zIndex: 2,
          pointerEvents: "none",
        }}
      />

      {/* ── Grid overlay ── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(0,245,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(0,245,255,0.015) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          zIndex: 2,
          pointerEvents: "none",
        }}
      />

      {/* ── Corner HUD brackets ── */}
      {[
        { top: 16, left: 16, rot: 0 },
        { top: 16, right: 16, rot: 90 },
        { bottom: 16, right: 16, rot: 180 },
        { bottom: 16, left: 16, rot: 270 },
      ].map((pos, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            ...pos,
            width: 36,
            height: 36,
            borderTop: i === 0 || i === 3 ? "2px solid rgba(0,245,255,0.35)" : "none",
            borderBottom: i === 1 || i === 2 ? "2px solid rgba(0,245,255,0.35)" : "none",
            borderLeft: i === 0 || i === 3 ? "2px solid rgba(0,245,255,0.35)" : "none",
            borderRight: i === 1 || i === 2 ? "2px solid rgba(0,245,255,0.35)" : "none",
            zIndex: 3,
          }}
        />
      ))}

      {/* ── Side status strips ── */}
      <div
        style={{
          position: "absolute",
          left: 16,
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          zIndex: 3,
        }}
      >
        {["SYS", "NET", "CPU", "SEC"].map((label, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: progress > 25 * (i + 1) ? "#00FF88" : "rgba(255,255,255,0.15)",
                boxShadow: progress > 25 * (i + 1) ? "0 0 6px #00FF88" : "none",
                transition: "all 0.4s",
              }}
            />
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 8,
                color: progress > 25 * (i + 1) ? "rgba(0,255,136,0.7)" : "rgba(148,163,184,0.3)",
                letterSpacing: "0.1em",
                transition: "color 0.4s",
              }}
            >
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* ── Main card ── */}
      <div
        style={{
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: "100%",
          maxWidth: 520,
          padding: "0 24px",
        }}
      >
        {/* OS version badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "3px 10px",
            borderRadius: 20,
            background: "rgba(110,86,255,0.1)",
            border: "1px solid rgba(110,86,255,0.3)",
            marginBottom: 20,
            animation: "ws-fadein 0.5s ease forwards",
          }}
        >
          <div
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "#6E56FF",
              boxShadow: "0 0 6px #6E56FF",
              animation: "ws-blink 1.2s step-end infinite",
            }}
          />
          <span
            style={{
              fontFamily: "monospace",
              fontSize: 8.5,
              letterSpacing: "0.2em",
              color: "#a78bfa",
              textTransform: "uppercase",
            }}
          >
            NEXUS_OS · CORE_BOOT · v4.7.2
          </span>
        </div>

        {/* Big Robot Head central HUD element */}
        <BigRobot progress={progress} phase={phase} />

        {/* NEXUS title with glitch */}
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <div
            style={{
              fontFamily: "'Unbounded', 'JetBrains Mono', monospace",
              fontSize: 36,
              fontWeight: 900,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "#00F5FF",
              marginBottom: 4,
            }}
          >
            <GlitchText text="NEXUS OS" />
          </div>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: 9.5,
              letterSpacing: "0.35em",
              color: "rgba(148,163,184,0.5)",
              textTransform: "uppercase",
            }}
          >
            AI · OPERATING · SYSTEM
          </div>
        </div>

        {/* Thin separator */}
        <div
          style={{
            width: "80%",
            height: 1,
            background: "linear-gradient(90deg, transparent, rgba(0,245,255,0.2), transparent)",
            margin: "18px 0",
          }}
        />

        {/* Progress bar */}
        <div
          style={{
            width: "100%",
            height: 3,
            background: "rgba(255,255,255,0.04)",
            borderRadius: 4,
            overflow: "visible",
            marginBottom: 6,
            position: "relative",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progress}%`,
              background: "linear-gradient(90deg, #6E56FF, #00F5FF)",
              borderRadius: 4,
              boxShadow: "0 0 10px rgba(0,245,255,0.9), 0 0 24px rgba(0,245,255,0.4)",
              transition: "width 0.04s linear",
              position: "relative",
            }}
          >
            {/* Leading glow dot */}
            <div
              style={{
                position: "absolute",
                right: -3,
                top: "50%",
                transform: "translateY(-50%)",
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#00F5FF",
                boxShadow: "0 0 10px #00F5FF, 0 0 20px rgba(0,245,255,0.8)",
              }}
            />
          </div>
        </div>

        <div
          style={{
            fontFamily: "monospace",
            fontSize: 9,
            color: "rgba(148,163,184,0.4)",
            marginBottom: 20,
            alignSelf: "flex-end",
          }}
        >
          {progress.toFixed(1)}% INITIALIZED
        </div>

        {/* Boot log console */}
        <div
          style={{
            width: "100%",
            height: 130,
            borderRadius: 10,
            padding: "12px 14px",
            overflowY: "auto",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9.5,
            color: "rgba(148,163,184,0.6)",
            display: "flex",
            flexDirection: "column",
            gap: 3,
            background: "rgba(2,6,23,0.6)",
            border: "1px solid rgba(0,245,255,0.07)",
            backdropFilter: "blur(8px)",
            scrollbarWidth: "none",
          }}
        >
          {logs.map((log, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 7,
                color: log.ok ? "#00FF88" : "#64748b",
                animation: "ws-log-slide 0.18s ease-out forwards",
                opacity: 0,
                animationFillMode: "forwards",
                animationDelay: `${idx * 0.02}s`,
              }}
            >
              <span style={{ color: log.ok ? "#00FF88" : "#FF2E88", flexShrink: 0, marginTop: 1 }}>
                {log.ok ? "✓" : "▸"}
              </span>
              <span style={{ lineHeight: 1.5 }}>{log.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Welcome card (shown after boot) ── */}
      {showWelcomeText && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(2,6,23,0.92)",
            backdropFilter: "blur(16px)",
            animation: "ws-fadein 0.6s ease forwards",
          }}
        >
          <div
            style={{
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 18,
              padding: 32,
              animation: "ws-scale-in 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards",
            }}
          >
            {/* Big Robot floating greeting core */}
            <BigRobot progress={100} phase="welcome" />
            {/* Green online indicator */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#00FF88",
                  boxShadow: "0 0 12px #00FF88, 0 0 24px rgba(0,255,136,0.6)",
                  animation: "ws-blink 1s ease-in-out infinite",
                }}
              />
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: 10,
                  letterSpacing: "0.3em",
                  color: "#00FF88",
                }}
              >
                ALL SYSTEMS NOMINAL
              </span>
            </div>

            {/* Large greeting */}
            <div
              style={{
                fontFamily: "'Unbounded', monospace",
                fontSize: 48,
                fontWeight: 900,
                letterSpacing: "0.08em",
                lineHeight: 1.1,
              }}
            >
              <div style={{ color: "#00F5FF", textShadow: "0 0 30px rgba(0,245,255,0.5)" }}>
                WELCOME
              </div>
              <div
                style={{
                  color: "rgba(255,255,255,0.9)",
                  fontSize: 28,
                  letterSpacing: "0.22em",
                  marginTop: 8,
                }}
              >
                OPERATOR
              </div>
            </div>

            {/* Sub-text */}
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 11,
                color: "rgba(148,163,184,0.6)",
                letterSpacing: "0.15em",
                maxWidth: 340,
                lineHeight: 1.7,
              }}
            >
              NEXUS AI core is online.<br />
              Neural inference, biometric security,<br />
              and voice modules ready.
            </div>

            {/* Pulsing ring */}
            <div style={{ position: "relative", width: 80, height: 80 }}>
              {[1, 0.7, 0.4].map((op, i) => (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    inset: i * 12,
                    borderRadius: "50%",
                    border: `1px solid rgba(0,245,255,${op * 0.4})`,
                    animation: `ws-ring-pulse 2s ease-in-out ${i * 0.35}s infinite`,
                  }}
                />
              ))}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                }}
              >
                ⬡
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Injected keyframe animations ── */}
      <style>{`
        @keyframes ws-spin     { to { transform: rotate(360deg); } }
        @keyframes ws-spin-rev { to { transform: rotate(-360deg); } }

        @keyframes ws-pulse-glow {
          0%   { opacity: 0.6; transform: scale(1); }
          100% { opacity: 1;   transform: scale(1.08); }
        }

        @keyframes ws-morph {
          0%   { border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%; }
          50%  { border-radius: 70% 30% 30% 70% / 70% 70% 30% 30%; }
          100% { border-radius: 50% 50% 50% 50%; }
        }

        @keyframes ws-blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }

        @keyframes ws-fadein {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        @keyframes ws-scale-in {
          from { opacity: 0; transform: scale(0.88); }
          to   { opacity: 1; transform: scale(1); }
        }

        @keyframes ws-log-slide {
          from { opacity: 0; transform: translateX(-6px); }
          to   { opacity: 1; transform: translateX(0); }
        }

        @keyframes ws-ring-pulse {
          0%   { transform: scale(1);    opacity: 0.7; }
          50%  { transform: scale(1.12); opacity: 0.3; }
          100% { transform: scale(1);    opacity: 0.7; }
        }

        @keyframes ws-soundbar-1 {
          0% { height: 3px; }
          100% { height: 16px; }
        }
        @keyframes ws-soundbar-2 {
          0% { height: 3px; }
          100% { height: 11px; }
        }
        @keyframes ws-soundbar-3 {
          0% { height: 3px; }
          100% { height: 18px; }
        }
        @keyframes ws-soundbar-slow {
          0% { height: 3px; }
          100% { height: 6px; }
        }
      `}</style>
    </div>
  );
}
