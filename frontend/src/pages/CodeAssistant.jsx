import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { http } from "../lib/api";
import { toast } from "../components/Toast";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";
import { Code2, Play, Loader, Copy, Trash2, Wand2 } from "lucide-react";

const LANGS = ["python", "javascript", "typescript", "bash", "go", "rust", "java", "cpp", "sql", "html", "css", "json", "yaml", "markdown"];
const ACTIONS = [
  { key: "generate",  label: "Generate",  color: "#00FF88", hint: "Describe what to build" },
  { key: "explain",   label: "Explain",   color: "#00F5FF", hint: "Paste code to explain" },
  { key: "debug",     label: "Debug",     color: "#FF4D4D", hint: "Paste buggy code" },
  { key: "refactor",  label: "Refactor",  color: "#6E56FF", hint: "Paste code to improve" },
  { key: "test",      label: "Test",      color: "#FFC857", hint: "Paste code to test" },
  { key: "document",  label: "Document",  color: "#FF2E88", hint: "Paste code to document" },
];

// Detect language from code snippet
function detectLang(code) {
  if (/^\s*(import|from|def |class |if __name__)/.test(code)) return "python";
  if (/^\s*(const|let|var|function|import|export|=>)/.test(code)) return "javascript";
  if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE)/i.test(code)) return "sql";
  if (/^\s*(<html|<!DOCTYPE)/i.test(code)) return "html";
  if (/^\s*(package main|func |import \()/.test(code)) return "go";
  if (/^\s*(fn |use |let mut|struct |impl )/.test(code)) return "rust";
  return null;
}

