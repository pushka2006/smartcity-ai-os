import { useState } from "react";
import { http } from "../lib/api";
import { toast } from "../components/Toast";
import ReactMarkdown from "react-markdown";
import { Globe, Play, Loader, Copy, RefreshCw } from "lucide-react";

const PRESETS = [
  { label: "Google News", goal: "Go to Google, search for 'AI news today', extract the top 5 headlines and their URLs", url: "https://google.com" },
  { label: "GitHub Search", goal: "Search GitHub for 'fastapi' repositories, get the top 5 by stars, extract name, description and star count", url: "https://github.com" },
  { label: "Extract Links", goal: "Navigate to the page and extract all external links, their text and href values", url: "" },
  { label: "Form Fill", goal: "Fill out the contact form: name='Test User', email='test@example.com', message='Hello world', then submit", url: "" },
  { label: "Scrape Table", goal: "Find all tables on the page and extract their data as structured JSON", url: "" },
  { label: "Take Screenshot", goal: "Navigate to the page and describe what you see visually: layout, colors, main content areas", url: "" },
];

export default function BrowserConsole() {
  const [goal, setGoal] = useState("");
  const [startUrl, setStartUrl] = useState("");
  const [plan, setPlan] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchResult, setFetchResult] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [activeTab, setActiveTab] = useState("metadata");

  const generate = async () => {
    if (!goal.trim()) { toast.error("Please describe a goal"); return; }
    setLoading(true); setPlan("");
    try {
      const r = await http.post("/browser/plan", { goal, start_url: startUrl || undefined });
      setPlan(r.data.plan);
    } catch { toast.error("Failed to generate plan — is the backend running?"); setPlan(""); }
    setLoading(false);
  };

  const fetchPage = async () => {
    if (!startUrl.trim()) { toast.error("Please enter a Start URL to fetch"); return; }
    setFetching(true); setFetchResult(null);
    try {
      const r = await http.get(`/browser/fetch?url=${encodeURIComponent(startUrl)}`);
      setFetchResult(r.data);
      toast.success("Page fetched successfully!");
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to fetch page — verify the URL and backend status";
      toast.error(msg);
      setFetchResult(null);
    }
    setFetching(false);
  };

  const copyPlan = () => {
    if (!plan) return;
    navigator.clipboard.writeText(plan).then(() => toast.success("Plan copied to clipboard")).catch(() => toast.error("Copy failed"));
  };

  const inputStyle = { width: "100%", background: "rgba(15,23,42,0.8)", border: "1px solid rgba(0,245,255,0.2)", borderRadius: 8, color: "#e2e8f0", padding: "10px 14px", fontSize: 12, fontFamily: "monospace", outline: "none", transition: "border-color 0.15s" };
  const focusStyle = { borderColor: "rgba(0,245,255,0.4)" };
  const blurStyle  = { borderColor: "rgba(0,245,255,0.2)" };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div className="hud-label" style={{ marginBottom: 4 }}>BROWSER AGENT</div>
        <h1 className="font-display nx-neon-cyan" style={{ fontSize: 26, fontWeight: 800 }}>Browser Automation Planner</h1>
        <p style={{ marginTop: 4, fontSize: 11, color: "rgba(148,163,184,0.5)", fontFamily: "monospace" }}>
          Describe a task → AI generates a Playwright step-by-step automation plan or fetch direct page elements.
        </p>
      </div>

      {/* Preset chips */}
      <div className="nx-glass" style={{ borderRadius: 12, padding: "12px 16px", marginBottom: 16 }}>
        <div className="hud-label" style={{ marginBottom: 8 }}>QUICK PRESETS</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          {PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => { setGoal(p.goal); setStartUrl(p.url); toast.info(`Loaded: ${p.label}`); }}
              style={{ padding: "5px 12px", borderRadius: 20, border: "1px solid rgba(0,245,255,0.2)", background: "rgba(0,245,255,0.05)", color: "rgba(148,163,184,0.75)", cursor: "pointer", fontSize: 11, fontFamily: "monospace", transition: "all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#00F5FF55"; e.currentTarget.style.color = "#00F5FF"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(0,245,255,0.2)"; e.currentTarget.style.color = "rgba(148,163,184,0.75)"; }}
            >
              <Globe style={{ width: 10, height: 10, display: "inline", marginRight: 4, verticalAlign: "middle" }} />
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="nx-glass" style={{ borderRadius: 12, padding: "18px 20px", marginBottom: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label className="hud-label" style={{ display: "block", marginBottom: 5 }}>AUTOMATION GOAL</label>
            <textarea
              value={goal}
              onChange={e => setGoal(e.target.value)}
              placeholder="e.g. Search for 'AI news' on Google, extract the top 5 headlines and their links"
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
              onFocus={e => e.target.style.borderColor = focusStyle.borderColor}
              onBlur={e => e.target.style.borderColor = blurStyle.borderColor}
            />
          </div>
          <div>
            <label className="hud-label" style={{ display: "block", marginBottom: 5 }}>START URL <span style={{ color: "rgba(148,163,184,0.4)", fontSize: 10 }}>(required for Direct Fetch, optional for planning)</span></label>
            <input
              value={startUrl}
              onChange={e => setStartUrl(e.target.value)}
              placeholder="https://…"
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = focusStyle.borderColor}
              onBlur={e => e.target.style.borderColor = blurStyle.borderColor}
            />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={generate}
              disabled={loading || !goal.trim()}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 24px", borderRadius: 9, background: "rgba(0,245,255,0.14)", border: "1px solid rgba(0,245,255,0.35)", color: "#00F5FF", cursor: "pointer", fontSize: 13, fontFamily: "monospace", opacity: loading || !goal.trim() ? 0.5 : 1, transition: "all 0.15s" }}
            >
              {loading ? <Loader style={{ width: 14, height: 14, animation: "nx-spin-slow 1s linear infinite" }} /> : <Play style={{ width: 14, height: 14 }} />}
              {loading ? "Generating Plan…" : "Generate Plan"}
            </button>

            <button
              onClick={fetchPage}
              disabled={fetching || !startUrl.trim()}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 24px", borderRadius: 9, background: "rgba(0,255,136,0.12)", border: "1px solid rgba(0,255,136,0.35)", color: "#00FF88", cursor: "pointer", fontSize: 13, fontFamily: "monospace", opacity: fetching || !startUrl.trim() ? 0.5 : 1, transition: "all 0.15s" }}
            >
              {fetching ? <Loader style={{ width: 14, height: 14, animation: "nx-spin-slow 1s linear infinite" }} /> : <Globe style={{ width: 14, height: 14 }} />}
              {fetching ? "Fetching Page…" : "Fetch Live Content"}
            </button>

            {(plan || fetchResult) && (
              <button onClick={() => { setPlan(""); setFetchResult(null); setGoal(""); setStartUrl(""); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 14px", borderRadius: 9, background: "none", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(148,163,184,0.6)", cursor: "pointer", fontSize: 12, fontFamily: "monospace" }}>
                <RefreshCw style={{ width: 13, height: 13 }} /> Clear
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {plan && (
          <div className="nx-glass nx-fadein" style={{ borderRadius: 12, padding: "16px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Globe style={{ width: 13, height: 13, color: "#00F5FF" }} />
                <span className="hud-label">AUTOMATION PLAN</span>
              </div>
              <button
                onClick={copyPlan}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 7, background: "rgba(0,245,255,0.08)", border: "1px solid rgba(0,245,255,0.2)", color: "#00F5FF", cursor: "pointer", fontSize: 11, fontFamily: "monospace" }}
              >
                <Copy style={{ width: 11, height: 11 }} /> Copy Plan
              </button>
            </div>
            <div className="nx-md" style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.7 }}>
              <ReactMarkdown>{plan}</ReactMarkdown>
            </div>
          </div>
        )}

        {fetchResult && (
          <div className="nx-glass nx-fadein" style={{ borderRadius: 12, padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Globe style={{ width: 15, height: 15, color: "#00FF88" }} />
                <span className="hud-label" style={{ color: "#00FF88" }}>LIVE FETCH RESULTS</span>
              </div>
              <div style={{ display: "flex", gap: 10, fontSize: 11, fontFamily: "monospace", color: "rgba(148,163,184,0.7)" }}>
                <span>Status: <strong style={{ color: fetchResult.status_code === 200 ? "#00FF88" : "#FF4D4D" }}>{fetchResult.status_code}</strong></span>
                <span>•</span>
                <span>Size: <strong>{(fetchResult.content_length / 1024).toFixed(2)} KB</strong></span>
              </div>
            </div>

            {/* Tabs for Metadata, Links, Content */}
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {["metadata", "links", "text"].map(t => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 6,
                    border: "1px solid",
                    borderColor: activeTab === t ? "rgba(0,255,136,0.3)" : "rgba(255,255,255,0.05)",
                    background: activeTab === t ? "rgba(0,255,136,0.08)" : "transparent",
                    color: activeTab === t ? "#00FF88" : "rgba(148,163,184,0.6)",
                    cursor: "pointer",
                    fontSize: 11,
                    fontFamily: "monospace",
                    textTransform: "uppercase",
                    transition: "all 0.15s"
                  }}
                >
                  {t === "text" ? "Page Content" : t}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div style={{ background: "rgba(15,23,42,0.4)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)", padding: 14 }}>
              {activeTab === "metadata" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 12, fontFamily: "monospace" }}>
                  <div>
                    <span style={{ color: "rgba(148,163,184,0.5)", display: "block", marginBottom: 3 }}>PAGE TITLE</span>
                    <span style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600 }}>{fetchResult.title}</span>
                  </div>
                  <div>
                    <span style={{ color: "rgba(148,163,184,0.5)", display: "block", marginBottom: 3 }}>META DESCRIPTION</span>
                    <span style={{ color: "#cbd5e1", lineHeight: 1.5 }}>{fetchResult.description}</span>
                  </div>
                  <div>
                    <span style={{ color: "rgba(148,163,184,0.5)", display: "block", marginBottom: 3 }}>FINAL RESOLVED URL</span>
                    <a href={fetchResult.url} target="_blank" rel="noopener noreferrer" style={{ color: "#00F5FF", textDecoration: "underline", wordBreak: "break-all" }}>
                      {fetchResult.url}
                    </a>
                  </div>
                </div>
              )}

              {activeTab === "links" && (
                <div style={{ maxHeight: 250, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                  {fetchResult.links.length === 0 ? (
                    <div style={{ color: "rgba(148,163,184,0.5)", fontSize: 11, fontFamily: "monospace", textAlign: "center", padding: 10 }}>
                      No anchor links found on this page.
                    </div>
                  ) : (
                    fetchResult.links.map((link, idx) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 8px", borderRadius: 4, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.03)", gap: 10 }}>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                          <span style={{ color: "#00FF88", fontSize: 10, marginRight: 6, fontFamily: "monospace" }}>[{idx + 1}]</span>
                          <span style={{ color: "#e2e8f0", fontSize: 11, fontWeight: 500, marginRight: 8 }}>{link.text}</span>
                          <a href={link.href} target="_blank" rel="noopener noreferrer" style={{ color: "rgba(148,163,184,0.6)", fontSize: 10, textDecoration: "none", fontFamily: "monospace" }}>
                            {link.href}
                          </a>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(link.href);
                            toast.success("Link URL copied");
                          }}
                          style={{ background: "rgba(0,255,136,0.06)", border: "1px solid rgba(0,255,136,0.15)", borderRadius: 4, color: "#00FF88", padding: "2px 6px", fontSize: 9, cursor: "pointer", fontFamily: "monospace" }}
                        >
                          Copy
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === "text" && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ color: "rgba(148,163,184,0.5)", fontSize: 10, fontFamily: "monospace" }}>EXTRACTED READABLE TEXT PREVIEW</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(fetchResult.text_preview);
                        toast.success("Content copied to clipboard");
                      }}
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 5, color: "rgba(148,163,184,0.8)", padding: "3px 8px", fontSize: 10, cursor: "pointer", fontFamily: "monospace" }}
                    >
                      Copy Content
                    </button>
                  </div>
                  <textarea
                    readOnly
                    value={fetchResult.text_preview}
                    rows={10}
                    style={{
                      width: "100%",
                      background: "rgba(0,0,0,0.2)",
                      border: "1px solid rgba(255,255,255,0.05)",
                      borderRadius: 6,
                      color: "#cbd5e1",
                      padding: 10,
                      fontSize: 11,
                      fontFamily: "monospace",
                      resize: "none",
                      outline: "none",
                      lineHeight: 1.5
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

