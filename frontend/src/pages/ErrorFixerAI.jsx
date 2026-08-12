import { useState, useEffect } from "react";
import {
  Bug, Zap, FileCode, CheckCircle, XCircle, Loader, ChevronDown,
  ChevronUp, Copy, AlertTriangle, ShieldCheck, Trash2,
  RefreshCw, FolderOpen, Sparkles, Clock, Brain,
  BookOpen, ToggleLeft, ToggleRight, X,
  Search, ShieldAlert, CheckCheck, Play, Filter
} from "lucide-react";
import { useErrorFixer } from "../lib/ErrorFixerContext";

const API = "http://localhost:8001/api/error-fixer";

// ─── helpers ────────────────────────────────────────────────────────
function timeSince(iso) {
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function SpeedBadge({ analysis }) {
  if (!analysis) return null;
  const src = analysis.speed_source;
  const ms  = analysis.response_ms;

  const map = {
    learned_pattern: { label: "⚡ LEARNED", color: "#34d399", bg: "rgba(52,211,153,0.12)", desc: "Instant — no LLM call" },
    memory_cache:    { label: "⚡ CACHED",  color: "#a78bfa", bg: "rgba(167,139,250,0.12)", desc: "In-memory cache hit" },
    two_stage_llm:   { label: "🔀 2-STAGE", color: "#00F5FF", bg: "rgba(0,245,255,0.10)", desc: `Smart triage + targeted fix` },
  };
  const s = map[src] || { label: "LLM", color: "#94a3b8", bg: "rgba(148,163,184,0.08)", desc: "" };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{
        fontSize: 8, fontWeight: 800, fontFamily: "monospace", letterSpacing: "0.1em",
        background: s.bg, border: `1px solid ${s.color}40`, color: s.color,
        borderRadius: 4, padding: "2px 7px",
      }} title={s.desc}>{s.label}</span>
      {ms !== undefined && (
        <span style={{ fontSize: 9, color: ms < 100 ? "#34d399" : ms < 3000 ? "#fbbf24" : "#f87171", fontFamily: "monospace" }}>
          {ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`}
        </span>
      )}
      {analysis.files_sent !== undefined && (
        <span style={{ fontSize: 9, color: "rgba(148,163,184,0.4)", fontFamily: "monospace" }}>
          · {analysis.files_sent} files sent
        </span>
      )}
    </div>
  );
}

function confidenceBadge(confidence) {
  const map = {
    high:   { bg: "rgba(52,211,153,0.12)",  border: "rgba(52,211,153,0.35)",  color: "#34d399", label: "HIGH" },
    medium: { bg: "rgba(251,191,36,0.12)",  border: "rgba(251,191,36,0.35)",  color: "#fbbf24", label: "MEDIUM" },
    low:    { bg: "rgba(239,68,68,0.12)",   border: "rgba(239,68,68,0.35)",   color: "#f87171", label: "LOW" },
  };
  const s = map[confidence] || map.low;
  return (
    <span style={{ fontSize: 9, fontFamily: "monospace", fontWeight: 700, background: s.bg, border: `1px solid ${s.border}`, color: s.color, borderRadius: 4, padding: "2px 6px", letterSpacing: "0.1em" }}>
      {s.label} CONF
    </span>
  );
}

function DiffView({ original, fixed }) {
  const [copied, setCopied] = useState(false);
  if (!original || !fixed) return null;
  const copyFixed = () => { navigator.clipboard.writeText(fixed); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 9, color: "rgba(148,163,184,0.6)", fontFamily: "monospace", letterSpacing: "0.08em" }}>ORIGINAL → FIXED</span>
        <button onClick={copyFixed} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, background: "rgba(0,245,255,0.08)", border: "1px solid rgba(0,245,255,0.2)", borderRadius: 5, padding: "3px 8px", cursor: "pointer", color: "#00F5FF", fontFamily: "monospace" }}>
          <Copy style={{ width: 10, height: 10 }} />{copied ? "Copied!" : "Copy Fixed"}
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <div style={{ fontSize: 9, color: "#f87171", fontFamily: "monospace", marginBottom: 4 }}>✕ ORIGINAL</div>
          <pre style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, padding: "10px 12px", fontSize: 11, fontFamily: "JetBrains Mono,monospace", color: "#f87171", overflowX: "auto", margin: 0, maxHeight: 200, overflowY: "auto", lineHeight: 1.6 }}>
            {original.split("\n").map((line, i) => <div key={i}><span style={{ color: "rgba(239,68,68,0.3)", marginRight: 8, fontSize: 9 }}>{String(i + 1).padStart(2, " ")}</span>{line || " "}</div>)}
          </pre>
        </div>
        <div>
          <div style={{ fontSize: 9, color: "#34d399", fontFamily: "monospace", marginBottom: 4 }}>✓ FIXED</div>
          <pre style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: 6, padding: "10px 12px", fontSize: 11, fontFamily: "JetBrains Mono,monospace", color: "#34d399", overflowX: "auto", margin: 0, maxHeight: 200, overflowY: "auto", lineHeight: 1.6 }}>
            {fixed.split("\n").map((line, i) => <div key={i}><span style={{ color: "rgba(52,211,153,0.3)", marginRight: 8, fontSize: 9 }}>{String(i + 1).padStart(2, " ")}</span>{line || " "}</div>)}
          </pre>
        </div>
      </div>
    </div>
  );
}

// ─── ErrorCard ──────────────────────────────────────────────────────
function ErrorCard({ error, analyzeError, applyFix }) {
  const [expanded, setExpanded] = useState(false);
  const [stackOpen, setStackOpen] = useState(false);

  const statusColors = { new: "#f87171", analyzing: "#fbbf24", analyzed: "#00F5FF", applying: "#c084fc", fixed: "#34d399", failed: "#f87171" };
  const statusColor = statusColors[error.status] || "#94a3b8";
  const canAnalyze = error.status === "new" || error.status === "failed";
  const canApply = error.status === "analyzed" && error.analysis?.affected_file && error.analysis?.original_snippet && error.analysis?.fixed_snippet;

  return (
    <div style={{ background: "rgba(2,6,23,0.7)", border: `1px solid ${error.status === "fixed" ? "rgba(52,211,153,0.25)" : "rgba(239,68,68,0.18)"}`, borderRadius: 10, marginBottom: 10, overflow: "hidden", transition: "all 0.3s ease" }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", cursor: "pointer" }} onClick={() => setExpanded(!expanded)}>
        <div style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, background: `rgba(${error.status === "fixed" ? "52,211,153" : "239,68,68"},0.1)`, border: `1px solid ${statusColor}40`, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
          {error.status === "fixed" ? <CheckCircle style={{ width: 12, height: 12, color: "#34d399" }} /> :
           (error.status === "analyzing" || error.status === "applying") ? <Loader style={{ width: 12, height: 12, color: statusColor, animation: "spin 1s linear infinite" }} /> :
           <Bug style={{ width: 12, height: 12, color: statusColor }} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2, flexWrap: "wrap" }}>
            <span style={{ fontSize: 9, fontFamily: "monospace", color: statusColor, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>
              {error.status === "analyzing" ? "⚙ Analyzing…" : error.status === "applying" ? "⚙ Applying…" : error.status === "fixed" ? "✓ Fixed" : error.type === "rejection" ? "Unhandled Rejection" : "Runtime Error"}
            </span>
            <span style={{ fontSize: 9, color: "rgba(148,163,184,0.4)", fontFamily: "monospace", display: "flex", alignItems: "center", gap: 3 }}><Clock style={{ width: 8, height: 8 }} />{timeSince(error.timestamp)}</span>
            {error.fileHint && <span style={{ fontSize: 9, color: "#7dd3fc", fontFamily: "monospace", background: "rgba(125,211,252,0.08)", padding: "1px 5px", borderRadius: 3 }}>{error.fileHint}</span>}
            {error.analysis && <SpeedBadge analysis={error.analysis} />}
          </div>
          <div style={{ fontSize: 12, color: "#e2e8f0", fontFamily: "monospace", lineBreak: "anywhere", lineHeight: 1.5 }}>{error.message}</div>
        </div>
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>
          {canAnalyze && (
            <button onClick={e => { e.stopPropagation(); analyzeError(error.id); }}
              style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontFamily: "monospace", background: "rgba(0,245,255,0.1)", border: "1px solid rgba(0,245,255,0.3)", borderRadius: 6, padding: "4px 10px", cursor: "pointer", color: "#00F5FF", fontWeight: 600 }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(0,245,255,0.18)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(0,245,255,0.1)"}>
              <Sparkles style={{ width: 10, height: 10 }} />AI Fix
            </button>
          )}
          {canApply && (
            <button onClick={e => { e.stopPropagation(); applyFix(error.id); }}
              style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontFamily: "monospace", background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.35)", borderRadius: 6, padding: "4px 10px", cursor: "pointer", color: "#34d399", fontWeight: 600 }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(52,211,153,0.18)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(52,211,153,0.1)"}>
              <Zap style={{ width: 10, height: 10 }} />Apply
            </button>
          )}
          {expanded ? <ChevronUp style={{ width: 13, height: 13, color: "rgba(148,163,184,0.4)" }} /> : <ChevronDown style={{ width: 13, height: 13, color: "rgba(148,163,184,0.4)" }} />}
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "12px 14px" }}>
          {error.stack && (
            <div style={{ marginBottom: 12 }}>
              <button onClick={() => setStackOpen(!stackOpen)} style={{ fontSize: 9, color: "rgba(148,163,184,0.5)", fontFamily: "monospace", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, padding: 0, marginBottom: 4 }}>
                {stackOpen ? <ChevronUp style={{ width: 9, height: 9 }} /> : <ChevronDown style={{ width: 9, height: 9 }} />}STACK TRACE
              </button>
              {stackOpen && <pre style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6, padding: "8px 10px", fontSize: 10, fontFamily: "monospace", color: "rgba(148,163,184,0.7)", overflowX: "auto", margin: 0, maxHeight: 140, overflowY: "auto", lineBreak: "anywhere" }}>{error.stack}</pre>}
            </div>
          )}

          {(error.status === "analyzing" || error.status === "applying") && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#fbbf24", fontSize: 12, fontFamily: "monospace" }}>
              <Loader style={{ width: 13, height: 13, animation: "spin 1s linear infinite" }} />
              {error.status === "analyzing" ? "Running 2-stage AI analysis (triage → targeted fix)…" : "Writing patch to disk…"}
            </div>
          )}

          {error.analysis && (
            <div style={{ background: "rgba(0,245,255,0.03)", border: "1px solid rgba(0,245,255,0.1)", borderRadius: 8, padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
                <span style={{ fontSize: 9, color: "#00F5FF", fontFamily: "monospace", letterSpacing: "0.1em", fontWeight: 700 }}>◆ AI ANALYSIS</span>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {confidenceBadge(error.analysis.confidence)}
                  {error.analysis.from_learned_pattern && (
                    <span style={{ fontSize: 8, fontFamily: "monospace", background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.3)", color: "#34d399", borderRadius: 4, padding: "2px 6px", fontWeight: 700 }}>⚡ FROM MEMORY</span>
                  )}
                  {error.analysis.from_cache && (
                    <span style={{ fontSize: 8, fontFamily: "monospace", background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.3)", color: "#a78bfa", borderRadius: 4, padding: "2px 6px", fontWeight: 700 }}>⚡ CACHED</span>
                  )}
                </div>
              </div>
              <p style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.7, margin: "0 0 10px" }}>{error.analysis.explanation}</p>
              {error.analysis.affected_file && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <FileCode style={{ width: 11, height: 11, color: "#7dd3fc" }} />
                  <span style={{ fontSize: 10, color: "#7dd3fc", fontFamily: "monospace" }}>{error.analysis.affected_file}</span>
                </div>
              )}
              {error.analysis.additional_notes && (
                <div style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)", borderRadius: 6, padding: "7px 10px", fontSize: 11, color: "#fcd34d", fontFamily: "monospace", lineHeight: 1.6, marginBottom: 10 }}>
                  ⚠ {error.analysis.additional_notes}
                </div>
              )}
              <DiffView original={error.analysis.original_snippet} fixed={error.analysis.fixed_snippet} />
            </div>
          )}

          {error.applyResult && (
            <div style={{ marginTop: 10, padding: "9px 12px", borderRadius: 7, background: error.applyResult.success ? "rgba(52,211,153,0.07)" : "rgba(239,68,68,0.07)", border: `1px solid ${error.applyResult.success ? "rgba(52,211,153,0.25)" : "rgba(239,68,68,0.25)"}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontFamily: "monospace", color: error.applyResult.success ? "#34d399" : "#f87171" }}>
                {error.applyResult.success ? <CheckCircle style={{ width: 12, height: 12 }} /> : <XCircle style={{ width: 12, height: 12 }} />}
                {error.applyResult.message}
              </div>
              {error.applyResult.backup && <div style={{ fontSize: 9, color: "rgba(148,163,184,0.4)", fontFamily: "monospace", marginTop: 4 }}>Backup: {error.applyResult.backup}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Deep Scan Panel ─────────────────────────────────────────────────
function DeepScanPanel() {
  const {
    isScanning,
    scanResults,
    scanError,
    scanProgress,
    scanProject,
    applyScanFix,
    applyAllScanFixes,
    clearScanResults,
    autoScanEnabled,
    setAutoScanEnabled,
  } = useErrorFixer();

  const [severityFilter, setSeverityFilter] = useState("all");
  const [maxFiles, setMaxFiles] = useState(40);
  const [applyingBulk, setApplyingBulk] = useState(false);
  const [bulkMessage, setBulkMessage] = useState(null);

  const handleRunScan = async () => {
    setBulkMessage(null);
    await scanProject({ maxFiles, severityFilter });
  };

  const issues = scanResults?.issues || [];
  const filteredIssues = issues.filter((i) => {
    if (severityFilter === "all") return true;
    return (i.severity || "warning").toLowerCase() === severityFilter;
  });

  const fixableIssues = filteredIssues.filter(
    (i) => !i.fixed && i.file_path && i.original_snippet && i.fixed_snippet
  );

  const handleApplyAll = async () => {
    if (fixableIssues.length === 0) return;
    setApplyingBulk(true);
    setBulkMessage(null);
    const res = await applyAllScanFixes(fixableIssues);
    setApplyingBulk(false);
    if (res) {
      setBulkMessage(`Applied ${res.applied}/${res.total} fixes successfully.`);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Control Bar */}
      <div
        style={{
          background: "rgba(2,6,23,0.7)",
          border: "1px solid rgba(0,245,255,0.18)",
          borderRadius: 10,
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "rgba(0,245,255,0.1)",
              border: "1px solid rgba(0,245,255,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Search style={{ width: 16, height: 16, color: "#00F5FF" }} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", fontFamily: "monospace" }}>
              PROACTIVE DEEP SCAN
            </div>
            <div style={{ fontSize: 9, color: "rgba(148,163,184,0.5)", fontFamily: "monospace" }}>
              Parallel LLM static analysis over project source files
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.03)", padding: "2px 4px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)" }}>
            <Filter style={{ width: 10, height: 10, color: "rgba(148,163,184,0.5)", marginLeft: 4 }} />
            {["all", "error", "warning"].map((sev) => (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                style={{
                  fontSize: 9,
                  fontFamily: "monospace",
                  textTransform: "uppercase",
                  padding: "3px 8px",
                  borderRadius: 4,
                  border: "none",
                  cursor: "pointer",
                  background: severityFilter === sev ? "rgba(0,245,255,0.15)" : "transparent",
                  color: severityFilter === sev ? "#00F5FF" : "rgba(148,163,184,0.6)",
                  fontWeight: severityFilter === sev ? 700 : 400,
                }}
              >
                {sev}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 9, fontFamily: "monospace", color: "rgba(148,163,184,0.5)" }}>Cap:</span>
            <select
              value={maxFiles}
              onChange={(e) => setMaxFiles(Number(e.target.value))}
              style={{
                background: "rgba(2,6,23,0.9)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#e2e8f0",
                fontSize: 10,
                fontFamily: "monospace",
                borderRadius: 5,
                padding: "3px 6px",
                outline: "none",
              }}
            >
              <option value={10}>10 Files</option>
              <option value={20}>20 Files</option>
              <option value={40}>40 Files</option>
              <option value={100}>100 Files</option>
            </select>
          </div>

          <button
            onClick={() => setAutoScanEnabled(!autoScanEnabled)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 10,
              fontFamily: "monospace",
              padding: "5px 10px",
              borderRadius: 6,
              border: `1px solid ${autoScanEnabled ? "rgba(0,245,255,0.4)" : "rgba(255,255,255,0.08)"}`,
              background: autoScanEnabled ? "rgba(0,245,255,0.12)" : "rgba(255,255,255,0.03)",
              color: autoScanEnabled ? "#00F5FF" : "rgba(148,163,184,0.5)",
              cursor: "pointer",
              fontWeight: autoScanEnabled ? 700 : 400,
            }}
            title="Automatically scan project every 2 minutes in background"
          >
            {autoScanEnabled ? <ToggleRight style={{ width: 13, height: 13 }} /> : <ToggleLeft style={{ width: 13, height: 13 }} />}
            Auto-Scan {autoScanEnabled ? "ON" : "OFF"}
          </button>

          <button
            onClick={handleRunScan}
            disabled={isScanning}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              fontFamily: "monospace",
              fontWeight: 700,
              background: isScanning
                ? "rgba(0,245,255,0.08)"
                : "linear-gradient(135deg, rgba(0,245,255,0.2) 0%, rgba(59,130,246,0.2) 100%)",
              border: "1px solid rgba(0,245,255,0.4)",
              borderRadius: 7,
              padding: "6px 14px",
              cursor: isScanning ? "wait" : "pointer",
              color: "#00F5FF",
              boxShadow: isScanning ? "none" : "0 0 12px rgba(0,245,255,0.15)",
            }}
          >
            {isScanning ? (
              <>
                <Loader style={{ width: 12, height: 12, animation: "spin 1s linear infinite" }} />
                Scanning…
              </>
            ) : (
              <>
                <Play style={{ width: 12, height: 12 }} />
                {scanResults ? "Re-Scan Project" : "Start Deep Scan"}
              </>
            )}
          </button>

          {scanResults && (
            <button
              onClick={clearScanResults}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "rgba(148,163,184,0.4)",
                padding: 4,
              }}
              title="Clear Scan Results"
            >
              <Trash2 style={{ width: 13, height: 13 }} />
            </button>
          )}
        </div>
      </div>

      {/* Live Progress Bar */}
      {isScanning && (
        <div
          style={{
            background: "rgba(0,245,255,0.04)",
            border: "1px solid rgba(0,245,255,0.2)",
            borderRadius: 10,
            padding: "16px 20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#00F5FF", fontFamily: "monospace", fontWeight: 700 }}>
              <Loader style={{ width: 13, height: 13, animation: "spin 1s linear infinite" }} />
              {scanProgress.message || "Scanning project source files..."}
            </div>
            <span style={{ fontSize: 10, color: "rgba(148,163,184,0.5)", fontFamily: "monospace" }}>Semaphore: 4 active LLM workers</span>
          </div>
          <div
            style={{
              width: "100%",
              height: 4,
              background: "rgba(255,255,255,0.06)",
              borderRadius: 2,
              overflow: "hidden",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                bottom: 0,
                width: "60%",
                background: "linear-gradient(90deg, #00F5FF, #3b82f6)",
                borderRadius: 2,
                animation: "errPulse 1.5s ease-in-out infinite",
              }}
            />
          </div>
        </div>
      )}

      {scanError && (
        <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "10px 14px", color: "#f87171", fontSize: 11, fontFamily: "monospace", display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle style={{ width: 14, height: 14, flexShrink: 0 }} />
          {scanError}
        </div>
      )}

      {bulkMessage && (
        <div style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.3)", borderRadius: 8, padding: "10px 14px", color: "#34d399", fontSize: 11, fontFamily: "monospace", display: "flex", alignItems: "center", gap: 8 }}>
          <CheckCircle style={{ width: 14, height: 14, flexShrink: 0 }} />
          {bulkMessage}
        </div>
      )}

      {/* Results Summary Header */}
      {scanResults && !isScanning && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "6px 14px", textAlign: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>{scanResults.files_scanned}</div>
              <div style={{ fontSize: 8, color: "rgba(148,163,184,0.5)", fontFamily: "monospace", letterSpacing: "0.08em" }}>FILES SCANNED</div>
            </div>
            <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "6px 14px", textAlign: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#f87171" }}>{scanResults.errors}</div>
              <div style={{ fontSize: 8, color: "rgba(239,68,68,0.6)", fontFamily: "monospace", letterSpacing: "0.08em" }}>ERRORS</div>
            </div>
            <div style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 8, padding: "6px 14px", textAlign: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#fbbf24" }}>{scanResults.warnings}</div>
              <div style={{ fontSize: 8, color: "rgba(251,191,36,0.6)", fontFamily: "monospace", letterSpacing: "0.08em" }}>WARNINGS</div>
            </div>
            <div style={{ background: "rgba(0,245,255,0.04)", border: "1px solid rgba(0,245,255,0.1)", borderRadius: 8, padding: "6px 14px", textAlign: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#00F5FF" }}>
                {scanResults.response_ms < 1000 ? `${scanResults.response_ms}ms` : `${(scanResults.response_ms / 1000).toFixed(1)}s`}
              </div>
              <div style={{ fontSize: 8, color: "rgba(148,163,184,0.5)", fontFamily: "monospace", letterSpacing: "0.08em" }}>SCAN TIME</div>
            </div>
          </div>

          {fixableIssues.length > 0 && (
            <button
              onClick={handleApplyAll}
              disabled={applyingBulk}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                fontFamily: "monospace",
                fontWeight: 700,
                background: "rgba(52,211,153,0.12)",
                border: "1px solid rgba(52,211,153,0.4)",
                borderRadius: 7,
                padding: "6px 14px",
                cursor: applyingBulk ? "wait" : "pointer",
                color: "#34d399",
                boxShadow: "0 0 12px rgba(52,211,153,0.15)",
              }}
            >
              {applyingBulk ? (
                <Loader style={{ width: 12, height: 12, animation: "spin 1s linear infinite" }} />
              ) : (
                <CheckCheck style={{ width: 13, height: 13 }} />
              )}
              Fix All ({fixableIssues.length})
            </button>
          )}
        </div>
      )}

      {/* Hero empty state */}
      {!scanResults && !isScanning && (
        <div
          style={{
            background: "rgba(2,6,23,0.7)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10,
            padding: "40px 20px",
            textAlign: "center",
          }}
        >
          <Search style={{ width: 36, height: 36, color: "rgba(0,245,255,0.3)", margin: "0 auto 12px" }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0", marginBottom: 6 }}>
            Ready for Deep Project Scan
          </div>
          <div style={{ fontSize: 11, color: "rgba(148,163,184,0.5)", fontFamily: "monospace", maxWidth: 460, margin: "0 auto 16px", lineHeight: 1.6 }}>
            Proactively walk all project source files and analyze code with parallel LLM agents to surface null reference vulnerabilities, uncaught promises, missing error handlers, and logic flaws before runtime.
          </div>
          <button
            onClick={handleRunScan}
            style={{
              fontSize: 11,
              fontFamily: "monospace",
              fontWeight: 700,
              background: "linear-gradient(135deg, rgba(0,245,255,0.2) 0%, rgba(59,130,246,0.2) 100%)",
              border: "1px solid rgba(0,245,255,0.4)",
              borderRadius: 7,
              padding: "8px 18px",
              cursor: "pointer",
              color: "#00F5FF",
              boxShadow: "0 0 16px rgba(0,245,255,0.15)",
            }}
          >
            Run Deep Scan Now
          </button>
        </div>
      )}

      {/* Clean state */}
      {scanResults && !isScanning && filteredIssues.length === 0 && (
        <div
          style={{
            background: "rgba(52,211,153,0.04)",
            border: "1px solid rgba(52,211,153,0.2)",
            borderRadius: 10,
            padding: "36px 20px",
            textAlign: "center",
          }}
        >
          <ShieldCheck style={{ width: 36, height: 36, color: "#34d399", margin: "0 auto 12px" }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: "#34d399", marginBottom: 4 }}>
            Clean Project Scan!
          </div>
          <div style={{ fontSize: 11, color: "rgba(148,163,184,0.5)", fontFamily: "monospace" }}>
            No {severityFilter !== "all" ? severityFilter : ""} issues detected across {scanResults.files_scanned} source files.
          </div>
        </div>
      )}

      {/* Issues list */}
      {scanResults && !isScanning && filteredIssues.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filteredIssues.map((issue) => (
            <ScanIssueCard key={issue.id || Math.random()} issue={issue} applyScanFix={applyScanFix} />
          ))}
        </div>
      )}
    </div>
  );
}