export default function CodeAssistant() {
  const loc = useLocation();
  const [code, setCode] = useState("");
  const [prompt, setPrompt] = useState("");
  const [language, setLanguage] = useState("python");
  const [action, setAction] = useState("generate");
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);

  // Handle ?action= URL param
  useEffect(() => {
    const sp = new URLSearchParams(loc.search);
    const act = sp.get("action");
    if (act && ACTIONS.find(a => a.key === act)) setAction(act);
  }, []);

  // Auto-detect language when code is pasted
  const onCodeChange = (e) => {
    const val = e.target.value;
    setCode(val);
    if (val.length > 20) {
      const detected = detectLang(val);
      if (detected) setLanguage(detected);
    }
  };

  const run = async () => {
    if (running) return;
    if (action === "generate" && !prompt.trim()) { toast.error("Enter a prompt to generate code"); return; }
    if (action !== "generate" && !code.trim()) { toast.error("Paste code first"); return; }
    setRunning(true); setOutput("");
    try {
      const r = await http.post("/code/run", { code, prompt, language, action });
      setOutput(r.data.output);
      toast.success("Done!");
    } catch { toast.error("Backend error — is FastAPI running?"); setOutput("Error: Could not reach backend."); }
    setRunning(false);
  };

  const copyOutput = () => {
    if (!output) return;
    navigator.clipboard.writeText(output).then(() => toast.success("Output copied")).catch(() => toast.error("Copy failed"));
  };

  const activeAction = ACTIONS.find(a => a.key === action);
  const selStyle = { background: "rgba(15,23,42,0.8)", border: "1px solid rgba(0,245,255,0.2)", borderRadius: 7, color: "#e2e8f0", padding: "6px 10px", fontSize: 11, fontFamily: "monospace", outline: "none", cursor: "pointer" };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 112px)" }}>
      <div style={{ marginBottom: 14 }}>
        <div className="hud-label" style={{ marginBottom: 4 }}>CODE ASSISTANT</div>
        <h1 className="font-display nx-neon-cyan" style={{ fontSize: 26, fontWeight: 800 }}>AI Code Studio</h1>
      </div>

      {/* Controls bar */}
      <div className="nx-glass" style={{ borderRadius: 12, padding: "10px 14px", marginBottom: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <select value={language} onChange={e => setLanguage(e.target.value)} style={selStyle}>
          {LANGS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.1)" }} />
        {/* Action buttons */}
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {ACTIONS.map(a => (
            <button key={a.key} onClick={() => setAction(a.key)} title={a.hint}
              style={{ padding: "5px 12px", borderRadius: 6, fontSize: 11, fontFamily: "monospace", cursor: "pointer", background: action === a.key ? `${a.color}20` : "transparent", border: `1px solid ${action === a.key ? a.color : "rgba(255,255,255,0.1)"}`, color: action === a.key ? a.color : "rgba(148,163,184,0.7)", transition: "all 0.15s" }}
            >{a.label}</button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 7 }}>
          <button onClick={() => { setCode(""); setPrompt(""); setOutput(""); }} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 7, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(148,163,184,0.55)", cursor: "pointer", fontSize: 11, fontFamily: "monospace" }}>
            <Trash2 style={{ width: 12, height: 12 }} /> Clear
          </button>
          <button onClick={run} disabled={running}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 18px", borderRadius: 7, background: `${activeAction?.color || "#00F5FF"}18`, border: `1px solid ${activeAction?.color || "#00F5FF"}44`, color: activeAction?.color || "#00F5FF", cursor: "pointer", fontSize: 12, fontFamily: "monospace", opacity: running ? 0.6 : 1, transition: "all 0.15s" }}
          >
            {running ? <Loader style={{ width: 13, height: 13, animation: "nx-spin-slow 1s linear infinite" }} /> : <Wand2 style={{ width: 13, height: 13 }} />}
            {running ? "Working…" : "Run"}
          </button>
        </div>
      </div>

      {/* Action hint */}
      <div style={{ marginBottom: 10, fontSize: 11, color: "rgba(148,163,184,0.5)", fontFamily: "monospace", display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ color: activeAction?.color, fontSize: 10 }}>●</span>
        <span>{activeAction?.hint}</span>
        {action !== "generate" && code.length > 20 && detectLang(code) && (
          <span style={{ marginLeft: "auto", fontSize: 10, color: "#00FF88" }}>📌 auto-detected: {detectLang(code)}</span>
        )}
      </div>

      {/* Split panes */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, minHeight: 0 }}>
        {/* Input */}
        <div className="nx-glass" style={{ borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "8px 14px", borderBottom: "1px solid rgba(0,245,255,0.1)", display: "flex", alignItems: "center", gap: 6 }}>
            <span className="hud-label">{action === "generate" ? "PROMPT" : `CODE INPUT (${language})`}</span>
          </div>
          {action === "generate" ? (
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) run(); }}
              placeholder={`Describe what to generate in ${language}… (Ctrl+Enter to run)`}
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", padding: "14px 16px", color: "#e2e8f0", fontSize: 13, fontFamily: "'JetBrains Mono',monospace", resize: "none", lineHeight: 1.6 }}
            />
          ) : (
            <textarea
              value={code}
              onChange={onCodeChange}
              onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) run(); }}
              placeholder={`Paste your ${language} code here… (Ctrl+Enter to run)`}
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", padding: "14px 16px", color: "#e2e8f0", fontSize: 12, fontFamily: "'JetBrains Mono',monospace", resize: "none", lineHeight: 1.65, tabSize: 2 }}
              spellCheck={false}
            />
          )}
        </div>

        {/* Output */}
        <div className="nx-glass" style={{ borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "8px 14px", borderBottom: "1px solid rgba(0,245,255,0.1)", display: "flex", alignItems: "center", gap: 8 }}>
            <span className="hud-label">OUTPUT</span>
            {running && <Loader style={{ width: 11, height: 11, color: "#00F5FF", animation: "nx-spin-slow 1s linear infinite" }} />}
            {output && (
              <button onClick={copyOutput} style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, background: "rgba(0,245,255,0.08)", border: "1px solid rgba(0,245,255,0.2)", borderRadius: 5, color: "#00F5FF", cursor: "pointer", padding: "3px 9px", fontSize: 10, fontFamily: "monospace" }}>
                <Copy style={{ width: 10, height: 10 }} /> copy
              </button>
            )}
          </div>
          <div className="nx-md" style={{ flex: 1, overflowY: "auto", padding: "14px 16px", fontSize: 12, color: "#cbd5e1" }}>
            {output ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node, inline, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || "");
                    return !inline && match ? (
                      <div style={{ position: "relative" }}>
                        <button onClick={() => { navigator.clipboard.writeText(String(children)); toast.success("Code copied"); }}
                          style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,245,255,0.1)", border: "1px solid rgba(0,245,255,0.2)", borderRadius: 4, color: "#00F5FF", cursor: "pointer", padding: "2px 6px", fontSize: 10, fontFamily: "monospace", zIndex: 1 }}>
                          copy
                        </button>
                        <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div" {...props}>
                          {String(children).replace(/\n$/, "")}
                        </SyntaxHighlighter>
                      </div>
                    ) : (
                      <code style={{ background: "rgba(0,245,255,0.1)", padding: "1px 5px", borderRadius: 3 }} {...props}>{children}</code>
                    );
                  },
                }}
              >{output}</ReactMarkdown>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "rgba(148,163,184,0.28)", gap: 8 }}>
                <Code2 style={{ width: 32, height: 32, opacity: 0.28 }} />
                <span style={{ fontSize: 12, fontFamily: "monospace" }}>Output will appear here</span>
                <span style={{ fontSize: 10, fontFamily: "monospace", opacity: 0.6 }}>Ctrl+Enter to run</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
