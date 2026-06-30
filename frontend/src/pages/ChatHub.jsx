import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";
import { http, streamChat } from "../lib/api";
import { toast } from "../components/Toast";
import { Send, Plus, MessageSquare, Trash2, Square, Copy, ChevronDown, Mic, MicOff, Volume2, VolumeX } from "lucide-react";

const AGENTS = [
  { key: "nexus-core", name: "NEXUS Core",     color: "#00F5FF", emoji: "⬡" },
  { key: "planner",    name: "Planner",         color: "#6E56FF", emoji: "📋" },
  { key: "researcher", name: "Researcher",      color: "#7dd3fc", emoji: "🔬" },
  { key: "developer",  name: "Developer",       color: "#00FF88", emoji: "💻" },
  { key: "debugger",   name: "Debugger",        color: "#FF4D4D", emoji: "🐛" },
  { key: "tester",     name: "Tester",          color: "#FFC857", emoji: "🧪" },
  { key: "documenter", name: "Documenter",      color: "#FF2E88", emoji: "📝" },
  { key: "security",   name: "Security",        color: "#FF4D4D", emoji: "🛡" },
  { key: "manager",    name: "Project Mgr",     color: "#FF2E88", emoji: "🗂" },
  { key: "memory",     name: "Memory",          color: "#6E56FF", emoji: "🧠" },
  { key: "browser",    name: "Browser",         color: "#00F5FF", emoji: "🌐" },
  { key: "terminal",   name: "Terminal",        color: "#00FF88", emoji: "⌨" },
  { key: "deployer",   name: "Deployer",        color: "#FFC857", emoji: "🚀" },
];

const SUGGESTIONS = [
  "Explain what you can do",
  "Write a Python REST API",
  "Break down my project into tasks",
  "Research quantum computing",
  "Review this code for security issues",
];

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => toast.success("Copied to clipboard")).catch(() => toast.error("Copy failed"));
}

function MsgBubble({ msg }) {
  const isUser = msg.role === "user";
  const agent = AGENTS.find(a => a.key === msg.agent);
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="nx-fadein"
      style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 14, position: "relative" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {!isUser && (
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: `${agent?.color || "#00F5FF"}20`, border: `1px solid ${agent?.color || "#00F5FF"}44`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginRight: 8, marginTop: 2, fontSize: 13 }}>
          {agent?.emoji || "⬡"}
        </div>
      )}
      <div style={{ maxWidth: "78%", position: "relative" }}>
        {!isUser && (
          <div style={{ fontSize: 10, color: agent?.color || "#00F5FF", fontFamily: "monospace", marginBottom: 4, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            {agent?.name || "NEXUS"}
          </div>
        )}
        <div style={{
          padding: "10px 14px", borderRadius: isUser ? "14px 14px 4px 14px" : "4px 14px 14px 14px",
          background: isUser ? "rgba(0,245,255,0.12)" : "rgba(15,23,42,0.75)",
          border: `1px solid ${isUser ? "rgba(0,245,255,0.28)" : "rgba(255,255,255,0.07)"}`,
          fontSize: 13, lineHeight: 1.6,
        }}>
          <div className={`nx-md ${msg.streaming ? "nx-caret" : ""}`} style={{ color: isUser ? "#e2e8f0" : "#cbd5e1" }}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ node, inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || "");
                  return !inline && match ? (
                    <div style={{ position: "relative" }}>
                      <button
                        onClick={() => copyText(String(children))}
                        style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,245,255,0.1)", border: "1px solid rgba(0,245,255,0.2)", borderRadius: 4, color: "#00F5FF", cursor: "pointer", padding: "2px 6px", fontSize: 10, fontFamily: "monospace", zIndex: 1 }}
                      >copy</button>
                      <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div" {...props}>
                        {String(children).replace(/\n$/, "")}
                      </SyntaxHighlighter>
                    </div>
                  ) : (
                    <code style={{ background: "rgba(0,245,255,0.1)", padding: "1px 5px", borderRadius: 3, fontSize: 12 }} {...props}>{children}</code>
                  );
                },
              }}
            >{msg.content || " "}</ReactMarkdown>
          </div>
          <div style={{ marginTop: 5, fontSize: 10, color: "rgba(148,163,184,0.38)", fontFamily: "monospace" }}>
            {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : ""}
          </div>
        </div>
        {/* Copy button on hover */}
        {hovered && msg.content && (
          <button
            onClick={() => copyText(msg.content)}
            style={{ position: "absolute", top: isUser ? 4 : 22, [isUser ? "left" : "right"]: -30, background: "rgba(15,23,42,0.9)", border: "1px solid rgba(0,245,255,0.2)", borderRadius: 6, color: "rgba(148,163,184,0.7)", cursor: "pointer", padding: "4px 5px", zIndex: 5 }}
            title="Copy message"
          >
            <Copy style={{ width: 11, height: 11 }} />
          </button>
        )}
      </div>
    </div>
  );
}