function ScanIssueCard({ issue, applyScanFix }) {
  const [expanded, setExpanded] = useState(true);
  const [applying, setApplying] = useState(false);

  const isError = (issue.severity || "warning").toLowerCase() === "error";
  const statusColor = issue.fixed ? "#34d399" : isError ? "#f87171" : "#fbbf24";
  const canApply = !issue.fixed && issue.file_path && issue.original_snippet && issue.fixed_snippet;

  const handleFixOne = async (e) => {
    e.stopPropagation();
    setApplying(true);
    await applyScanFix(issue);
    setApplying(false);
  };

  return (
    <div
      style={{
        background: "rgba(2,6,23,0.7)",
        border: `1px solid ${issue.fixed ? "rgba(52,211,153,0.25)" : isError ? "rgba(239,68,68,0.25)" : "rgba(251,191,36,0.25)"}`,
        borderRadius: 10,
        overflow: "hidden",
        transition: "all 0.2s ease",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          padding: "12px 14px",
          cursor: "pointer",
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            flexShrink: 0,
            background: `rgba(${issue.fixed ? "52,211,153" : isError ? "239,68,68" : "251,191,36"},0.12)`,
            border: `1px solid ${statusColor}50`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginTop: 2,
          }}
        >
          {issue.fixed ? (
            <CheckCircle style={{ width: 12, height: 12, color: "#34d399" }} />
          ) : isError ? (
            <ShieldAlert style={{ width: 12, height: 12, color: "#f87171" }} />
          ) : (
            <AlertTriangle style={{ width: 12, height: 12, color: "#fbbf24" }} />
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3, flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: 8,
                fontFamily: "monospace",
                fontWeight: 800,
                color: statusColor,
                background: `rgba(${issue.fixed ? "52,211,153" : isError ? "239,68,68" : "251,191,36"},0.12)`,
                border: `1px solid ${statusColor}40`,
                borderRadius: 4,
                padding: "2px 6px",
                letterSpacing: "0.08em",
              }}
            >
              {issue.fixed ? "FIXED" : (issue.severity || "WARNING").toUpperCase()}
            </span>

            {issue.file_path && (
              <span style={{ fontSize: 10, color: "#7dd3fc", fontFamily: "monospace" }}>
                {issue.file_path}
              </span>
            )}

            {issue.confidence && (
              <span style={{ fontSize: 8, fontFamily: "monospace", color: "rgba(148,163,184,0.5)", background: "rgba(255,255,255,0.04)", padding: "1px 5px", borderRadius: 3 }}>
                CONF: {issue.confidence.toUpperCase()}
              </span>
            )}
          </div>

          <div style={{ fontSize: 12, color: "#cbd5e1", fontFamily: "monospace", lineHeight: 1.5 }}>
            {issue.explanation}
          </div>
        </div>

        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>
          {canApply && (
            <button
              onClick={handleFixOne}
              disabled={applying}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 10,
                fontFamily: "monospace",
                background: "rgba(52,211,153,0.1)",
                border: "1px solid rgba(52,211,153,0.35)",
                borderRadius: 6,
                padding: "4px 10px",
                cursor: applying ? "wait" : "pointer",
                color: "#34d399",
                fontWeight: 600,
              }}
            >
              {applying ? (
                <Loader style={{ width: 10, height: 10, animation: "spin 1s linear infinite" }} />
              ) : (
                <Zap style={{ width: 10, height: 10 }} />
              )}
              Fix One
            </button>
          )}

          {expanded ? (
            <ChevronUp style={{ width: 13, height: 13, color: "rgba(148,163,184,0.4)" }} />
          ) : (
            <ChevronDown style={{ width: 13, height: 13, color: "rgba(148,163,184,0.4)" }} />
          )}
        </div>
      </div>

      {expanded && (issue.original_snippet || issue.fixed_snippet) && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "10px 14px", background: "rgba(0,0,0,0.2)" }}>
          <DiffView original={issue.original_snippet} fixed={issue.fixed_snippet} />
        </div>
      )}
    </div>
  );
}

