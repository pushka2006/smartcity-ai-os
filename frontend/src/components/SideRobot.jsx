import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { Send, X, Trash2, Sparkles } from "lucide-react";
import { streamChat } from "../lib/api";

export default function SideRobot() {
  const location = useLocation();
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isBlinking, setIsBlinking] = useState(false);
  const [speechText, setSpeechText] = useState("");
  const [hovered, setHovered] = useState(false);
  const [handStatus, setHandStatus] = useState("idle");
  const [handDetected, setHandDetected] = useState(false);
  const containerRef = useRef(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatStreaming, setChatStreaming] = useState(false);
  const [chatSessionId, setChatSessionId] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Audio Refs for EAS Siren (if needed elsewhere, but kept simple here)
  const messagesEndRefScroll = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (chatOpen) {
      messagesEndRefScroll();
    }
  }, [chatMessages, chatOpen]);

  useEffect(() => {
    if (chatOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [chatOpen]);

  // Listen to hand-tracking status from the hand animation studio page
  useEffect(() => {
    const handleStatus = (e) => {
      if (e.detail) {
        setHandStatus(e.detail.status || "idle");
        setHandDetected(!!e.detail.detected);
      }
    };
    window.addEventListener("nexus-hand-status", handleStatus);
    return () => window.removeEventListener("nexus-hand-status", handleStatus);
  }, []);

  // Reset hand tracking state when leaving the /handanim tab
  useEffect(() => {
    if (location.pathname !== "/handanim") {
      setHandStatus("idle");
      setHandDetected(false);
    }
  }, [location.pathname]);

  // Track mouse coordinates to look towards the cursor
  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Periodic blinking effect
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 150);
    }, 4000 + Math.random() * 3000);

    return () => clearInterval(blinkInterval);
  }, []);

  const getContextWelcomeMessage = (path) => {
    let greeting = "HELLO HUMAN. I am NEXUS, the core operating swarm intelligence. How can I assist you today?";
    switch (path) {
      case "/traffic":
        greeting = "EAS and Telemetry modules online. Evacuation routing models are active. Ask me anything about current traffic grids, evacuations, or speed paces.";
        break;
      case "/code":
        greeting = "Compiler pipelines ready. Lints analyzed. Ask me code assistant directives.";
        break;
      case "/biometrics":
      case "/camera":
        greeting = "Sentinel protocols active. Face scanners nominal. Ask me about system lock status or security profiles.";
        break;
      case "/chat":
        greeting = "Connecting cognitive modules. Chat swarm is operational.";
        break;
      case "/settings":
        greeting = "Calibration panel online. Ask me about custom system parameters.";
        break;
      case "/tasks":
        greeting = "Schedule and TODO swarms sync complete. How can I assist with your tasks?";
        break;
      case "/terminal":
        greeting = "Sandbox terminal engaged. Caution required. How can I assist with terminal operations?";
        break;
      default:
        break;
    }
    return greeting;
  };

  // Reset conversation when route switches
  useEffect(() => {
    const welcome = getContextWelcomeMessage(location.pathname);
    setChatMessages(prev => {
      if (prev.length <= 1) {
        return [{ id: `w${Date.now()}`, role: "assistant", content: welcome, timestamp: new Date().toISOString() }];
      }
      return [
        ...prev,
        { id: `sys${Date.now()}`, role: "system", content: `[Context switched to ${location.pathname}]`, timestamp: new Date().toISOString() }
      ];
    });
  }, [location.pathname]);

  // Context-aware speech responses based on current path
  useEffect(() => {
    let text = "HELLO OPERATOR. NEXUS OS IS NOMINAL.";
    if (chatOpen) {
      text = "COGNITIVE CHAT ASSISTANT SWARM ENGAGED.";
    } else if (hovered) {
      text = "CLICK ME TO OPEN THE COGNITIVE CHAT ASSISTANT.";
    } else {
      switch (location.pathname) {
        case "/":
          text = "WELCOME BACK. CORE COMMAND PANEL INITIALIZED.";
          break;
        case "/chat":
          text = "CONNECTING COGNITIVE MODULES... READY TO CHAT.";
          break;
        case "/agents":
          text = "MONITORING ACTIVE AGENT SYSTEM SWARMS...";
          break;
        case "/memory":
          text = "KNOWLEDGE GRAPHS SYNCHRONIZED AND SECURED.";
          break;
        case "/knowledge":
          text = "SCANNING SYSTEM ARCHIVE AND RETRIEVAL INDEX.";
          break;
        case "/code":
          text = "SYNTACTIC ANALYZERS ONLINE. LETS WRITE CODE!";
          break;
        case "/terminal":
          text = "SANDBOX TERMINAL ENGAGED. CAUTION REQUIRED.";
          break;
        case "/browser":
          text = "SECURE SANDBOXED WEB RUNTIME IS RUNNING.";
          break;
        case "/tasks":
          text = "CORE SCHEDULE AND TO-DOS SYNCED COMPLETED.";
          break;
        case "/monitor":
          text = "TELEMETRY SYSTEM HEALTH AND CPU NOMINAL.";
          break;
        case "/camera":
          text = "CAMERA FEED ACCESSIBLE. BIOMETRICS ACTIVE.";
          break;
        case "/particles":
          text = "KINETIC PHYSICS PARTICLE playground ENGAGED.";
          break;
        case "/animate":
          text = "SVG TIMELINE ANIMATION RENDERER ONLINE.";
          break;
        case "/handanim":
          if (handStatus === "error") {
            text = "CAMERA LINK OFFLINE. CHECK DEVICE PERMISSIONS!";
          } else if (handStatus === "loading") {
            text = "INITIALIZING CAMERA & NEURAL ENGINE...";
          } else if (handStatus === "active") {
            if (handDetected) {
              text = "✋ DUAL-HAND ACTIVE: PALM TRACKED!";
            } else {
              text = "SCANNING FRAME FOR HANDS...";
            }
          } else {
            text = "MOUSE CONTROL ACTIVE. CLICKS DETONATE BLASTS.";
          }
          break;
        case "/settings":
          text = "NEXUS PARAMETERS READY FOR CALIBRATION.";
          break;
        case "/biometrics":
          text = "SHIELD SYSTEM ACCESS NOMINAL. SECURITY GREEN.";
          break;
        default:
          break;
      }
    }
    setSpeechText(text);
  }, [location.pathname, handStatus, handDetected, hovered, chatOpen]);

  const sendChatAssistantMessage = async () => {
    if (!chatInput.trim() || chatStreaming) return;
    const text = chatInput.trim();
    setChatInput("");
    setChatStreaming(true);

    const userMsg = { id: `u${Date.now()}`, role: "user", content: text, timestamp: new Date().toISOString() };
    setChatMessages(prev => [...prev, userMsg]);

    const placeholder = { id: `a${Date.now()}`, role: "assistant", content: "", timestamp: new Date().toISOString(), streaming: true };
    setChatMessages(prev => [...prev, placeholder]);

    let sid = chatSessionId;

    try {
      let currentAgent = "nexus-core";
      if (location.pathname === "/code") currentAgent = "developer";
      
      await streamChat({
        session_id: sid,
        agent: currentAgent,
        message: text,
        onMeta: m => {
          sid = m.session_id;
          setChatSessionId(m.session_id);
        },
        onDelta: c => {
          setChatMessages(prev => prev.map(m => m.id === placeholder.id ? { ...m, content: m.content + c } : m));
        },
        onDone: () => {
          setChatStreaming(false);
          setChatMessages(prev => prev.map(m => m.id === placeholder.id ? { ...m, streaming: false } : m));
        },
        onError: err => {
          setChatStreaming(false);
          setChatMessages(prev => prev.map(m => m.id === placeholder.id ? { ...m, content: m.content + ` [Stream Error: ${err.message}]`, streaming: false } : m));
        }
      });
    } catch (e) {
      console.error("Assistant chat stream failed:", e);
      setChatStreaming(false);
      setChatMessages(prev => prev.map(m => m.id === placeholder.id ? { ...m, content: m.content + ` [System Error]`, streaming: false } : m));
    }
  };

  const clearChatAssistantHistory = () => {
    setChatSessionId(null);
    const welcome = getContextWelcomeMessage(location.pathname);
    setChatMessages([
      { id: `w${Date.now()}`, role: "assistant", content: welcome, timestamp: new Date().toISOString() }
    ]);
  };

  // Calculate face and eye angle offset based on mouse position relative to the container
  let headX = 0;
  let headY = 0;
  let eyeX = 0;
  let eyeY = 0;

  if (containerRef.current) {
    const rect = containerRef.current.getBoundingClientRect();
    const robotCenterX = rect.left + rect.width / 2;
    const robotCenterY = rect.top + rect.height / 2;

    const dx = mousePos.x - robotCenterX;
    const dy = mousePos.y - robotCenterY;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    // Head tilt factor (max 4px translation)
    headX = (dx / dist) * 4;
    headY = (dy / dist) * 3;

    // Pupil shift factor (max 2.5px translation)
    eyeX = (dx / dist) * 2.5;
    eyeY = (dy / dist) * 2;
  }

  return (
    <>
      {/* Floating Chat Drawer */}
      {chatOpen && (
        <div
          className="nx-glass"
          onClick={e => e.stopPropagation()} // prevent closing when clicking inside
          style={{
            position: "fixed",
            bottom: 195,
            right: 16,
            width: 340,
            height: 440,
            zIndex: 99999,
            display: "flex",
            flexDirection: "column",
            background: "rgba(2, 6, 23, 0.9)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(0, 245, 255, 0.22)",
            borderRadius: 12,
            boxShadow: "0 8px 32px rgba(0, 245, 255, 0.2)",
            overflow: "hidden",
            transition: "all 0.3s ease"
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "10px 14px",
              background: "rgba(0, 245, 255, 0.05)",
              borderBottom: "1px solid rgba(0, 245, 255, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#00F5FF" }}>
              <Sparkles style={{ width: 13, height: 13 }} />
              <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.08em", fontFamily: "monospace" }}>NEXUS AI ASSISTANT</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                onClick={clearChatAssistantHistory}
                title="Clear Session"
                style={{ background: "none", border: "none", color: "rgba(148,163,184,0.6)", cursor: "pointer", display: "flex", alignItems: "center", padding: 2 }}
                onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
                onMouseLeave={e => e.currentTarget.style.color = "rgba(148,163,184,0.6)"}
              >
                <Trash2 style={{ width: 12, height: 12 }} />
              </button>
              <button
                onClick={() => setChatOpen(false)}
                title="Close"
                style={{ background: "none", border: "none", color: "rgba(148,163,184,0.6)", cursor: "pointer", display: "flex", alignItems: "center", padding: 2 }}
                onMouseEnter={e => e.currentTarget.style.color = "#00F5FF"}
                onMouseLeave={e => e.currentTarget.style.color = "rgba(148,163,184,0.6)"}
              >
                <X style={{ width: 13, height: 13 }} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "12px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 10
            }}
          >
            {chatMessages.map(msg => {
              const isUser = msg.role === "user";
              const isSystem = msg.role === "system";
              
              if (isSystem) {
                return (
                  <div
                    key={msg.id}
                    style={{
                      fontSize: 9,
                      color: "rgba(148, 163, 184, 0.45)",
                      textAlign: "center",
                      fontFamily: "monospace",
                      margin: "4px 0"
                    }}
                  >
                    {msg.content}
                  </div>
                );
              }

              return (
                <div
                  key={msg.id}
                  style={{
                    display: "flex",
                    justifyContent: isUser ? "flex-end" : "flex-start",
                    alignItems: "flex-start"
                  }}
                >
                  {!isUser && (
                    <div style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: "rgba(0, 245, 255, 0.1)",
                      border: "1px solid rgba(0, 245, 255, 0.25)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 6,
                      fontSize: 10,
                      color: "#00F5FF",
                      marginTop: 2
                    }}>
                      ⬡
                    </div>
                  )}
                  <div
                    style={{
                      maxWidth: "80%",
                      padding: "8px 10px",
                      borderRadius: isUser ? "12px 12px 2px 12px" : "2px 12px 12px 12px",
                      background: isUser ? "rgba(0, 245, 255, 0.08)" : "rgba(15, 23, 42, 0.6)",
                      border: isUser ? "1px solid rgba(0, 245, 255, 0.2)" : "1px solid rgba(255, 255, 255, 0.05)",
                      fontSize: 11,
                      color: isUser ? "#e2e8f0" : "#cbd5e1",
                      fontFamily: "monospace",
                      lineHeight: 1.4,
                      wordBreak: "break-word"
                    }}
                  >
                    <div style={{ whiteSpace: "pre-wrap" }}>
                      {msg.content}
                      {msg.streaming && <span className="nx-caret" style={{ background: "#00F5FF", width: 4, height: 11, display: "inline-block", marginLeft: 2 }} />}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Panel */}
          <div
            style={{
              padding: 10,
              borderTop: "1px solid rgba(0, 245, 255, 0.12)",
              display: "flex",
              gap: 8,
              background: "rgba(2, 6, 23, 0.4)"
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  sendChatAssistantMessage();
                }
              }}
              placeholder="Ask NEXUS Assistant..."
              disabled={chatStreaming}
              style={{
                flex: 1,
                background: "rgba(2, 6, 23, 0.6)",
                border: "1px solid rgba(0, 245, 255, 0.15)",
                borderRadius: 6,
                padding: "6px 10px",
                fontSize: 11,
                color: "#fff",
                outline: "none",
                fontFamily: "monospace"
              }}
            />
            <button
              onClick={sendChatAssistantMessage}
              disabled={chatStreaming || !chatInput.trim()}
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: chatInput.trim() ? "rgba(0, 245, 255, 0.15)" : "rgba(255, 255, 255, 0.02)",
                border: chatInput.trim() ? "1px solid rgba(0, 245, 255, 0.3)" : "1px solid rgba(255,255,255,0.05)",
                color: chatInput.trim() ? "#00F5FF" : "rgba(148,163,184,0.4)",
                cursor: chatInput.trim() ? "pointer" : "default",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s"
              }}
            >
              <Send style={{ width: 12, height: 12 }} />
            </button>
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        onClick={() => setChatOpen(p => !p)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: "fixed",
          bottom: 16,
          right: 16,
          zIndex: 9999,
          pointerEvents: "auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 12,
          animation: "side-robot-float 4s ease-in-out infinite"
        }}
      >
      <style>{`
        @keyframes side-robot-float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-14px) rotate(1.8deg); }
        }
        @keyframes side-robot-thruster {
          0% { transform: scale(0.9) translateY(-0.5px); opacity: 0.7; }
          100% { transform: scale(1.15) translateY(1.5px); opacity: 1; filter: drop-shadow(0 0 4px #38cfff); }
        }
        @keyframes side-robot-core {
          0%, 100% { transform: scale(0.85); opacity: 0.75; }
          50% { transform: scale(1.15); opacity: 1; filter: drop-shadow(0 0 5px #38cfff); }
        }
      `}</style>

      {/* Speech bubble */}
      <div
        style={{
          background: "rgba(2, 6, 23, 0.9)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(56, 207, 255, 0.3)",
          boxShadow: hovered 
            ? "0 0 24px rgba(56, 207, 255, 0.35)" 
            : "0 0 16px rgba(56, 207, 255, 0.15)",
          padding: "8px 14px",
          borderRadius: "14px 14px 0 14px",
          maxWidth: 220,
          opacity: hovered ? 1 : 0.85,
          transform: hovered ? "translateY(-4px)" : "translateY(0)",
          transition: "all 0.3s ease"
        }}
      >
        <div style={{ fontFamily: "monospace", fontSize: 8, color: "rgba(148,163,184,0.5)", letterSpacing: "0.15em", marginBottom: 3 }}>
          NEXUS_ASSISTANT
        </div>
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 9.5,
            color: "#38cfff",
            textShadow: "0 0 8px rgba(56, 207, 255, 0.4)",
            lineHeight: 1.4,
            wordBreak: "break-word"
          }}
        >
          {speechText}
        </div>
      </div>

      {/* Floating 3D-Style Robot Character */}
      <div
        style={{
          width: 120,
          height: 160,
          cursor: "pointer",
          filter: hovered
            ? "drop-shadow(0 12px 36px rgba(0,200,255,0.45)) drop-shadow(0 0 20px rgba(0,200,255,0.25))"
            : "drop-shadow(0 8px 24px rgba(0,200,255,0.25)) drop-shadow(0 0 12px rgba(0,200,255,0.12))",
          transition: "filter 0.3s ease"
        }}
      >
        <svg width="100%" height="100%" viewBox="0 0 130 180">
          {/* ── ANTENNA ── */}
          {/* Base stalk */}
          <line 
            x1="65" 
            y1="22" 
            x2={65 + headX * 0.8} 
            y2={6 + headY * 0.8} 
            stroke="#1a8fff" 
            strokeWidth="3" 
            strokeLinecap="round"
          />
          {/* Antenna orb */}
          <circle 
            cx={65 + headX * 0.8} 
            cy={6 + headY * 0.8} 
            r="5" 
            fill="#38cfff"
            filter="drop-shadow(0 0 6px #38cfff)"
          />
          <circle 
            cx={65 + headX * 0.8} 
            cy={6 + headY * 0.8} 
            r="1.8" 
            fill="white" 
            opacity="0.85"
          />

          {/* ── HEAD GROUP (Translates with mouse interaction) ── */}
          <g transform={`translate(${headX}, ${headY})`}>
            {/* Head shadow */}
            <rect x="14" y="24" width="102" height="70" rx="25" fill="rgba(0,0,0,0.15)"/>
            {/* Main head body */}
            <rect 
              x="10" 
              y="20" 
              width="110" 
              height="70" 
              rx="25"
              fill="url(#headGrad)" 
              stroke="#c8d8e8" 
              strokeWidth="2"
            />
            {/* Head shine highlight */}
            <rect 
              x="18" 
              y="22" 
              width="88" 
              height="20" 
              rx="10"
              fill="rgba(255,255,255,0.22)"
            />

            {/* Ear Discs */}
            <ellipse cx="10" cy="55" rx="7" ry="10" fill="#b0c4d8" stroke="#c8d8e8" strokeWidth="1.5"/>
            <ellipse cx="10" cy="55" rx="3.5" ry="6" fill="#1a8fff" opacity="0.8"/>
            <ellipse cx="120" cy="55" rx="7" ry="10" fill="#b0c4d8" stroke="#c8d8e8" strokeWidth="1.5"/>
            <ellipse cx="120" cy="55" rx="3.5" ry="6" fill="#1a8fff" opacity="0.8"/>

            {/* Visor Area (Black screen background) */}
            <rect x="22" y="32" width="86" height="46" rx="16" fill="#0c1926" stroke="rgba(56,207,255,0.2)" strokeWidth="1"/>

            {/* Eyes */}
            {isBlinking ? (
              // Blinking Eyes (Horizontal slits)
              <>
                <line x1="32" y1="55" x2="52" y2="55" stroke="#38cfff" strokeWidth="3" strokeLinecap="round" />
                <line x1="78" y1="55" x2="98" y2="55" stroke="#38cfff" strokeWidth="3" strokeLinecap="round" />
              </>
            ) : (
              // Open tracking eyes
              <>
                {/* Left Eye */}
                <ellipse cx={42 + eyeX} cy={54 + eyeY} rx="11" ry="12" fill="rgba(56,207,255,0.15)"/>
                <ellipse cx={42 + eyeX} cy={54 + eyeY} rx="8" ry="9" fill="#1a8fff" opacity="0.8"/>
                <ellipse cx={42 + eyeX} cy={54 + eyeY} rx="5" ry="5.5" fill="#38cfff"/>
                <circle cx={44 + eyeX} cy={51 + eyeY} r="1.8" fill="white" opacity="0.85"/>

                {/* Right Eye */}
                <ellipse cx={88 + eyeX} cy={54 + eyeY} rx="11" ry="12" fill="rgba(56,207,255,0.15)"/>
                <ellipse cx={88 + eyeX} cy={54 + eyeY} rx="8" ry="9" fill="#1a8fff" opacity="0.8"/>
                <ellipse cx={88 + eyeX} cy={54 + eyeY} rx="5" ry="5.5" fill="#38cfff"/>
                <circle cx={90 + eyeX} cy={51 + eyeY} r="1.8" fill="white" opacity="0.85"/>
              </>
            )}

            {/* Smile / Mouth */}
            <path 
              d="M52 68 Q65 76 78 68" 
              stroke="#38cfff" 
              strokeWidth="2.5" 
              fill="none" 
              strokeLinecap="round"
              filter="drop-shadow(0 0 3px #38cfff)"
            />
          </g>

          {/* ── NECK ── */}
          <rect x="53" y="88" width="24" height="10" rx="4" fill="#a0b4c8" stroke="#c8d8e8" strokeWidth="1"/>

          {/* ── BODY ── */}
          {/* Body shadow */}
          <rect x="22" y="100" width="86" height="54" rx="18" fill="rgba(0,0,0,0.15)"/>
          {/* Main body chassis */}
          <rect 
            x="18" 
            y="96" 
            width="94" 
            height="54" 
            rx="18"
            fill="url(#bodyGrad)" 
            stroke="#c8d8e8" 
            strokeWidth="1.8"
          />
          {/* Body top shine */}
          <rect x="26" y="98" width="78" height="16" rx="8" fill="rgba(255,255,255,0.18)"/>

          {/* Core Chest Orb */}
          <circle cx="65" cy="122" r="11" fill="#0d1a2a" stroke="rgba(56,207,255,0.2)"/>
          <circle 
            cx="65" 
            cy="122" 
            r="8" 
            fill="#1a8fff" 
            opacity="0.8"
          />
          <g style={{ transformOrigin: "65px 122px", animation: "side-robot-core 2s ease-in-out infinite" }}>
            <circle 
              cx="65" 
              cy="122" 
              r="5.5" 
              fill="#38cfff"
              filter="drop-shadow(0 0 4px #38cfff)"
            />
          </g>
          <circle cx="67" cy="119" r="1.5" fill="white" opacity="0.85"/>

          {/* ── LEGS/FOOT BASE (Floating style, no separate detailed walking legs needed) ── */}
          <g style={{ transformOrigin: "65px 154px", animation: "side-robot-thruster 0.15s ease-in-out infinite alternate" }}>
            {/* Thruster Glow Base */}
            <ellipse cx="65" cy="154" rx="16" ry="5" fill="rgba(56,207,255,0.2)"/>
            <ellipse 
              cx="65" 
              cy="154" 
              rx="10" 
              ry="3.2" 
              fill="#38cfff"
              filter="drop-shadow(0 0 6px #38cfff)"
            />
            
            {/* Mini thruster fire animation path */}
            <path 
              d="M 58,154 Q 65,166 72,154" 
              fill="none" 
              stroke="#38cfff" 
              strokeWidth="2.5" 
              strokeLinecap="round"
              opacity="0.75"
            />
          </g>

          {/* Gradients */}
          <defs>
            <radialGradient id="headGrad" cx="50%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#f8faff"/>
              <stop offset="60%" stopColor="#d6e4f3"/>
              <stop offset="100%" stopColor="#b4c8db"/>
            </radialGradient>
            <radialGradient id="bodyGrad" cx="50%" cy="25%" r="75%">
              <stop offset="0%" stopColor="#ffffff"/>
              <stop offset="55%" stopColor="#dae7f5"/>
              <stop offset="100%" stopColor="#abbecf"/>
            </radialGradient>
          </defs>
        </svg>
      </div>
    </div>
    </>
  );
}