export default function ChatHub() {
  const loc = useLocation();
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [agent, setAgent] = useState("nexus-core");
  const [streaming, setStreaming] = useState(false);
  const [abortCtrl, setAbortCtrl] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [speakEnabled, setSpeakEnabled] = useState(false);
  const recognitionRef = useRef(null);
  const bottomRef = useRef();
  const inputRef = useRef();

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = "en-US";
      rec.onstart = () => setIsListening(true);
      rec.onend = () => setIsListening(false);
      rec.onresult = (e) => {
        const transcript = e.results[0][0].transcript;
        setInput(prev => prev ? prev + " " + transcript : transcript);
      };
      rec.onerror = (e) => {
        setIsListening(false);
        console.error("Speech recognition error:", e);
        if (e.error === "not-allowed") {
          toast.error("Microphone access denied. Please enable microphone permissions in your browser.");
        } else if (e.error === "no-speech") {
          toast.info("No speech detected. Please speak clearly.");
        } else if (e.error === "network") {
          toast.error("Network error. Speech recognition requires an internet connection.");
        } else {
          toast.error("Speech recognition error: " + e.error);
        }
      };
      recognitionRef.current = rec;
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
      const loadVoices = () => {
        window.speechSynthesis.getVoices();
      };
      window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
      return () => {
        window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
        window.speechSynthesis.cancel();
      };
    }
  }, []);

  const toggleListen = () => {
    if (!recognitionRef.current) {
      toast.error("Speech recognition is not supported in this browser");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  const loadSessions = useCallback(async () => {
    try { const r = await http.get("/chat/sessions"); setSessions(r.data); } catch {}
  }, []);

  const loadHistory = useCallback(async (sid) => {
    try { const r = await http.get(`/chat/history/${sid}`); setMessages(r.data); } catch {}
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { inputRef.current?.focus(); }, [sessionId]);

  // Handle ?new=1 URL param
  useEffect(() => {
    if (loc.search.includes("new=1")) newSession();
  }, []);

  const newSession = () => { setSessionId(null); setMessages([]); inputRef.current?.focus(); };

  const selectSession = (sid) => { setSessionId(sid); loadHistory(sid); };

  const deleteSession = async (e, sid) => {
    e.stopPropagation();
    setSessions(prev => prev.filter(s => s.session_id !== sid));
    if (sessionId === sid) newSession();
    toast.info("Session removed");
  };

  const stopStream = () => { abortCtrl?.abort(); setStreaming(false); toast.info("Generation stopped"); };

  const send = async () => {
    if (!input.trim() || streaming) return;
    const text = input.trim();
    setInput("");
    setStreaming(true);
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    const ctrl = new AbortController();
    setAbortCtrl(ctrl);

    const userMsg = { id: `u${Date.now()}`, role: "user", content: text, agent, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    const placeholder = { id: `a${Date.now()}`, role: "assistant", content: "", agent, timestamp: new Date().toISOString(), streaming: true };
    setMessages(prev => [...prev, placeholder]);

    let sid = sessionId;
    let fullResponseText = "";

    await streamChat({
      session_id: sid, agent, message: text,
      onMeta: m => { sid = m.session_id; setSessionId(m.session_id); },
      onDelta: c => {
        fullResponseText += c;
        setMessages(prev => prev.map(m => m.id === placeholder.id ? { ...m, content: m.content + c } : m));
      },
      onDone: () => {
        setStreaming(false);
        setMessages(prev => prev.map(m => m.id === placeholder.id ? { ...m, streaming: false } : m));
        if (speakEnabled && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
          const clean = fullResponseText
            .replace(/```[\s\S]*?```/g, "[code block]")
            .replace(/[*#`_\-]/g, "")
            .trim();
          if (clean) {
            const utterance = new SpeechSynthesisUtterance(clean);
            utterance.volume = 1.0;
            utterance.rate = 1.0;
            const voices = window.speechSynthesis.getVoices();
            if (voices && voices.length > 0) {
              utterance.voice = voices.find(v => v.lang.startsWith("en")) || voices[0];
            }
            window.speechSynthesis.speak(utterance);
          }
        }
        loadSessions();
      },
      onError: err => { setStreaming(false); toast.error("Stream error: " + err?.message); },
    });
  };

  const activeAgent = AGENTS.find(a => a.key === agent);

  return (
    <div style={{ display: "flex", gap: 16, height: "calc(100vh - 112px)" }}>
      {/* Sessions sidebar */}
      <div className="nx-glass" style={{ width: 210, borderRadius: 12, display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden" }}>
        <div style={{ padding: "11px 12px", borderBottom: "1px solid rgba(0,245,255,0.12)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span className="hud-label">SESSIONS</span>
          <button onClick={newSession} title="New session" style={{ background: "none", border: "none", cursor: "pointer", color: "#00F5FF", padding: 2, display: "flex", alignItems: "center" }}>
            <Plus style={{ width: 14, height: 14 }} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "6px 6px" }}>
          {sessions.length === 0 && (
            <div style={{ padding: "24px 8px", textAlign: "center", color: "rgba(148,163,184,0.35)", fontSize: 11, fontFamily: "monospace" }}>
              No sessions yet.<br />Send a message to start.
            </div>
          )}
          {sessions.map(s => (
            <div
              key={s.session_id}
              onClick={() => selectSession(s.session_id)}
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "8px 8px", borderRadius: 8, marginBottom: 2, cursor: "pointer", background: sessionId === s.session_id ? "rgba(0,245,255,0.1)" : "transparent", border: "1px solid", borderColor: sessionId === s.session_id ? "rgba(0,245,255,0.22)" : "transparent", transition: "all 0.15s", position: "relative" }}
              onMouseEnter={e => { if (sessionId !== s.session_id) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
              onMouseLeave={e => { if (sessionId !== s.session_id) e.currentTarget.style.background = "transparent"; }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: "#e2e8f0", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.preview || "(empty)"}</div>
                <div style={{ fontSize: 9.5, color: "rgba(148,163,184,0.4)", fontFamily: "monospace", marginTop: 2 }}>{s.messages} msgs</div>
              </div>
              <button onClick={e => deleteSession(e, s.session_id)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(148,163,184,0.3)", padding: 2, flexShrink: 0, display: "flex" }}>
                <Trash2 style={{ width: 11, height: 11 }} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Chat main */}
      <div className="nx-glass" style={{ flex: 1, borderRadius: 12, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header: agent chips */}
        <div style={{ padding: "8px 14px", borderBottom: "1px solid rgba(0,245,255,0.1)", overflowX: "auto", display: "flex", gap: 6, alignItems: "center" }}>
          <span className="hud-label" style={{ flexShrink: 0 }}>AGENT</span>
          <div style={{ display: "flex", gap: 5, flexWrap: "nowrap" }}>
            {AGENTS.map(a => (
              <button
                key={a.key}
                onClick={() => setAgent(a.key)}
                title={a.name}
                style={{
                  padding: "3px 9px", borderRadius: 20, border: `1px solid ${agent === a.key ? a.color : "rgba(255,255,255,0.1)"}`,
                  background: agent === a.key ? `${a.color}18` : "transparent",
                  color: agent === a.key ? a.color : "rgba(148,163,184,0.6)",
                  cursor: "pointer", fontSize: 10, fontFamily: "monospace", whiteSpace: "nowrap",
                  transition: "all 0.15s", flexShrink: 0,
                }}
              >
                {a.emoji} {a.name}
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {messages.length === 0 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 14, color: "rgba(148,163,184,0.4)" }}>
              <div style={{ width: 50, height: 50, borderRadius: "50%", background: `${activeAgent?.color || "#00F5FF"}15`, border: `1px solid ${activeAgent?.color || "#00F5FF"}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                {activeAgent?.emoji || "⬡"}
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 13, fontFamily: "monospace", marginBottom: 6 }}>Chat with <span style={{ color: activeAgent?.color }}>{activeAgent?.name}</span></div>
                <div style={{ fontSize: 11, color: "rgba(148,163,184,0.3)", fontFamily: "monospace" }}>Try a suggestion below</div>
              </div>
              {/* Suggestions */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", maxWidth: 420 }}>
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => { setInput(s); inputRef.current?.focus(); }}
                    style={{ padding: "5px 12px", borderRadius: 20, border: "1px solid rgba(0,245,255,0.2)", background: "rgba(0,245,255,0.05)", color: "rgba(148,163,184,0.75)", cursor: "pointer", fontSize: 11, fontFamily: "monospace", transition: "all 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "#00F5FF55"; e.currentTarget.style.color = "#00F5FF"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(0,245,255,0.2)"; e.currentTarget.style.color = "rgba(148,163,184,0.75)"; }}
                  >{s}</button>
                ))}
              </div>
            </div>
          )}
          {messages.map(m => <MsgBubble key={m.id} msg={m} />)}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ padding: "10px 14px", borderTop: "1px solid rgba(0,245,255,0.1)", display: "flex", gap: 8, alignItems: "flex-end" }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={`Message ${activeAgent?.name || "NEXUS"}… (Enter to send · Shift+Enter for newline)`}
            rows={2}
            style={{ flex: 1, background: "rgba(15,23,42,0.75)", border: "1px solid rgba(0,245,255,0.18)", borderRadius: 9, color: "#e2e8f0", padding: "9px 13px", fontSize: 13, fontFamily: "monospace", outline: "none", resize: "none", transition: "border-color 0.15s" }}
            onFocus={e => e.target.style.borderColor = "rgba(0,245,255,0.4)"}
            onBlur={e => e.target.style.borderColor = "rgba(0,245,255,0.18)"}
          />
          <button
            onClick={() => {
              const newVal = !speakEnabled;
              setSpeakEnabled(newVal);
              if (newVal) {
                if ("speechSynthesis" in window) {
                  window.speechSynthesis.cancel();
                  const utterance = new SpeechSynthesisUtterance("Voice output enabled");
                  utterance.volume = 1.0;
                  utterance.rate = 1.0;
                  const voices = window.speechSynthesis.getVoices();
                  if (voices && voices.length > 0) {
                    utterance.voice = voices.find(v => v.lang.startsWith("en")) || voices[0];
                  }
                  window.speechSynthesis.speak(utterance);
                }
              } else {
                if ("speechSynthesis" in window) {
                  window.speechSynthesis.cancel();
                }
              }
              toast.info(newVal ? "Voice output enabled" : "Voice output muted");
            }}
            style={{ padding: "10px 14px", borderRadius: 9, background: speakEnabled ? "rgba(0,245,255,0.15)" : "rgba(255,255,255,0.03)", border: `1px solid ${speakEnabled ? "rgba(0,245,255,0.3)" : "rgba(255,255,255,0.08)"}`, color: speakEnabled ? "#00F5FF" : "rgba(148,163,184,0.5)", cursor: "pointer", transition: "all 0.15s" }}
            title={speakEnabled ? "Mute voice output" : "Enable voice output"}
          >
            {speakEnabled ? <Volume2 style={{ width: 15, height: 15 }} /> : <VolumeX style={{ width: 15, height: 15 }} />}
          </button>
          <button
            onClick={toggleListen}
            style={{ padding: "10px 14px", borderRadius: 9, background: isListening ? "rgba(255,77,77,0.15)" : "rgba(255,255,255,0.03)", border: `1px solid ${isListening ? "rgba(255,77,77,0.3)" : "rgba(255,255,255,0.08)"}`, color: isListening ? "#FF4D4D" : "rgba(148,163,184,0.5)", cursor: "pointer", transition: "all 0.15s" }}
            className={isListening ? "nx-blink" : ""}
            title={isListening ? "Stop listening" : "Start voice input"}
          >
            {isListening ? <MicOff style={{ width: 15, height: 15 }} /> : <Mic style={{ width: 15, height: 15 }} />}
          </button>
          {streaming ? (
            <button onClick={stopStream} style={{ padding: "10px 14px", borderRadius: 9, background: "rgba(255,77,77,0.15)", border: "1px solid rgba(255,77,77,0.35)", color: "#FF4D4D", cursor: "pointer" }} title="Stop generation">
              <Square style={{ width: 15, height: 15 }} />
            </button>
          ) : (
            <button onClick={send} disabled={!input.trim()} style={{ padding: "10px 14px", borderRadius: 9, background: "rgba(0,245,255,0.14)", border: "1px solid rgba(0,245,255,0.3)", color: "#00F5FF", cursor: "pointer", opacity: !input.trim() ? 0.4 : 1, transition: "all 0.15s" }}>
              <Send style={{ width: 15, height: 15 }} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