// ─── Knowledge / Patterns Tab ────────────────────────────────────────
function PatternsPanel() {
  const [patterns, setPatterns] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadPatterns = async () => {
    setLoading(true);
    try {
      const data = await fetch(`${API}/patterns`).then(r => r.json());
      setPatterns(Array.isArray(data) ? data : []);
    } catch { setPatterns([]); } finally { setLoading(false); }
  };

  const deletePattern = async (id) => {
    await fetch(`${API}/patterns/${id}`, { method: "DELETE" }).catch(() => {});
    setPatterns(p => p.filter(x => x.id !== id));
  };

  useEffect(() => { loadPatterns(); }, []);

  return (
    <div style={{ background: "rgba(2,6,23,0.7)", border: "1px solid rgba(52,211,153,0.15)", borderRadius: 10, padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Brain style={{ width: 13, height: 13, color: "#34d399" }} />
          <span style={{ fontSize: 10, color: "#34d399", fontFamily: "monospace", letterSpacing: "0.1em", fontWeight: 700 }}>LEARNED PATTERNS ({patterns.length})</span>
        </div>
        <button onClick={loadPatterns} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(148,163,184,0.5)", padding: 0 }}>
          <RefreshCw style={{ width: 12, height: 12 }} />
        </button>
      </div>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "rgba(148,163,184,0.5)", fontFamily: "monospace" }}>
          <Loader style={{ width: 12, height: 12, animation: "spin 1s linear infinite" }} />Loading…
        </div>
      ) : patterns.length === 0 ? (
        <div style={{ textAlign: "center", padding: "24px 0" }}>
          <BookOpen style={{ width: 32, height: 32, color: "rgba(52,211,153,0.3)", margin: "0 auto 8px" }} />
          <div style={{ fontSize: 12, color: "rgba(148,163,184,0.5)", fontFamily: "monospace" }}>No patterns learned yet.</div>
          <div style={{ fontSize: 10, color: "rgba(148,163,184,0.3)", fontFamily: "monospace", marginTop: 4 }}>Apply a fix to teach the AI.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {patterns.map(p => (
            <div key={p.id} style={{ background: "rgba(52,211,153,0.04)", border: "1px solid rgba(52,211,153,0.12)", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: "#e2e8f0", fontFamily: "monospace", lineBreak: "anywhere", marginBottom: 4 }}>{p.error_message}</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {p.analysis?.affected_file && (
                      <span style={{ fontSize: 9, color: "#7dd3fc", fontFamily: "monospace" }}>{p.analysis.affected_file}</span>
                    )}
                    <span style={{ fontSize: 9, color: "rgba(148,163,184,0.4)", fontFamily: "monospace" }}>matches: {p.times_matched || 0}</span>
                    <span style={{ fontSize: 9, color: "rgba(148,163,184,0.4)", fontFamily: "monospace" }}>auto-fixed: {p.times_auto_fixed || 0}</span>
                    <span style={{ fontSize: 9, color: "rgba(148,163,184,0.3)", fontFamily: "monospace" }}>{new Date(p.learned_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <button onClick={() => deletePattern(p.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(239,68,68,0.4)", flexShrink: 0, padding: 2, transition: "color 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.color = "#f87171"} onMouseLeave={e => e.currentTarget.style.color = "rgba(239,68,68,0.4)"}>
                  <X style={{ width: 12, height: 12 }} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Files Panel ─────────────────────────────────────────────────────
function FileListPanel() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");

  const loadFiles = async () => {
    setLoading(true);
    try { const data = await fetch(`${API}/files`).then(r => r.json()); setFiles(data); }
    catch { setFiles([]); } finally { setLoading(false); }
  };

  useEffect(() => { loadFiles(); }, []);
  const filtered = filter ? files.filter(f => f.path.toLowerCase().includes(filter.toLowerCase())) : files;
  const formatSize = b => b < 1024 ? `${b}B` : b < 1024*1024 ? `${(b/1024).toFixed(1)}KB` : `${(b/1024/1024).toFixed(1)}MB`;

  return (
    <div style={{ background: "rgba(2,6,23,0.7)", border: "1px solid rgba(0,245,255,0.12)", borderRadius: 10, padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <FolderOpen style={{ width: 13, height: 13, color: "#00F5FF" }} />
          <span style={{ fontSize: 10, color: "#00F5FF", fontFamily: "monospace", letterSpacing: "0.1em", fontWeight: 700 }}>AI FILE ACCESS ({files.length})</span>
        </div>
        <button onClick={loadFiles} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(148,163,184,0.5)", padding: 0 }}><RefreshCw style={{ width: 12, height: 12 }} /></button>
      </div>
      <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter files…" style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "6px 10px", fontSize: 11, fontFamily: "monospace", color: "#e2e8f0", outline: "none", boxSizing: "border-box", marginBottom: 8 }} />
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "rgba(148,163,184,0.5)", fontFamily: "monospace" }}><Loader style={{ width: 12, height: 12, animation: "spin 1s linear infinite" }} />Loading…</div>
      ) : (
        <div style={{ maxHeight: 260, overflowY: "auto" }}>
          {filtered.map(f => (
            <div key={f.path} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 6px", borderRadius: 4, marginBottom: 1, transition: "background 0.12s" }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(0,245,255,0.05)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <span style={{ fontSize: 10, fontFamily: "monospace", color: "rgba(148,163,184,0.75)", lineBreak: "anywhere" }}>{f.path}</span>
              <span style={{ fontSize: 9, fontFamily: "monospace", color: "rgba(148,163,184,0.3)", flexShrink: 0, marginLeft: 8 }}>{formatSize(f.size)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Urban AI Telemetry Panel ─────────────────────────────────────────
function UrbanAIPanel() {
  const { urbanTelemetry, fetchUrbanTelemetry } = useErrorFixer();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [responses, setResponses] = useState([]);

  const handleQuery = async (queryText) => {
    const q = queryText || query;
    if (!q) return;
    setQuery("");
    setLoading(true);

    try {
      const resp = await fetch("http://localhost:8001/api/urban/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q,
          operator_name: "ErrorFixer System",
          cctv_active: urbanTelemetry?.cctv_active || 184,
          cctv_total: urbanTelemetry?.cctv_total || 200,
          incidents_count: 0,
        }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const text = await resp.text();
      setResponses((prev) => [{ query: q, text, time: new Date().toLocaleTimeString() }, ...prev]);
    } catch (e) {
      setResponses((prev) => [{ query: q, text: `⚠️ Error connecting to Urban AI: ${e.message}`, time: new Date().toLocaleTimeString() }, ...prev]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Header Banner */}
      <div
        style={{
          background: "rgba(2,6,23,0.7)",
          border: "1px solid rgba(167,139,250,0.25)",
          borderRadius: 10,
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: "rgba(167,139,250,0.12)",
              border: "1px solid rgba(167,139,250,0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 16px rgba(167,139,250,0.15)",
            }}
          >
            <Brain style={{ width: 20, height: 20, color: "#a78bfa" }} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", fontFamily: "monospace" }}>
              NEXUS URBAN AI CORE INTEGRATION
            </div>
            <div style={{ fontSize: 10, color: "rgba(148,163,184,0.5)", fontFamily: "monospace" }}>
              Bidirectional sync: City Telemetry ↔ Error Fixer AI & Static Analysis
            </div>
          </div>
        </div>

        <button
          onClick={fetchUrbanTelemetry}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 10,
            fontFamily: "monospace",
            background: "rgba(167,139,250,0.08)",
            border: "1px solid rgba(167,139,250,0.25)",
            borderRadius: 6,
            padding: "5px 10px",
            cursor: "pointer",
            color: "#a78bfa",
          }}
        >
          <RefreshCw style={{ width: 11, height: 11 }} /> Sync Urban AI
        </button>
      </div>

      {/* Telemetry Metric Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
        <div style={{ background: "rgba(2,6,23,0.7)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: 8, padding: "12px 14px" }}>
          <div style={{ fontSize: 9, color: "rgba(148,163,184,0.5)", fontFamily: "monospace", letterSpacing: "0.08em" }}>WEATHER TELEMETRY</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#34d399", margin: "4px 0 2px" }}>
            {urbanTelemetry?.weather || "Partly Cloudy"} ({urbanTelemetry?.temp ?? 22.4}°C)
          </div>
          <div style={{ fontSize: 9, color: "rgba(148,163,184,0.4)", fontFamily: "monospace" }}>
            Feels like {urbanTelemetry?.feels_like ?? 23}°C · Humidity {urbanTelemetry?.humidity ?? 58}%
          </div>
        </div>

        <div style={{ background: "rgba(2,6,23,0.7)", border: "1px solid rgba(0,245,255,0.2)", borderRadius: 8, padding: "12px 14px" }}>
          <div style={{ fontSize: 9, color: "rgba(148,163,184,0.5)", fontFamily: "monospace", letterSpacing: "0.08em" }}>AIR QUALITY INDEX</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#00F5FF", margin: "4px 0 2px" }}>
            AQI {urbanTelemetry?.aqi ?? 42} ({urbanTelemetry?.aqi_category || "Good"})
          </div>
          <div style={{ fontSize: 9, color: "rgba(148,163,184,0.4)", fontFamily: "monospace" }}>
            PM2.5 Nominal · Sensors Calibrated
          </div>
        </div>

        <div style={{ background: "rgba(2,6,23,0.7)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 8, padding: "12px 14px" }}>
          <div style={{ fontSize: 9, color: "rgba(148,163,184,0.5)", fontFamily: "monospace", letterSpacing: "0.08em" }}>CCTV ANOMALY NODES</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#fbbf24", margin: "4px 0 2px" }}>
            {urbanTelemetry?.cctv_active ?? 184} / {urbanTelemetry?.cctv_total ?? 200} Online
          </div>
          <div style={{ fontSize: 9, color: "rgba(148,163,184,0.4)", fontFamily: "monospace" }}>
            Security feeds synced with Error Fixer
          </div>
        </div>

        <div style={{ background: "rgba(2,6,23,0.7)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "12px 14px" }}>
          <div style={{ fontSize: 9, color: "rgba(148,163,184,0.5)", fontFamily: "monospace", letterSpacing: "0.08em" }}>311 CITIZEN DISPATCH</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#f87171", margin: "4px 0 2px" }}>
            {urbanTelemetry?.open_complaints ?? 4} Pending
          </div>
          <div style={{ fontSize: 9, color: "rgba(148,163,184,0.4)", fontFamily: "monospace" }}>
            Critical: {urbanTelemetry?.critical_complaints ?? 0}
          </div>
        </div>
      </div>

      {/* Urban AI Query Console */}
      <div style={{ background: "rgba(2,6,23,0.7)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 10, padding: "14px 16px" }}>
        <div style={{ fontSize: 10, color: "#a78bfa", fontFamily: "monospace", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 10 }}>
          DIRECT URBAN AI SWARM CORE QUERY
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleQuery()}
            placeholder="Ask Urban AI about system health, code errors, or telemetry..."
            style={{
              flex: 1,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 6,
              padding: "8px 12px",
              fontSize: 11,
              fontFamily: "monospace",
              color: "#e2e8f0",
              outline: "none",
            }}
          />
          <button
            onClick={() => handleQuery()}
            disabled={loading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              fontFamily: "monospace",
              fontWeight: 700,
              background: "rgba(167,139,250,0.15)",
              border: "1px solid rgba(167,139,250,0.4)",
              borderRadius: 6,
              padding: "8px 14px",
              cursor: loading ? "wait" : "pointer",
              color: "#a78bfa",
            }}
          >
            {loading ? <Loader style={{ width: 12, height: 12, animation: "spin 1s linear infinite" }} /> : <Sparkles style={{ width: 12, height: 12 }} />}
            Query
          </button>
        </div>

        {/* Quick Prompts */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          {[
            "Check system errors",
            "Deep scan codebase status",
            "City telemetry summary",
            "CCTV anomalies & safety",
          ].map((prompt) => (
            <button
              key={prompt}
              onClick={() => handleQuery(prompt)}
              style={{
                fontSize: 9,
                fontFamily: "monospace",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 4,
                padding: "3px 8px",
                color: "rgba(148,163,184,0.6)",
                cursor: "pointer",
              }}
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Response History */}
        {responses.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 280, overflowY: "auto" }}>
            {responses.map((r, i) => (
              <div key={i} style={{ background: "rgba(167,139,250,0.04)", border: "1px solid rgba(167,139,250,0.15)", borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 9, color: "#a78bfa", fontFamily: "monospace", fontWeight: 700 }}>Q: {r.query}</span>
                  <span style={{ fontSize: 8, color: "rgba(148,163,184,0.4)", fontFamily: "monospace" }}>{r.time}</span>
                </div>
                <div style={{ fontSize: 11, color: "#e2e8f0", fontFamily: "monospace", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                  {r.text}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────
export default function ErrorFixerAI() {
  const {
    errors, clearErrors, analyzeError, applyFix,
    autoLearnEnabled, setAutoLearnEnabled,
    autoApplyEnabled, setAutoApplyEnabled,
    autoScanEnabled, setAutoScanEnabled,
    autoFixErrorEnabled, setAutoFixErrorEnabled,
    newErrorCount
  } = useErrorFixer();
  const [activeTab, setActiveTab] = useState("errors");
  const [testingError, setTestingError] = useState(false);

  // Speed stats
  const analyzed = errors.filter(e => e.analysis);
  const avgMs = analyzed.length ? Math.round(analyzed.reduce((s, e) => s + (e.analysis?.response_ms || 0), 0) / analyzed.length) : 0;
  const fromMemory = analyzed.filter(e => e.analysis?.speed_source !== "two_stage_llm").length;

  const triggerTestError = () => {
    setTestingError(true);
    setTimeout(() => {
      try { const x = null; x.nonExistent.call(); } catch (e) {
        window.dispatchEvent(Object.assign(new ErrorEvent("error", { message: e.message, error: e, bubbles: true })));
      }
      setTestingError(false);
    }, 200);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <style>{`
        @keyframes spin { from{transform:rotate(0deg)}to{transform:rotate(360deg)} }
        @keyframes errPulse { 0%,100%{opacity:1}50%{opacity:0.5} }
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(0,245,255,0.2);border-radius:2px}
      `}</style>

      {/* Header */}
      <div style={{ background: "rgba(2,6,23,0.8)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: "16px 20px", marginBottom: 14, backgroundImage: "linear-gradient(135deg,rgba(239,68,68,0.04) 0%,transparent 60%)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 18px rgba(239,68,68,0.15)" }}>
              <Bug style={{ width: 20, height: 20, color: "#f87171" }} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1.1 }}>Error Fixer <span style={{ color: "#f87171" }}>AI</span></h1>
              <p style={{ margin: "3px 0 0", fontSize: 10, color: "rgba(148,163,184,0.5)", fontFamily: "monospace" }}>2-stage analysis · auto-fix · auto-scan · instant recall</p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {newErrorCount > 0 && (
              <div style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 20, padding: "3px 10px", display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#f87171", display: "inline-block", animation: "errPulse 1.2s ease-in-out infinite" }} />
                <span style={{ fontSize: 10, color: "#f87171", fontFamily: "monospace", fontWeight: 700 }}>{newErrorCount} NEW</span>
              </div>
            )}
            <button onClick={triggerTestError} disabled={testingError} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontFamily: "monospace", background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 6, padding: "5px 10px", cursor: "pointer", color: "#fbbf24" }}>
              <AlertTriangle style={{ width: 9, height: 9 }} />Test Error
            </button>
            {errors.length > 0 && (
              <button onClick={clearErrors} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontFamily: "monospace", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "5px 10px", cursor: "pointer", color: "rgba(148,163,184,0.5)" }}
                onMouseEnter={e => { e.currentTarget.style.color = "#f87171"; }} onMouseLeave={e => { e.currentTarget.style.color = "rgba(148,163,184,0.5)"; }}>
                <Trash2 style={{ width: 9, height: 9 }} />Clear
              </button>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
          {[
            { label: "TOTAL", val: errors.length, color: "#94a3b8" },
            { label: "NEW", val: newErrorCount, color: "#f87171" },
            { label: "FIXED", val: errors.filter(e => e.status === "fixed").length, color: "#34d399" },
          ].map(s => (
            <div key={s.label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 7, padding: "5px 12px", textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: 8, color: "rgba(148,163,184,0.4)", fontFamily: "monospace", letterSpacing: "0.08em" }}>{s.label}</div>
            </div>
          ))}

          {/* Speed stats */}
          {analyzed.length > 0 && (
            <>
              <div style={{ background: "rgba(0,245,255,0.04)", border: "1px solid rgba(0,245,255,0.1)", borderRadius: 7, padding: "5px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: avgMs < 1000 ? "#34d399" : "#fbbf24" }}>{avgMs < 1000 ? `${avgMs}ms` : `${(avgMs / 1000).toFixed(1)}s`}</div>
                <div style={{ fontSize: 8, color: "rgba(148,163,184,0.4)", fontFamily: "monospace", letterSpacing: "0.1em" }}>AVG RESP</div>
              </div>
              <div style={{ background: "rgba(52,211,153,0.04)", border: "1px solid rgba(52,211,153,0.1)", borderRadius: 7, padding: "5px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#34d399" }}>{fromMemory}</div>
                <div style={{ fontSize: 8, color: "rgba(148,163,184,0.4)", fontFamily: "monospace", letterSpacing: "0.1em" }}>FROM CACHE</div>
              </div>
            </>
          )}

          {/* Toggles */}
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {[
              { label: "Auto-Learn", val: autoLearnEnabled, set: setAutoLearnEnabled, color: "#34d399" },
              {
                label: "Auto-Fix",
                val: autoFixErrorEnabled || autoApplyEnabled,
                set: (val) => {
                  setAutoFixErrorEnabled(val);
                  setAutoApplyEnabled(val);
                },
                color: "#a78bfa"
              },
              { label: "Auto-Scan (2m)", val: autoScanEnabled, set: setAutoScanEnabled, color: "#00F5FF" },
            ].map(t => (
              <button key={t.label} onClick={() => t.set(!t.val)}
                style={{ display: "flex", alignItems: "center", gap: 5, background: t.val ? `rgba(${t.color === "#34d399" ? "52,211,153" : t.color === "#00F5FF" ? "0,245,255" : "167,139,250"},0.1)` : "rgba(255,255,255,0.03)", border: `1px solid ${t.val ? `${t.color}50` : "rgba(255,255,255,0.08)"}`, borderRadius: 7, padding: "5px 10px", cursor: "pointer", color: t.val ? t.color : "rgba(148,163,184,0.4)", fontSize: 10, fontFamily: "monospace", transition: "all 0.15s", fontWeight: t.val ? 700 : 400 }}>
                {t.val ? <ToggleRight style={{ width: 13, height: 13 }} /> : <ToggleLeft style={{ width: 13, height: 13 }} />}
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Speed source legend */}
        <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
          {[
            { src: "⚡ LEARNED", color: "#34d399", desc: "Instant — matched a stored pattern" },
            { src: "⚡ CACHED",  color: "#a78bfa", desc: "Same session repeat" },
            { src: "🔀 2-STAGE", color: "#00F5FF", desc: "Triage LLM → targeted fix LLM" },
          ].map(l => (
            <span key={l.src} style={{ fontSize: 9, fontFamily: "monospace", color: "rgba(148,163,184,0.45)", display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ color: l.color, fontWeight: 700 }}>{l.src}</span> {l.desc}
            </span>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
        {[
          { key: "errors", label: "Error Feed", icon: Bug },
          { key: "scan", label: "🔍 Deep Scan", icon: Search },
          { key: "urban", label: "🏙️ Urban AI", icon: Brain },
          { key: "patterns", label: "AI Memory", icon: Brain },
          { key: "files", label: "File Access", icon: FolderOpen },
        ].map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontFamily: "monospace", background: active ? "rgba(0,245,255,0.09)" : "rgba(255,255,255,0.03)", border: active ? "1px solid rgba(0,245,255,0.28)" : "1px solid rgba(255,255,255,0.08)", borderRadius: 7, padding: "6px 12px", cursor: "pointer", color: active ? "#00F5FF" : "rgba(148,163,184,0.6)", fontWeight: active ? 700 : 400, letterSpacing: "0.06em", textTransform: "uppercase", boxShadow: active ? "0 0 12px rgba(0,245,255,0.1)" : "none" }}>
              <Icon style={{ width: 10, height: 10 }} />{tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {activeTab === "errors" && (
          errors.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 20px", gap: 12 }}>
              <div style={{ width: 60, height: 60, borderRadius: 14, background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ShieldCheck style={{ width: 28, height: 28, color: "#34d399" }} />
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#34d399", marginBottom: 4 }}>All Systems Nominal</div>
                <div style={{ fontSize: 11, color: "rgba(148,163,184,0.5)", fontFamily: "monospace" }}>No errors. Click "Test Error" to simulate one.</div>
              </div>
            </div>
          ) : (
            errors.map(err => <ErrorCard key={err.id} error={err} analyzeError={analyzeError} applyFix={applyFix} />)
          )
        )}
        {activeTab === "scan" && <DeepScanPanel />}
        {activeTab === "urban" && <UrbanAIPanel />}
        {activeTab === "patterns" && <PatternsPanel />}
        {activeTab === "files" && <FileListPanel />}
      </div>
    </div>
  );
}
