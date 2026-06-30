import { useEffect, useState, useRef, useCallback } from "react";
import { toast } from "../components/Toast";
import HlsPlayer from "../components/HlsPlayer";
import {
  Camera, Eye, CloudRain, Wind, AlertTriangle,
  Activity, Zap, TrendingUp, Brain, RefreshCw,
  ThumbsDown, BarChart2, Shield, Radio, Cpu, Wifi, Database,
  MapPin, MessageSquare, Send, Sparkles, ChevronRight
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

const API_BASE = "http://localhost:8000/api";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const aqiColor = (aqi) => {
  if (!aqi || aqi <= 50)  return "#34d399";
  if (aqi <= 100)          return "#fbbf24";
  if (aqi <= 150)          return "#f97316";
  if (aqi <= 200)          return "#ef4444";
  return "#a855f7";
};

const aqiLabel = (aqi) => {
  if (!aqi || aqi <= 50)  return "Good";
  if (aqi <= 100)          return "Moderate";
  if (aqi <= 150)          return "Unhealthy (Sensitive)";
  if (aqi <= 200)          return "Unhealthy";
  return "Hazardous";
};

const priorityColor = { low: "#34d399", medium: "#fbbf24", high: "#f97316", critical: "#ef4444" };
const statusColor   = { open: "#ef4444", "in-progress": "#fbbf24", resolved: "#34d399" };

const now = () => new Date().toLocaleTimeString("en-US", { hour12: false });

const wmoIcon = (condition) => {
  if (!condition) return "🌡️";
  if (condition.includes("Rain") || condition.includes("Shower")) return "🌧️";
  if (condition.includes("Snow"))        return "❄️";
  if (condition.includes("Fog"))         return "🌫️";
  if (condition.includes("Thunder"))     return "⛈️";
  if (condition.includes("Partly"))      return "⛅";
  if (condition.includes("Overcast"))    return "☁️";
  return "☀️";
};

// ─── Sub-components ───────────────────────────────────────────────────────────
const StatusDot = ({ status, size = 8 }) => {
  const colors = {
    online: "#34d399", active: "#34d399", good: "#34d399",
    offline: "#ef4444", fault: "#ef4444", critical: "#ef4444",
    warning: "#fbbf24", moderate: "#fbbf24",
  };
  const color = colors[status] || "#94a3b8";
  return (
    <span style={{
      display: "inline-block", width: size, height: size, borderRadius: "50%",
      background: color, boxShadow: `0 0 6px ${color}`, flexShrink: 0
    }} />
  );
};

const MetricBar = ({ label, value, displayValue, max = 100, color = "#00F5FF" }) => {
  const pct = Math.min(100, ((parseFloat(value) || 0) / max) * 100);
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
        <span style={{ fontSize: 9.5, color: "rgba(148,163,184,0.7)", fontFamily: "monospace", letterSpacing: "0.06em" }}>{label}</span>
        <span style={{ fontSize: 9.5, color, fontFamily: "monospace", fontWeight: 700 }}>{displayValue ?? value}</span>
      </div>
      <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${color}88, ${color})`,
          borderRadius: 4, transition: "width 0.7s ease", boxShadow: `0 0 8px ${color}55`
        }} />
      </div>
    </div>
  );
};

const GlassCard = ({ children, style = {} }) => (
  <div className="nx-glass nx-fadein" style={{ borderRadius: 12, padding: "14px 16px", ...style }}>
    {children}
  </div>
);

const SectionHeader = ({ icon: Icon, title, color = "#00F5FF", live = false, badge }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
    <div style={{
      width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
      background: `${color}18`, border: `1px solid ${color}40`
    }}>
      <Icon style={{ width: 14, height: 14, color }} />
    </div>
    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color, fontWeight: 700 }}>{title}</span>
    {live && (
      <span style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
        <span className="nx-pulse" style={{ width: 5, height: 5, borderRadius: "50%", background: "#34d399" }} />
        <span style={{ fontSize: 9, color: "#34d399", fontFamily: "monospace" }}>LIVE</span>
      </span>
    )}
    {badge && !live && (
      <span style={{ marginLeft: "auto", fontSize: 9, fontFamily: "monospace", color, background: `${color}18`, border: `1px solid ${color}30`, borderRadius: 4, padding: "1px 6px" }}>{badge}</span>
    )}
  </div>
);

const LoadingState = ({ color = "#00F5FF", label = "Fetching live data…" }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "30px 0", gap: 10 }}>
    <Cpu style={{ width: 16, height: 16, color, animation: "spin 1s linear infinite" }} />
    <span style={{ fontSize: 10, fontFamily: "monospace", color: "rgba(148,163,184,0.6)", letterSpacing: "0.1em" }}>{label}</span>
  </div>
);

const ErrorState = ({ message, onRetry }) => (
  <div style={{ textAlign: "center", padding: "20px 0" }}>
    <AlertTriangle style={{ width: 20, height: 20, color: "#ef4444", margin: "0 auto 8px" }} />
    <div style={{ fontSize: 10, color: "#f87171", fontFamily: "monospace", marginBottom: 8 }}>{message}</div>
    {onRetry && (
      <button onClick={onRetry} style={{
        padding: "5px 12px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
        borderRadius: 6, color: "#f87171", fontSize: 9, fontFamily: "monospace", cursor: "pointer"
      }}>RETRY</button>
    )}
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "rgba(6,13,34,0.95)", border: "1px solid rgba(0,245,255,0.25)",
      borderRadius: 8, padding: "8px 12px", fontSize: 11, fontFamily: "monospace"
    }}>
      <div style={{ color: "#94a3b8", marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || "#00F5FF" }}>
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function UrbanIntelligence() {
  // Real data states
  const [weather,     setWeather]     = useState(null);
  const [airQuality,  setAirQuality]  = useState(null);
  const [cameras,     setCameras]     = useState(null);
  const [cctv,        setCctv]        = useState(null);
  const [incidents,   setIncidents]   = useState(null);
  const [complaints,  setComplaints]  = useState(null);
  const [govData,     setGovData]     = useState(null);

  // Loading / error states per source
  const [loading,  setLoading]  = useState({});
  const [errors,   setErrors]   = useState({});

  // AI analysis
  const [aiInsights,  setAiInsights]  = useState("");
  const [analyzing,   setAnalyzing]   = useState(false);

  // AI Chat
  const [chatHistory,   setChatHistory]   = useState([]);
  const [chatInput,     setChatInput]     = useState("");
  const [chatLoading,   setChatLoading]   = useState(false);
  const chatEndRef = useRef(null);

  // UI state
  const [activeTab,    setActiveTab]    = useState("cameras");
  const [lastRefresh,  setLastRefresh]  = useState(now());
  const [streamLog,    setStreamLog]    = useState([]);
  const [autoRefresh,  setAutoRefresh]  = useState(false); // off by default to respect API limits
  const logRef = useRef(null);
  const intervalRef = useRef(null);

  // ── Fetch helpers ──────────────────────────────────────────────────
  const setLoad = (key, val) => setLoading(p => ({ ...p, [key]: val }));
  const setErr  = (key, msg) => setErrors(p => ({ ...p, [key]: msg }));
  const clearErr = (key)     => setErrors(p => ({ ...p, [key]: null }));

  const appendLog = (msg, color = "#00F5FF") => {
    setStreamLog(prev => [{ time: now(), msg, color }, ...prev.slice(0, 39)]);
  };

  const fetchWeather = useCallback(async () => {
    setLoad("weather", true); clearErr("weather");
    try {
      appendLog("[Open-Meteo] Syncing real-time weather telemetry…", "#38bdf8");
      const resp = await fetch(`${API_BASE}/urban/weather`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setWeather(data);
      appendLog(`[Open-Meteo] ✅ Weather: ${data.temp}°C, ${data.condition}`, "#34d399");
    } catch (e) {
      setErr("weather", `Weather fetch failed: ${e.message}`);
      appendLog(`[Open-Meteo] ❌ ${e.message}`, "#ef4444");
    } finally {
      setLoad("weather", false);
    }
  }, []);

  const fetchAirQuality = useCallback(async () => {
    setLoad("airquality", true); clearErr("airquality");
    try {
      appendLog("[OpenAQ v3] Ingesting pollution sensor readings…", "#fbbf24");
      const resp = await fetch(`${API_BASE}/urban/airquality`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setAirQuality(data);
      appendLog(`[OpenAQ v3] ✅ AQI: ${data.aqi} (${data.aqi_category}) — ${data.station_count} stations`, "#34d399");
    } catch (e) {
      setErr("airquality", `Air quality fetch failed: ${e.message}`);
      appendLog(`[OpenAQ v3] ❌ ${e.message}`, "#ef4444");
    } finally {
      setLoad("airquality", false);
    }
  }, []);

  const fetchCameras = useCallback(async () => {
    setLoad("cameras", true); clearErr("cameras");
    try {
      appendLog("[NYC DOT] Connecting to traffic camera feeds…", "#00F5FF");
      const resp = await fetch(`${API_BASE}/urban/cameras`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setCameras(data);
      appendLog(`[NYC DOT] ✅ ${data.online}/${data.total} camera feeds online`, "#34d399");
    } catch (e) {
      setErr("cameras", `Camera data fetch failed: ${e.message}`);
      appendLog(`[NYC DOT] ❌ ${e.message}`, "#ef4444");
    } finally {
      setLoad("cameras", false);
    }
  }, []);

  const fetchCctv = useCallback(async () => {
    setLoad("cctv", true); clearErr("cctv");
    try {
      appendLog("[NYC CCTV] Syncing public space safety camera feeds…", "#6E56FF");
      const resp = await fetch(`${API_BASE}/urban/cctv`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setCctv(data);
      appendLog(`[NYC CCTV] ✅ ${data.active}/${data.total} security nodes active`, "#34d399");
    } catch (e) {
      setErr("cctv", `CCTV data fetch failed: ${e.message}`);
      appendLog(`[NYC CCTV] ❌ ${e.message}`, "#ef4444");
    } finally {
      setLoad("cctv", false);
    }
  }, []);

  const fetchIncidents = useCallback(async () => {
    setLoad("incidents", true); clearErr("incidents");
    try {
      appendLog("[511NY] Polling real-time traffic incident feed…", "#00F5FF");
      const resp = await fetch(`${API_BASE}/urban/traffic-incidents`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setIncidents(data);
      appendLog(`[511NY] ✅ ${data.total} live traffic incidents`, "#34d399");
    } catch (e) {
      setErr("incidents", `Incidents fetch failed: ${e.message}`);
      appendLog(`[511NY] ❌ ${e.message}`, "#ef4444");
    } finally {
      setLoad("incidents", false);
    }
  }, []);

  const fetchComplaints = useCallback(async () => {
    setLoad("complaints", true); clearErr("complaints");
    try {
      appendLog("[NYC 311] Streaming citizen complaint data…", "#FF2E88");
      const resp = await fetch(`${API_BASE}/urban/complaints?limit=50`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setComplaints(data);
      appendLog(`[NYC 311] ✅ ${data.stats?.total} complaints — ${data.stats?.critical} critical`, "#34d399");
    } catch (e) {
      setErr("complaints", `Complaints fetch failed: ${e.message}`);
      appendLog(`[NYC 311] ❌ ${e.message}`, "#ef4444");
    } finally {
      setLoad("complaints", false);
    }
  }, []);

  const fetchGovData = useCallback(async () => {
    setLoad("govdata", true); clearErr("govdata");
    try {
      appendLog("[NYC Open Data] Cross-referencing government datasets…", "#34d399");
      const resp = await fetch(`${API_BASE}/urban/govdata`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setGovData(data);
      appendLog(`[NYC Open Data] ✅ ${data.datasets?.length} datasets synced`, "#34d399");
    } catch (e) {
      setErr("govdata", `Gov data fetch failed: ${e.message}`);
      appendLog(`[NYC Open Data] ❌ ${e.message}`, "#ef4444");
    } finally {
      setLoad("govdata", false);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    appendLog("[AI-CORE] Initiating full urban intelligence sweep…", "#6E56FF");
    setLastRefresh(now());
    await Promise.all([
      fetchWeather(),
      fetchAirQuality(),
      fetchCameras(),
      fetchCctv(),
      fetchIncidents(),
      fetchComplaints(),
      fetchGovData(),
    ]);
    appendLog("[AI-CORE] ✅ All data sources synchronized", "#34d399");
  }, [fetchWeather, fetchAirQuality, fetchCameras, fetchCctv, fetchIncidents, fetchComplaints, fetchGovData]);

  // Initial load
  useEffect(() => {
    appendLog("[NEXUS] Urban Intelligence Hub online — initializing real data feeds…", "#6E56FF");
    fetchAll();
  // eslint-disable-next-line
  }, []);

  // Auto-refresh (60s for real APIs to respect rate limits)
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        appendLog("[AUTO] Scheduled data refresh…", "#94a3b8");
        fetchAll();
      }, 60000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [autoRefresh, fetchAll]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = 0;
  }, [streamLog]);

  // ── AI Analysis ────────────────────────────────────────────────────
  const buildTelemetryPayload = useCallback(() => {
    const cctvAlerts   = cctv?.cameras?.filter(c => c.ai_tag === "Alert").length ?? 0;
    const cctvCautions = cctv?.cameras?.filter(c => c.ai_tag === "Caution").length ?? 0;
    const govHealthAvg = govData?.datasets?.length
      ? Math.round(govData.datasets.reduce((s, d) => s + (d.health_score ?? 0), 0) / govData.datasets.length)
      : 0;
    const govAnomalies = govData?.datasets?.reduce((s, d) => s + (d.anomalies ?? 0), 0) ?? 0;
    return {
      weather:            weather,
      air_quality:        airQuality,
      complaints_stats:   complaints?.stats,
      incidents_count:    incidents?.total ?? 0,
      cameras_online:     cameras?.online ?? 0,
      cameras_total:      cameras?.total ?? 0,
      cctv_active:        cctv?.active ?? 0,
      cctv_total:         cctv?.total ?? 0,
      cctv_alerts:        cctvAlerts,
      cctv_cautions:      cctvCautions,
      gov_datasets_count: govData?.datasets?.length ?? 0,
      gov_health_avg:     govHealthAvg,
      gov_anomalies_total: govAnomalies,
    };
  }, [weather, airQuality, complaints, incidents, cameras, cctv, govData]);

  const runAIAnalysis = useCallback(async () => {
    setAnalyzing(true);
    setAiInsights("");
    setActiveTab("aianalysis");
    appendLog("[AI-CORE] Running cross-source AI correlation analysis…", "#6E56FF");

    try {
      const payload = buildTelemetryPayload();

      const resp = await fetch(`${API_BASE}/urban/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        full += chunk;
        setAiInsights(full);
      }
      appendLog("[AI-CORE] ✅ AI analysis complete", "#34d399");
      toast.success("Urban AI analysis complete");
    } catch (e) {
      appendLog(`[AI-CORE] ❌ Analysis failed: ${e.message}`, "#ef4444");
      toast.error("AI analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }, [buildTelemetryPayload]);

  const runChatQuery = useCallback(async (queryText) => {
    const q = queryText || chatInput.trim();
    if (!q) return;
    setChatInput("");
    setChatLoading(true);
    const userMsg = { role: "user", text: q, time: now() };
    setChatHistory(prev => [...prev, userMsg]);
    appendLog(`[AI-CHAT] Query: "${q}"`, "#a78bfa");

    try {
      const payload = { query: q, ...buildTelemetryPayload() };
      const resp = await fetch(`${API_BASE}/urban/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      const aiMsg = { role: "ai", text: "", time: now() };
      setChatHistory(prev => [...prev, aiMsg]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value);
        const accumulated = full; // capture for closure
        // eslint-disable-next-line no-loop-func
        setChatHistory(prev => {
          const next = [...prev];
          next[next.length - 1] = { ...aiMsg, text: accumulated };
          return next;
        });
      }
      appendLog(`[AI-CHAT] ✅ Response delivered`, "#34d399");
    } catch (e) {
      setChatHistory(prev => [...prev, { role: "ai", text: `⚠️ Error: ${e.message}`, time: now() }]);
      appendLog(`[AI-CHAT] ❌ ${e.message}`, "#ef4444");
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, buildTelemetryPayload]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  // ── Tabs ───────────────────────────────────────────────────────────
  const TABS = [
    { id: "cameras",    label: "Traffic Cams",  icon: Camera,        color: "#00F5FF" },
    { id: "cctv",       label: "CCTV Security",  icon: Eye,           color: "#6E56FF" },
    { id: "weather",    label: "Weather",        icon: CloudRain,     color: "#38bdf8" },
    { id: "airquality", label: "Pollution",      icon: Wind,          color: "#fbbf24" },
    { id: "complaints", label: "Complaints",     icon: ThumbsDown,    color: "#FF2E88" },
    { id: "govdata",    label: "Gov Open Data",  icon: Database,      color: "#34d399" },
    { id: "aianalysis", label: "AI Analysis",    icon: Sparkles,      color: "#a78bfa" },
  ];

  const anyLoading = Object.values(loading).some(Boolean);

  return (
    <div style={{ minHeight: "100vh", color: "#fff" }}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <Brain style={{ width: 22, height: 22, color: "#00F5FF" }} />
            <h1 className="font-display nx-neon-cyan" style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>
              Urban Intelligence Hub
            </h1>
            <span style={{
              fontSize: 9, fontFamily: "monospace", background: "rgba(52,211,153,0.12)",
              border: "1px solid rgba(52,211,153,0.35)", borderRadius: 4, padding: "2px 8px",
              color: "#34d399", letterSpacing: "0.2em"
            }}>REAL DATA</span>
          </div>
          <p style={{ fontSize: 10.5, color: "rgba(148,163,184,0.6)", fontFamily: "monospace" }}>
            Live feeds: Open-Meteo · Open-Meteo AQ · 511NY DOT · 511NY CCTV · NYC 311 · NYC Open Data
            <span style={{ color: "rgba(148,163,184,0.4)", marginLeft: 10 }}>· Last sync: {lastRefresh}</span>
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => setAutoRefresh(a => !a)}
            title={autoRefresh ? "Auto-refresh ON (60s)" : "Auto-refresh OFF"}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
              background: autoRefresh ? "rgba(52,211,153,0.12)" : "rgba(239,68,68,0.08)",
              border: `1px solid ${autoRefresh ? "rgba(52,211,153,0.4)" : "rgba(239,68,68,0.25)"}`,
              borderRadius: 8, cursor: "pointer", color: autoRefresh ? "#34d399" : "#f87171",
              fontSize: 10, fontFamily: "monospace", letterSpacing: "0.1em", transition: "all 0.2s"
            }}
          >
            <Wifi style={{ width: 12, height: 12 }} />
            AUTO {autoRefresh ? "ON · 60s" : "OFF"}
          </button>
          <button
            onClick={runAIAnalysis}
            disabled={analyzing || anyLoading}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
              background: analyzing ? "rgba(110,86,255,0.2)" : "rgba(110,86,255,0.15)",
              border: "1px solid rgba(110,86,255,0.5)", borderRadius: 8,
              cursor: (analyzing || anyLoading) ? "not-allowed" : "pointer", color: "#a78bfa",
              fontSize: 10, fontFamily: "monospace", letterSpacing: "0.1em", transition: "all 0.2s",
              opacity: (analyzing || anyLoading) ? 0.7 : 1
            }}
          >
            <Cpu style={{ width: 12, height: 12, animation: analyzing ? "spin 1s linear infinite" : "none" }} />
            {analyzing ? "ANALYZING…" : "AI ANALYZE"}
          </button>
          <button
            onClick={() => { toast.info("Refreshing all live data sources…"); fetchAll(); }}
            disabled={anyLoading}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
              background: "rgba(0,245,255,0.08)", border: "1px solid rgba(0,245,255,0.3)",
              borderRadius: 8, cursor: anyLoading ? "not-allowed" : "pointer", color: "#00F5FF",
              fontSize: 10, fontFamily: "monospace", letterSpacing: "0.1em", transition: "all 0.2s",
              opacity: anyLoading ? 0.7 : 1
            }}
          >
            <RefreshCw style={{ width: 12, height: 12, animation: anyLoading ? "spin 1s linear infinite" : "none" }} />
            REFRESH ALL
          </button>
        </div>
      </div>

      {/* ── AI Insights Panel ──────────────────────────────────────── */}
      {(aiInsights || analyzing) && (
        <GlassCard style={{ marginBottom: 16, borderColor: "rgba(110,86,255,0.35)" }}>
          <SectionHeader icon={Brain} title="AI Cross-Source Analysis" color="#a78bfa" live={analyzing} />
          <div style={{
            fontSize: 11, fontFamily: "monospace", lineHeight: 1.7,
            color: "rgba(226,232,240,0.9)", whiteSpace: "pre-wrap"
          }}>
            {analyzing && !aiInsights && (
              <span style={{ color: "rgba(148,163,184,0.5)" }}>
                Correlating real sensor data across all sources…
              </span>
            )}
            {aiInsights}
            {analyzing && <span className="nx-caret" />}
          </div>
        </GlassCard>
      )}

      {/* ── KPI Row ────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginBottom: 16 }}>
        {[
          {
            label: "Traffic Feeds", icon: Camera, color: "#00F5FF",
            value: cameras ? `${cameras.online}/${cameras.total}` : "—",
            sub: cameras ? "NYC DOT cams" : "Loading…",
            loading: loading.cameras
          },
          {
            label: "CCTV Nodes", icon: Eye, color: "#6E56FF",
            value: cctv ? `${cctv.active}/${cctv.total}` : "—",
            sub: cctv ? "Security active" : "Loading…",
            loading: loading.cctv
          },
          {
            label: "Temperature", icon: CloudRain, color: "#38bdf8",
            value: weather ? `${weather.temp}°C` : "—",
            sub: weather?.condition ?? "Loading…",
            loading: loading.weather
          },
          {
            label: "City AQI", icon: Wind, color: weather && airQuality ? aqiColor(airQuality.aqi) : "#94a3b8",
            value: airQuality ? airQuality.aqi : "—",
            sub: airQuality ? aqiLabel(airQuality.aqi) : "Loading…",
            loading: loading.airquality
          },
          {
            label: "Open Complaints", icon: ThumbsDown, color: "#FF2E88",
            value: complaints ? complaints.stats?.pending : "—",
            sub: complaints ? `${complaints.stats?.critical} critical` : "Loading…",
            loading: loading.complaints
          },
          {
            label: "Gov Datasets", icon: Database, color: "#34d399",
            value: govData ? govData.datasets?.length : "—",
            sub: govData ? "NYC Open Data" : "Loading…",
            loading: loading.govdata
          },
        ].map((kpi, i) => (
          <GlassCard key={i} style={{ textAlign: "center", padding: "12px 8px" }}>
            {kpi.loading
              ? <Cpu style={{ width: 14, height: 14, color: kpi.color, margin: "0 auto 8px", animation: "spin 1s linear infinite" }} />
              : <kpi.icon style={{ width: 14, height: 14, color: kpi.color, margin: "0 auto 6px" }} />
            }
            <div style={{ fontSize: 17, fontWeight: 800, color: kpi.color, fontFamily: "monospace", lineHeight: 1 }}>
              {kpi.value}
            </div>
            <div style={{ fontSize: 8.5, color: "rgba(148,163,184,0.55)", fontFamily: "monospace", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 2 }}>
              {kpi.label}
            </div>
            <div style={{ fontSize: 8.5, color: kpi.color, opacity: 0.75, fontFamily: "monospace", marginTop: 1 }}>
              {kpi.sub}
            </div>
          </GlassCard>
        ))}
      </div>

      {/* ── Main body ─────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 14 }}>
        {/* LEFT: Tab panel */}
        <div>
          {/* Tab bar */}
          <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
            {TABS.map(tab => {
              const active = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, cursor: "pointer",
                  background: active ? `${tab.color}18` : "rgba(255,255,255,0.03)",
                  border: active ? `1px solid ${tab.color}55` : "1px solid rgba(255,255,255,0.08)",
                  color: active ? tab.color : "rgba(148,163,184,0.7)",
                  fontSize: 10, fontFamily: "monospace", letterSpacing: "0.12em", textTransform: "uppercase",
                  transition: "all 0.18s", boxShadow: active ? `0 0 12px ${tab.color}20` : "none"
                }}>
                  <tab.icon style={{ width: 12, height: 12 }} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* ── TRAFFIC CAMERAS TAB ── */}
          {activeTab === "cameras" && (
            <div className="nx-fadein">
              {loading.cameras && !cameras && <LoadingState color="#00F5FF" label="Connecting to 511NY live camera streams…" />}
              {errors.cameras && <ErrorState message={errors.cameras} onRetry={fetchCameras} />}
              {cameras && (
                <>
                  <div style={{ marginBottom: 8, fontSize: 9.5, color: "rgba(148,163,184,0.5)", fontFamily: "monospace" }}>
                    Source: <span style={{ color: "#00F5FF" }}>511NY Live HLS Streams</span> · {cameras.online}/{cameras.total} feeds online · Updated: {cameras.timestamp?.slice(11, 19)}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                    {cameras.cameras?.map((cam, i) => (
                      <GlassCard key={i}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                              <StatusDot status={cam.status} />
                              <span style={{ fontSize: 10.5, fontFamily: "monospace", color: "#00F5FF", fontWeight: 700 }}>{cam.id}</span>
                            </div>
                            <div style={{ fontSize: 10.5, color: "rgba(226,232,240,0.9)" }}>{cam.name?.length > 30 ? cam.name.slice(0, 30) + "…" : cam.name}</div>
                            <div style={{ fontSize: 9, color: "rgba(148,163,184,0.5)", fontFamily: "monospace", marginTop: 1 }}>
                              {cam.borough} · Dir: {cam.direction}
                            </div>
                          </div>
                          <span style={{
                            fontSize: 8.5, fontFamily: "monospace", padding: "2px 6px", borderRadius: 4,
                            background: cam.status === "online" ? "rgba(52,211,153,0.12)" : "rgba(239,68,68,0.1)",
                            border: `1px solid ${cam.status === "online" ? "rgba(52,211,153,0.3)" : "rgba(239,68,68,0.25)"}`,
                            color: cam.status === "online" ? "#34d399" : "#ef4444"
                          }}>{cam.status.toUpperCase()}</span>
                        </div>
                        {/* Real HLS live video stream */}
                        {cam.video_url && (
                          <HlsPlayer
                            src={cam.video_url}
                            accentColor="#00F5FF"
                            height={130}
                            label="LIVE · 511NY DOT"
                          />
                        )}
                        <div style={{
                          padding: "5px 8px", background: "rgba(0,245,255,0.04)",
                          borderRadius: 6, border: "1px solid rgba(0,245,255,0.1)",
                          fontSize: 9, fontFamily: "monospace", color: "rgba(148,163,184,0.6)"
                        }}>
                          <MapPin style={{ width: 9, height: 9, marginRight: 4, display: "inline" }} />
                          {cam.lat?.toFixed(4)}°, {cam.lng?.toFixed(4)}°
                        </div>
                      </GlassCard>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── CCTV SECURITY TAB ── */}
          {activeTab === "cctv" && (
            <div className="nx-fadein">
              {loading.cctv && !cctv && <LoadingState color="#6E56FF" label="Connecting to 511NY Public Safety CCTV Network…" />}
              {errors.cctv && <ErrorState message={errors.cctv} onRetry={fetchCctv} />}
              {cctv && (
                <>
                  <div style={{ marginBottom: 8, fontSize: 9.5, color: "rgba(148,163,184,0.5)", fontFamily: "monospace" }}>
                    Source: <span style={{ color: "#6E56FF" }}>511NY CCTV HLS Network</span> · AI-Augmented Security Analysis · Updated: {cctv.timestamp?.slice(11, 19)}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                    {cctv.cameras?.map((cam, i) => (
                      <GlassCard key={i}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                              <StatusDot status={cam.status === "active" ? "active" : "fault"} />
                              <span style={{ fontSize: 10.5, fontFamily: "monospace", color: "#6E56FF", fontWeight: 700 }}>{cam.id}</span>
                            </div>
                            <div style={{ fontSize: 10.5, color: "rgba(226,232,240,0.9)" }}>{cam.name?.length > 30 ? cam.name.slice(0, 30) + "…" : cam.name}</div>
                            <div style={{ fontSize: 9, color: "rgba(148,163,184,0.5)", fontFamily: "monospace", marginTop: 1 }}>
                              {cam.borough} · Dir: {cam.direction}
                            </div>
                          </div>
                          <span style={{
                            fontSize: 8.5, fontFamily: "monospace", padding: "2px 6px", borderRadius: 4,
                            background: cam.ai_tag === "Alert" ? "rgba(239,68,68,0.15)" : cam.ai_tag === "Caution" ? "rgba(251,191,36,0.15)" : "rgba(52,211,153,0.12)",
                            border: `1px solid ${cam.ai_tag === "Alert" ? "rgba(239,68,68,0.4)" : cam.ai_tag === "Caution" ? "rgba(251,191,36,0.4)" : "rgba(52,211,153,0.3)"}`,
                            color: cam.ai_tag === "Alert" ? "#ef4444" : cam.ai_tag === "Caution" ? "#fbbf24" : "#34d399"
                          }}>{cam.ai_tag}</span>
                        </div>

                        {/* Real HLS live video stream with AI overlay */}
                        {cam.video_url && (
                          <div style={{ position: "relative", marginBottom: 8 }}>
                            <HlsPlayer
                              src={cam.video_url}
                              accentColor="#6E56FF"
                              height={130}
                              label="SECURE · AI-MONITORED"
                            />
                            {cam.ai_tag === "Alert" && (
                              <div style={{
                                position: "absolute", top: 5, right: 5, background: "rgba(239,68,68,0.85)",
                                border: "1px solid rgba(239,68,68,0.6)", borderRadius: 3, padding: "2px 6px",
                                fontSize: 7.5, fontFamily: "monospace", color: "#fff", letterSpacing: "0.1em"
                              }}>🚨 ALERT</div>
                            )}
                          </div>
                        )}

                        <MetricBar label="Estimated Occupancy" value={cam.people_count} max={300} color="#6E56FF" displayValue={`${cam.people_count} people`} />
                        <MetricBar label="AI Anomaly Score" value={cam.anomaly_score} max={100} color={cam.anomaly_score > 30 ? "#ef4444" : "#34d399"} displayValue={`${cam.anomaly_score}%`} />
                        
                        <div style={{
                          padding: "5px 8px", background: cam.last_event === "Clear" ? "rgba(255,255,255,0.03)" : "rgba(239,68,68,0.08)",
                          borderRadius: 6, border: `1px solid ${cam.last_event === "Clear" ? "rgba(255,255,255,0.08)" : "rgba(239,68,68,0.2)"}`,
                          fontSize: 9, fontFamily: "monospace", color: cam.last_event === "Clear" ? "rgba(148,163,184,0.6)" : "#ef4444"
                        }}>
                          🚨 EVENT LOG: {cam.last_event}
                        </div>
                      </GlassCard>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── WEATHER TAB ── */}
          {activeTab === "weather" && (
            <div className="nx-fadein">
              {loading.weather && !weather && <LoadingState color="#38bdf8" label="Fetching Open-Meteo weather…" />}
              {errors.weather && <ErrorState message={errors.weather} onRetry={fetchWeather} />}
              {weather && (
                <>
                  <div style={{ marginBottom: 8, fontSize: 9.5, color: "rgba(148,163,184,0.5)", fontFamily: "monospace" }}>
                    Source: <span style={{ color: "#38bdf8" }}>Open-Meteo</span> · No API key required · Updated: {weather.timestamp?.slice(11, 19)}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 10 }}>
                    {[
                      { label: "Temperature",  value: `${weather.temp}°C`,        icon: "🌡️", color: "#f97316", sub: `Feels ${weather.feels_like}°C` },
                      { label: "Humidity",     value: `${weather.humidity}%`,     icon: "💧", color: "#38bdf8", sub: "Relative humidity" },
                      { label: "Wind Speed",   value: `${weather.wind_speed} km/h`, icon: "🌬️", color: "#00F5FF", sub: `Direction: ${weather.wind_dir}` },
                      { label: "Pressure",     value: `${weather.pressure} hPa`,  icon: "📊", color: "#6E56FF", sub: "Surface pressure" },
                      { label: "Visibility",   value: `${weather.visibility} km`, icon: "👁️", color: "#a78bfa", sub: "Horizontal visibility" },
                      { label: "UV Index",     value: weather.uv_index,           icon: "☀️", color: "#fbbf24", sub: weather.uv_index > 6 ? "High exposure" : "Safe" },
                    ].map((item, i) => (
                      <GlassCard key={i} style={{ textAlign: "center", padding: "12px 10px" }}>
                        <div style={{ fontSize: 20, marginBottom: 4 }}>{item.icon}</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: item.color, fontFamily: "monospace" }}>{item.value}</div>
                        <div style={{ fontSize: 8.5, color: "rgba(148,163,184,0.55)", letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "monospace", marginTop: 1 }}>{item.label}</div>
                        <div style={{ fontSize: 9, color: item.color, opacity: 0.75, marginTop: 2, fontFamily: "monospace" }}>{item.sub}</div>
                      </GlassCard>
                    ))}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                    <GlassCard>
                      <SectionHeader icon={CloudRain} title="Current Conditions" color="#38bdf8" />
                      <div style={{ textAlign: "center", padding: "8px 0" }}>
                        <div style={{ fontSize: 40, marginBottom: 8 }}>{wmoIcon(weather.condition)}</div>
                        <div style={{ fontSize: 15, color: "#38bdf8", fontFamily: "monospace", fontWeight: 700 }}>{weather.condition}</div>
                        <div style={{ fontSize: 10, color: "rgba(148,163,184,0.6)", marginTop: 6, fontFamily: "monospace" }}>
                          Lat {weather.lat?.toFixed(3)}° · Lng {weather.lng?.toFixed(3)}°
                        </div>
                      </div>
                    </GlassCard>
                    <GlassCard>
                      <SectionHeader icon={Activity} title="Conditions Summary" color="#38bdf8" />
                      <MetricBar label="Humidity" value={weather.humidity} max={100} color="#38bdf8" displayValue={`${weather.humidity}%`} />
                      <MetricBar label="UV Index" value={weather.uv_index} max={11} color="#fbbf24" displayValue={`${weather.uv_index}/11`} />
                      <MetricBar label="Wind Speed" value={weather.wind_speed} max={120} color="#00F5FF" displayValue={`${weather.wind_speed} km/h`} />
                      <MetricBar label="Visibility" value={weather.visibility} max={20} color="#a78bfa" displayValue={`${weather.visibility} km`} />
                    </GlassCard>
                  </div>

                  {weather.forecast?.length > 0 && (
                    <GlassCard>
                      <SectionHeader icon={TrendingUp} title="Hourly Forecast (Open-Meteo)" color="#38bdf8" live />
                      <ResponsiveContainer width="100%" height={150}>
                        <AreaChart data={weather.forecast}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(56,189,248,0.08)" />
                          <XAxis dataKey="hour" tick={{ fill: "#64748b", fontSize: 9, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: "#64748b", fontSize: 9, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                          <Tooltip content={<CustomTooltip />} />
                          <Area type="monotone" dataKey="temp" stroke="#f97316" fill="#f97316" fillOpacity={0.15} name="Temp °C" strokeWidth={2} />
                          <Area type="monotone" dataKey="rain" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.1} name="Rain %" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </GlassCard>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── AIR QUALITY (POLLUTION) TAB ── */}
          {activeTab === "airquality" && (
            <div className="nx-fadein">
              {loading.airquality && !airQuality && <LoadingState color="#fbbf24" label="Fetching OpenAQ pollution sensors…" />}
              {errors.airquality && <ErrorState message={errors.airquality} onRetry={fetchAirQuality} />}
              {airQuality && (
                <>
                  <div style={{ marginBottom: 8, fontSize: 9.5, color: "rgba(148,163,184,0.5)", fontFamily: "monospace" }}>
                    Source: <span style={{ color: "#fbbf24" }}>OpenAQ v3</span> · Open-source air quality network · {airQuality.station_count} sensors · Updated: {airQuality.timestamp?.slice(11, 19)}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 10 }}>
                    {[
                      { label: "AQI",   value: airQuality.aqi,   color: aqiColor(airQuality.aqi), sub: aqiLabel(airQuality.aqi) },
                      { label: "PM2.5", value: airQuality.pm25 != null ? `${airQuality.pm25} μg/m³` : "N/A", color: "#fbbf24", sub: "Fine particulate" },
                      { label: "PM10",  value: airQuality.pm10 != null ? `${airQuality.pm10} μg/m³` : "N/A", color: "#f97316", sub: "Coarse particulate" },
                      { label: "NO₂",   value: airQuality.no2  != null ? `${airQuality.no2} μg/m³` : "N/A",  color: "#a78bfa", sub: "Nitrogen dioxide" },
                      { label: "O₃",    value: airQuality.o3   != null ? `${airQuality.o3} μg/m³` : "N/A",   color: "#34d399", sub: "Ground ozone" },
                      { label: "SO₂",   value: airQuality.so2  != null ? `${airQuality.so2} μg/m³` : "N/A",  color: "#ef4444", sub: "Sulfur dioxide" },
                    ].map((item, i) => (
                      <GlassCard key={i} style={{ textAlign: "center", padding: "12px 8px" }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: item.color, fontFamily: "monospace", lineHeight: 1 }}>{item.value}</div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(226,232,240,0.8)", fontFamily: "monospace", marginTop: 2 }}>{item.label}</div>
                        <div style={{ fontSize: 9, color: item.color, opacity: 0.8, marginTop: 2, fontFamily: "monospace" }}>{item.sub}</div>
                      </GlassCard>
                    ))}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <GlassCard>
                      <SectionHeader icon={Wind} title="Pollution Sensors Near Me" color="#fbbf24" live />
                      <div style={{ maxHeight: 220, overflowY: "auto" }}>
                        {airQuality.stations?.map((st, i) => (
                          <div key={i} style={{ padding: "7px 0", borderBottom: i < airQuality.stations.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <StatusDot status={st.status} />
                                <span style={{ fontSize: 10, color: "rgba(226,232,240,0.85)", fontFamily: "monospace" }}>
                                  {st.name?.length > 22 ? st.name.slice(0, 22) + "…" : st.name}
                                </span>
                              </div>
                              <span style={{ fontSize: 11, fontWeight: 700, color: aqiColor(st.aqi), fontFamily: "monospace" }}>AQI {st.aqi}</span>
                            </div>
                            {st.pm25 != null && (
                              <MetricBar value={st.pm25} max={150} color={aqiColor(st.aqi)} label={`PM2.5: ${st.pm25} μg/m³`} displayValue="" />
                            )}
                            <div style={{ fontSize: 8.5, color: "rgba(148,163,184,0.4)", fontFamily: "monospace" }}>
                              {st.distance_m ? `${(st.distance_m / 1000).toFixed(1)} km away` : ""}
                            </div>
                          </div>
                        ))}
                      </div>
                    </GlassCard>

                    <GlassCard>
                      <SectionHeader icon={AlertTriangle} title="AQI Impact Advisory" color="#fbbf24" />
                      <div style={{ textAlign: "center", padding: "10px 0" }}>
                        <div style={{
                          width: 85, height: 85, borderRadius: "50%", margin: "0 auto 12px",
                          background: `radial-gradient(circle, ${aqiColor(airQuality.aqi)}25, transparent)`,
                          border: `3px solid ${aqiColor(airQuality.aqi)}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          boxShadow: `0 0 24px ${aqiColor(airQuality.aqi)}40`
                        }}>
                          <div>
                            <div style={{ fontSize: 22, fontWeight: 800, color: aqiColor(airQuality.aqi), fontFamily: "monospace" }}>{airQuality.aqi}</div>
                            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>AQI</div>
                          </div>
                        </div>
                        <div style={{ fontSize: 13, color: aqiColor(airQuality.aqi), fontFamily: "monospace", fontWeight: 700 }}>{airQuality.aqi_category}</div>
                        <div style={{ fontSize: 9.5, color: "rgba(148,163,184,0.6)", marginTop: 8, fontFamily: "monospace", lineHeight: 1.5 }}>
                          {airQuality.aqi > 100
                            ? "Sensitive groups should limit outdoor exposure. NEXUS AI advises issuing a warning broadcast."
                            : "Air quality is nominal. No current precautions or warnings in effect."}
                        </div>
                      </div>
                    </GlassCard>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── COMPLAINTS TAB ── */}
          {activeTab === "complaints" && (
            <div className="nx-fadein">
              {loading.complaints && !complaints && <LoadingState color="#FF2E88" label="Fetching NYC 311 complaints…" />}
              {errors.complaints && <ErrorState message={errors.complaints} onRetry={fetchComplaints} />}
              {complaints && (
                <>
                  <div style={{ marginBottom: 8, fontSize: 9.5, color: "rgba(148,163,184,0.5)", fontFamily: "monospace" }}>
                    Source: <span style={{ color: "#FF2E88" }}>NYC 311 Open Data</span> · Real citizen service requests · Updated: {complaints.timestamp?.slice(11, 19)}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 12 }}>
                    {[
                      { label: "Total",    value: complaints.stats?.total,    color: "#00F5FF" },
                      { label: "Pending",  value: complaints.stats?.pending,  color: "#fbbf24" },
                      { label: "Resolved", value: complaints.stats?.resolved, color: "#34d399" },
                      { label: "Critical", value: complaints.stats?.critical, color: "#ef4444" },
                    ].map((item, i) => (
                      <GlassCard key={i} style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: item.color, fontFamily: "monospace" }}>{item.value}</div>
                        <div style={{ fontSize: 8.5, color: "rgba(148,163,184,0.55)", letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: "monospace" }}>{item.label}</div>
                      </GlassCard>
                    ))}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <GlassCard>
                      <SectionHeader icon={ThumbsDown} title="Recent Complaints" color="#FF2E88" live />
                      <div style={{ maxHeight: 320, overflowY: "auto" }}>
                        {complaints.complaints?.slice(0, 10).map((c, i) => (
                          <div key={i} style={{ padding: "8px 0", borderBottom: i < 9 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 2 }}>
                              <div>
                                <span style={{ fontSize: 9.5, color: "#FF2E88", fontFamily: "monospace", fontWeight: 700 }}>#{c.id?.slice(-6)}</span>
                                <span style={{ fontSize: 8.5, color: "rgba(148,163,184,0.45)", fontFamily: "monospace", marginLeft: 5 }}>{c.time_ago}</span>
                              </div>
                              <div style={{ display: "flex", gap: 3 }}>
                                <span style={{
                                  fontSize: 7.5, fontFamily: "monospace", padding: "1px 4px", borderRadius: 3,
                                  background: `${priorityColor[c.priority] || "#94a3b8"}15`, color: priorityColor[c.priority] || "#94a3b8",
                                  border: `1px solid ${priorityColor[c.priority] || "#94a3b8"}35`
                                }}>{(c.priority || "").toUpperCase()}</span>
                                <span style={{
                                  fontSize: 7.5, fontFamily: "monospace", padding: "1px 4px", borderRadius: 3,
                                  background: `${statusColor[c.status] || "#94a3b8"}15`, color: statusColor[c.status] || "#94a3b8",
                                  border: `1px solid ${statusColor[c.status] || "#94a3b8"}35`
                                }}>{(c.status || "").toUpperCase()}</span>
                              </div>
                            </div>
                            <div style={{ fontSize: 10, color: "rgba(226,232,240,0.85)" }}>{c.category}</div>
                            {c.descriptor && (
                              <div style={{ fontSize: 9, color: "rgba(148,163,184,0.5)", fontFamily: "monospace" }}>{c.descriptor}</div>
                            )}
                            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                              <MapPin style={{ width: 8, height: 8, color: "rgba(148,163,184,0.4)" }} />
                              <span style={{ fontSize: 8.5, color: "rgba(148,163,184,0.5)", fontFamily: "monospace" }}>
                                {c.location?.slice(0, 30)}{(c.location?.length || 0) > 30 ? "…" : ""} · {c.borough}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </GlassCard>

                    <GlassCard>
                      <SectionHeader icon={BarChart2} title="Category Breakdown" color="#FF2E88" />
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={complaints.category_breakdown?.slice(0, 8)} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,46,136,0.07)" />
                          <XAxis type="number" tick={{ fill: "#64748b", fontSize: 8, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                          <YAxis dataKey="name" type="category" tick={{ fill: "#94a3b8", fontSize: 7.5, fontFamily: "monospace" }} axisLine={false} tickLine={false} width={110} />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="count" fill="#FF2E88" fillOpacity={0.7} radius={[0, 4, 4, 0]} name="Complaints" />
                        </BarChart>
                      </ResponsiveContainer>
                    </GlassCard>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── GOVERNMENT OPEN DATA TAB ── */}
          {activeTab === "govdata" && (
            <div className="nx-fadein">
              {loading.govdata && !govData && <LoadingState color="#34d399" label="Querying NYC Open Data portal…" />}
              {errors.govdata && <ErrorState message={errors.govdata} onRetry={fetchGovData} />}
              {govData && (
                <>
                  <div style={{ marginBottom: 8, fontSize: 9.5, color: "rgba(148,163,184,0.5)", fontFamily: "monospace" }}>
                    Source: <span style={{ color: "#34d399" }}>NYC Open Data Portal</span> · Official government datasets · Updated: {govData.timestamp?.slice(11, 19)}
                  </div>

                  {govData.errors?.length > 0 && (
                    <div style={{
                      padding: "8px 12px", background: "rgba(251,191,36,0.07)", borderRadius: 7,
                      border: "1px solid rgba(251,191,36,0.2)", marginBottom: 10, fontSize: 9, color: "#fbbf24", fontFamily: "monospace"
                    }}>
                      ⚠️ Some datasets unavailable: {govData.errors.join(" · ")}
                    </div>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
                    {govData.datasets?.map((ds, i) => (
                      <GlassCard key={i} style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                              <Database style={{ width: 13, height: 13, color: "#34d399", flexShrink: 0 }} />
                              <span style={{ fontSize: 11.5, color: "rgba(226,232,240,0.9)", fontWeight: 600 }}>{ds.name}</span>
                              <span style={{
                                fontSize: 8, fontFamily: "monospace", padding: "1px 6px", borderRadius: 3,
                                background: ds.freshness === "Live" ? "rgba(52,211,153,0.12)" : "rgba(56,189,248,0.1)",
                                border: `1px solid ${ds.freshness === "Live" ? "rgba(52,211,153,0.3)" : "rgba(56,189,248,0.25)"}`,
                                color: ds.freshness === "Live" ? "#34d399" : "#38bdf8", letterSpacing: "0.08em"
                              }}>{ds.freshness}</span>
                            </div>
                            <div style={{ fontSize: 10, color: "rgba(148,163,184,0.6)", fontFamily: "monospace", marginBottom: 6 }}>
                              {ds.agency} · Synced: {ds.last_sync}
                            </div>
                            <div style={{ fontSize: 12, color: "#34d399", fontFamily: "monospace", fontWeight: 700, marginBottom: 6 }}>
                              {ds.records_label}
                            </div>
                            <MetricBar label="Data Health Score" value={ds.health_score} max={100} color="#34d399" displayValue={`${ds.health_score}%`} />
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                              <Brain style={{ width: 11, height: 11, color: "#6E56FF" }} />
                              <span style={{ fontSize: 9.5, fontFamily: "monospace", color: "rgba(148,163,184,0.8)", fontStyle: "italic" }}>
                                {ds.insight}
                              </span>
                            </div>
                          </div>
                          <div style={{ textAlign: "right", marginLeft: 16, flexShrink: 0 }}>
                            <div style={{ fontSize: 9, fontFamily: "monospace", color: ds.anomalies > 0 ? "#fbbf24" : "#34d399" }}>
                              {ds.anomalies} anomalies
                            </div>
                            <div style={{ fontSize: 10, fontFamily: "monospace", color: "#34d399", fontWeight: 700, marginTop: 2 }}>
                              {ds.health_score}% healthy
                            </div>
                          </div>
                        </div>
                      </GlassCard>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── AI ANALYSIS TAB ── */}
          {activeTab === "aianalysis" && (
            <div className="nx-fadein">
              {/* Section: Source Diagnostics Grid */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <Sparkles style={{ width: 14, height: 14, color: "#a78bfa" }} />
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10.5, letterSpacing: "0.18em", textTransform: "uppercase", color: "#a78bfa", fontWeight: 700 }}>Live Source Diagnostics</span>
                  <span style={{ marginLeft: "auto", fontSize: 9, fontFamily: "monospace", color: "#a78bfa", background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.3)", borderRadius: 4, padding: "1px 6px" }}>6 SOURCES</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                  {/* Traffic Cameras */}
                  <GlassCard style={{ borderLeft: "3px solid #00F5FF" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <Camera style={{ width: 14, height: 14, color: "#00F5FF" }} />
                      <span style={{ fontSize: 10, fontFamily: "monospace", color: "#00F5FF", fontWeight: 700, letterSpacing: "0.12em" }}>TRAFFIC CAMERAS</span>
                    </div>
                    {cameras ? (
                      <>
                        <div style={{ fontSize: 22, fontWeight: 800, color: "#00F5FF", fontFamily: "monospace", lineHeight: 1 }}>{cameras.online}/{cameras.total}</div>
                        <div style={{ fontSize: 9, color: "rgba(148,163,184,0.6)", fontFamily: "monospace", marginTop: 2 }}>feeds active · 511NY DOT</div>
                        <MetricBar label="Coverage" value={cameras.online} max={cameras.total || 1} color="#00F5FF" displayValue={`${Math.round((cameras.online/cameras.total)*100)||0}%`} />
                        <div style={{ fontSize: 8.5, padding: "3px 8px", background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: 4, color: "#34d399", fontFamily: "monospace", marginTop: 4 }}>✅ NOMINAL</div>
                      </>
                    ) : <div style={{ fontSize: 9, color: "rgba(148,163,184,0.4)", fontFamily: "monospace" }}>Awaiting data…</div>}
                  </GlassCard>

                  {/* CCTV */}
                  <GlassCard style={{ borderLeft: "3px solid #6E56FF" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <Eye style={{ width: 14, height: 14, color: "#6E56FF" }} />
                      <span style={{ fontSize: 10, fontFamily: "monospace", color: "#6E56FF", fontWeight: 700, letterSpacing: "0.12em" }}>CCTV SECURITY</span>
                    </div>
                    {cctv ? (
                      <>
                        <div style={{ fontSize: 22, fontWeight: 800, color: "#6E56FF", fontFamily: "monospace", lineHeight: 1 }}>{cctv.active}/{cctv.total}</div>
                        <div style={{ fontSize: 9, color: "rgba(148,163,184,0.6)", fontFamily: "monospace", marginTop: 2 }}>nodes active · AI-augmented</div>
                        {(() => {
                          const alerts   = cctv.cameras?.filter(c => c.ai_tag === "Alert").length || 0;
                          const cautions = cctv.cameras?.filter(c => c.ai_tag === "Caution").length || 0;
                          return (
                            <div style={{ display: "flex", gap: 5, marginTop: 6 }}>
                              <span style={{ fontSize: 8, fontFamily: "monospace", padding: "2px 6px", borderRadius: 4, background: alerts > 0 ? "rgba(239,68,68,0.12)" : "rgba(52,211,153,0.08)", border: `1px solid ${alerts > 0 ? "rgba(239,68,68,0.3)" : "rgba(52,211,153,0.2)"}`, color: alerts > 0 ? "#ef4444" : "#34d399" }}>{alerts} Alerts</span>
                              <span style={{ fontSize: 8, fontFamily: "monospace", padding: "2px 6px", borderRadius: 4, background: cautions > 0 ? "rgba(251,191,36,0.12)" : "rgba(52,211,153,0.08)", border: `1px solid ${cautions > 0 ? "rgba(251,191,36,0.3)" : "rgba(52,211,153,0.2)"}`, color: cautions > 0 ? "#fbbf24" : "#34d399" }}>{cautions} Cautions</span>
                            </div>
                          );
                        })()}
                      </>
                    ) : <div style={{ fontSize: 9, color: "rgba(148,163,184,0.4)", fontFamily: "monospace" }}>Awaiting data…</div>}
                  </GlassCard>

                  {/* Weather */}
                  <GlassCard style={{ borderLeft: "3px solid #38bdf8" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <CloudRain style={{ width: 14, height: 14, color: "#38bdf8" }} />
                      <span style={{ fontSize: 10, fontFamily: "monospace", color: "#38bdf8", fontWeight: 700, letterSpacing: "0.12em" }}>WEATHER</span>
                    </div>
                    {weather ? (
                      <>
                        <div style={{ fontSize: 22, fontWeight: 800, color: "#38bdf8", fontFamily: "monospace", lineHeight: 1 }}>{weather.temp}°C</div>
                        <div style={{ fontSize: 9, color: "rgba(148,163,184,0.6)", fontFamily: "monospace", marginTop: 2 }}>{weather.condition} · Open-Meteo</div>
                        <div style={{ marginTop: 6 }}>
                          <MetricBar label="Humidity" value={weather.humidity} max={100} color="#38bdf8" displayValue={`${weather.humidity}%`} />
                          <MetricBar label="Wind" value={weather.wind_speed} max={80} color="#7dd3fc" displayValue={`${weather.wind_speed} km/h`} />
                        </div>
                        <div style={{ fontSize: 8.5, padding: "3px 8px", background: weather.condition?.includes("Rain") ? "rgba(56,189,248,0.1)" : "rgba(52,211,153,0.08)", border: `1px solid ${weather.condition?.includes("Rain") ? "rgba(56,189,248,0.3)" : "rgba(52,211,153,0.2)"}`, borderRadius: 4, color: weather.condition?.includes("Rain") ? "#38bdf8" : "#34d399", fontFamily: "monospace", marginTop: 4 }}>
                          {weather.condition?.includes("Rain") ? "⚠️ PRECIPITATION" : "✅ NOMINAL"}
                        </div>
                      </>
                    ) : <div style={{ fontSize: 9, color: "rgba(148,163,184,0.4)", fontFamily: "monospace" }}>Awaiting data…</div>}
                  </GlassCard>

                  {/* Pollution */}
                  <GlassCard style={{ borderLeft: `3px solid ${airQuality ? aqiColor(airQuality.aqi) : "#fbbf24"}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <Wind style={{ width: 14, height: 14, color: "#fbbf24" }} />
                      <span style={{ fontSize: 10, fontFamily: "monospace", color: "#fbbf24", fontWeight: 700, letterSpacing: "0.12em" }}>POLLUTION SENSORS</span>
                    </div>
                    {airQuality ? (
                      <>
                        <div style={{ fontSize: 22, fontWeight: 800, color: aqiColor(airQuality.aqi), fontFamily: "monospace", lineHeight: 1 }}>AQI {airQuality.aqi}</div>
                        <div style={{ fontSize: 9, color: "rgba(148,163,184,0.6)", fontFamily: "monospace", marginTop: 2 }}>{airQuality.aqi_category} · Open-Meteo AQ</div>
                        <div style={{ marginTop: 6 }}>
                          <MetricBar label="PM2.5" value={airQuality.pm25 ?? 0} max={150} color={aqiColor(airQuality.aqi)} displayValue={airQuality.pm25 != null ? `${airQuality.pm25} μg/m³` : "N/A"} />
                          <MetricBar label="PM10" value={airQuality.pm10 ?? 0} max={200} color="#f97316" displayValue={airQuality.pm10 != null ? `${airQuality.pm10} μg/m³` : "N/A"} />
                        </div>
                        <div style={{ fontSize: 8.5, padding: "3px 8px", background: `${aqiColor(airQuality.aqi)}10`, border: `1px solid ${aqiColor(airQuality.aqi)}30`, borderRadius: 4, color: aqiColor(airQuality.aqi), fontFamily: "monospace", marginTop: 4 }}>
                          {airQuality.aqi > 100 ? "⚠️ ELEVATED" : "✅ CLEAN"}
                        </div>
                      </>
                    ) : <div style={{ fontSize: 9, color: "rgba(148,163,184,0.4)", fontFamily: "monospace" }}>Awaiting data…</div>}
                  </GlassCard>

                  {/* Complaints */}
                  <GlassCard style={{ borderLeft: "3px solid #FF2E88" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <ThumbsDown style={{ width: 14, height: 14, color: "#FF2E88" }} />
                      <span style={{ fontSize: 10, fontFamily: "monospace", color: "#FF2E88", fontWeight: 700, letterSpacing: "0.12em" }}>CITIZEN COMPLAINTS</span>
                    </div>
                    {complaints ? (
                      <>
                        <div style={{ fontSize: 22, fontWeight: 800, color: "#FF2E88", fontFamily: "monospace", lineHeight: 1 }}>{complaints.stats?.total ?? "—"}</div>
                        <div style={{ fontSize: 9, color: "rgba(148,163,184,0.6)", fontFamily: "monospace", marginTop: 2 }}>total · NYC 311 Open Data</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginTop: 6 }}>
                          {[{l:"Pending", v:complaints.stats?.pending, c:"#fbbf24"},{l:"Resolved", v:complaints.stats?.resolved, c:"#34d399"},{l:"Critical", v:complaints.stats?.critical, c:"#ef4444"}].map((s,i) => (
                            <div key={i} style={{ background: `${s.c}08`, border: `1px solid ${s.c}20`, borderRadius: 5, padding: "4px 6px", textAlign: "center" }}>
                              <div style={{ fontSize: 13, fontWeight: 800, color: s.c, fontFamily: "monospace" }}>{s.v ?? "—"}</div>
                              <div style={{ fontSize: 7.5, color: "rgba(148,163,184,0.5)", fontFamily: "monospace", textTransform: "uppercase" }}>{s.l}</div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : <div style={{ fontSize: 9, color: "rgba(148,163,184,0.4)", fontFamily: "monospace" }}>Awaiting data…</div>}
                  </GlassCard>

                  {/* Gov Open Data */}
                  <GlassCard style={{ borderLeft: "3px solid #34d399" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <Database style={{ width: 14, height: 14, color: "#34d399" }} />
                      <span style={{ fontSize: 10, fontFamily: "monospace", color: "#34d399", fontWeight: 700, letterSpacing: "0.12em" }}>GOV OPEN DATA</span>
                    </div>
                    {govData ? (
                      <>
                        <div style={{ fontSize: 22, fontWeight: 800, color: "#34d399", fontFamily: "monospace", lineHeight: 1 }}>{govData.datasets?.length ?? "—"}</div>
                        <div style={{ fontSize: 9, color: "rgba(148,163,184,0.6)", fontFamily: "monospace", marginTop: 2 }}>datasets · NYC Open Data Portal</div>
                        {govData.datasets && (
                          <MetricBar
                            label="Avg Health"
                            value={Math.round(govData.datasets.reduce((s,d)=>s+(d.health_score||0),0)/govData.datasets.length)}
                            max={100} color="#34d399"
                            displayValue={`${Math.round(govData.datasets.reduce((s,d)=>s+(d.health_score||0),0)/govData.datasets.length)}%`}
                          />
                        )}
                        <div style={{ fontSize: 8.5, padding: "3px 8px", background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: 4, color: "#34d399", fontFamily: "monospace", marginTop: 4 }}>✅ SYNCED</div>
                      </>
                    ) : <div style={{ fontSize: 9, color: "rgba(148,163,184,0.4)", fontFamily: "monospace" }}>Awaiting data…</div>}
                  </GlassCard>
                </div>
              </div>

              {/* Section: AI Insights Report */}
              <GlassCard style={{ marginBottom: 14, border: "1px solid rgba(167,139,250,0.25)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.35)" }}>
                    <Brain style={{ width: 14, height: 14, color: "#a78bfa" }} />
                  </div>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "#a78bfa", fontWeight: 700 }}>AI Cross-Source Analysis</span>
                  {analyzing && (
                    <span style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
                      <span className="nx-pulse" style={{ width: 5, height: 5, borderRadius: "50%", background: "#a78bfa" }} />
                      <span style={{ fontSize: 9, color: "#a78bfa", fontFamily: "monospace" }}>ANALYZING</span>
                    </span>
                  )}
                  {!analyzing && (
                    <button
                      onClick={runAIAnalysis}
                      disabled={analyzing || anyLoading}
                      style={{
                        marginLeft: "auto", display: "flex", alignItems: "center", gap: 5,
                        padding: "5px 12px", background: "rgba(167,139,250,0.12)",
                        border: "1px solid rgba(167,139,250,0.4)", borderRadius: 6,
                        cursor: anyLoading ? "not-allowed" : "pointer", color: "#a78bfa",
                        fontSize: 9, fontFamily: "monospace", letterSpacing: "0.1em",
                        opacity: anyLoading ? 0.6 : 1, transition: "all 0.2s"
                      }}
                    >
                      <Cpu style={{ width: 10, height: 10 }} />
                      {aiInsights ? "RE-ANALYZE" : "RUN ANALYSIS"}
                    </button>
                  )}
                </div>
                {!aiInsights && !analyzing && (
                  <div style={{ textAlign: "center", padding: "28px 0", color: "rgba(148,163,184,0.4)", fontFamily: "monospace", fontSize: 10 }}>
                    <Brain style={{ width: 24, height: 24, color: "rgba(167,139,250,0.3)", margin: "0 auto 10px" }} />
                    Click <span style={{ color: "#a78bfa" }}>"RUN ANALYSIS"</span> to generate AI-powered cross-source insights from all 6 live data feeds.
                  </div>
                )}
                {(aiInsights || analyzing) && (
                  <div style={{ fontSize: 11, fontFamily: "monospace", lineHeight: 1.85, color: "rgba(226,232,240,0.9)", whiteSpace: "pre-wrap" }}>
                    {analyzing && !aiInsights && (
                      <span style={{ color: "rgba(148,163,184,0.4)" }}>Correlating all 6 data sources via AI pipeline…</span>
                    )}
                    {aiInsights}
                    {analyzing && <span className="nx-caret" />}
                  </div>
                )}
              </GlassCard>

              {/* Section: Interactive Telemetry Q&A Console */}
              <GlassCard style={{ border: "1px solid rgba(167,139,250,0.2)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.35)" }}>
                    <MessageSquare style={{ width: 14, height: 14, color: "#a78bfa" }} />
                  </div>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "#a78bfa", fontWeight: 700 }}>Telemetry Q&A Console</span>
                  {chatLoading && (
                    <span style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
                      <Cpu style={{ width: 10, height: 10, color: "#a78bfa", animation: "spin 1s linear infinite" }} />
                      <span style={{ fontSize: 9, color: "#a78bfa", fontFamily: "monospace" }}>AI COMPUTING</span>
                    </span>
                  )}
                </div>

                {/* Quick Query Chips */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                  {[
                    { label: "🚦 Analyze traffic bottlenecks",     query: "What are the current traffic bottlenecks and incidents?" },
                    { label: "🔒 Assess safety anomalies",          query: "Are there any CCTV security anomalies or crowd alerts?" },
                    { label: "🌿 Check air quality impact",          query: "What is the current air quality and pollution level impact?" },
                    { label: "📋 Summarize citizen issues",          query: "Summarize the current citizen complaints and critical issues." },
                    { label: "🏛️ Government data status",            query: "What is the status of government open data repositories?" },
                    { label: "☁️ Weather & visibility advisory",     query: "What are the weather conditions and any visibility advisories?" },
                  ].map((chip, i) => (
                    <button key={i} onClick={() => runChatQuery(chip.query)} disabled={chatLoading}
                      style={{
                        display: "flex", alignItems: "center", gap: 5,
                        padding: "5px 10px", background: "rgba(167,139,250,0.06)",
                        border: "1px solid rgba(167,139,250,0.22)", borderRadius: 20,
                        cursor: chatLoading ? "not-allowed" : "pointer", color: "rgba(167,139,250,0.85)",
                        fontSize: 9, fontFamily: "monospace", letterSpacing: "0.06em",
                        transition: "all 0.15s", opacity: chatLoading ? 0.5 : 1,
                        whiteSpace: "nowrap"
                      }}
                      onMouseEnter={e => { if (!chatLoading) { e.currentTarget.style.background = "rgba(167,139,250,0.15)"; e.currentTarget.style.borderColor = "rgba(167,139,250,0.5)"; }}}
                      onMouseLeave={e => { e.currentTarget.style.background = "rgba(167,139,250,0.06)"; e.currentTarget.style.borderColor = "rgba(167,139,250,0.22)"; }}
                    >
                      <ChevronRight style={{ width: 9, height: 9 }} />{chip.label}
                    </button>
                  ))}
                </div>

                {/* Chat Messages */}
                <div style={{
                  minHeight: 180, maxHeight: 280, overflowY: "auto", marginBottom: 10,
                  padding: "10px", background: "rgba(2,6,23,0.5)", borderRadius: 8,
                  border: "1px solid rgba(167,139,250,0.1)",
                  display: "flex", flexDirection: "column", gap: 8
                }}>
                  {chatHistory.length === 0 && (
                    <div style={{ color: "rgba(148,163,184,0.35)", fontFamily: "monospace", fontSize: 10, textAlign: "center", margin: "auto", padding: "20px 0" }}>
                      Ask me anything about the live city telemetry above…
                    </div>
                  )}
                  {chatHistory.map((msg, i) => (
                    <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
                      <div style={{
                        maxWidth: "88%", padding: "8px 12px", borderRadius: msg.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                        background: msg.role === "user" ? "rgba(167,139,250,0.15)" : "rgba(0,245,255,0.06)",
                        border: `1px solid ${msg.role === "user" ? "rgba(167,139,250,0.35)" : "rgba(0,245,255,0.15)"}`,
                        fontSize: 10.5, fontFamily: "monospace", lineHeight: 1.65,
                        color: msg.role === "user" ? "rgba(226,232,240,0.9)" : "rgba(226,232,240,0.85)",
                        whiteSpace: "pre-wrap", wordBreak: "break-word"
                      }}>
                        {msg.role === "ai" && !msg.text && <span style={{ color: "rgba(148,163,184,0.4)" }}>Processing…</span>}
                        {msg.text}
                        {msg.role === "ai" && chatLoading && i === chatHistory.length - 1 && <span className="nx-caret" />}
                      </div>
                      <span style={{ fontSize: 8, color: "rgba(148,163,184,0.3)", fontFamily: "monospace", marginTop: 2, marginLeft: 4, marginRight: 4 }}>
                        {msg.role === "user" ? "You" : "NEXUS AI"} · {msg.time}
                      </span>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>

                {/* Chat Input */}
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); runChatQuery(); } }}
                    placeholder="Ask about any city telemetry source…"
                    disabled={chatLoading}
                    style={{
                      flex: 1, padding: "9px 14px",
                      background: "rgba(2,6,23,0.7)", border: "1px solid rgba(167,139,250,0.25)",
                      borderRadius: 8, color: "rgba(226,232,240,0.9)", fontFamily: "monospace", fontSize: 10.5,
                      outline: "none", transition: "border-color 0.2s"
                    }}
                    onFocus={e => { e.target.style.borderColor = "rgba(167,139,250,0.6)"; }}
                    onBlur={e => { e.target.style.borderColor = "rgba(167,139,250,0.25)"; }}
                  />
                  <button
                    onClick={() => runChatQuery()}
                    disabled={chatLoading || !chatInput.trim()}
                    style={{
                      display: "flex", alignItems: "center", gap: 6, padding: "9px 16px",
                      background: chatLoading || !chatInput.trim() ? "rgba(167,139,250,0.05)" : "rgba(167,139,250,0.15)",
                      border: "1px solid rgba(167,139,250,0.35)", borderRadius: 8,
                      cursor: chatLoading || !chatInput.trim() ? "not-allowed" : "pointer",
                      color: "#a78bfa", fontSize: 10, fontFamily: "monospace",
                      opacity: chatLoading || !chatInput.trim() ? 0.5 : 1, transition: "all 0.2s"
                    }}
                  >
                    {chatLoading
                      ? <Cpu style={{ width: 12, height: 12, animation: "spin 1s linear infinite" }} />
                      : <Send style={{ width: 12, height: 12 }} />
                    }
                    SEND
                  </button>
                </div>
              </GlassCard>
            </div>
          )}
        </div>

        {/* RIGHT: Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Sensor stream log */}
          <GlassCard style={{ padding: "12px 14px" }}>
            <SectionHeader icon={Radio} title="Data Stream Log" color="#6E56FF" live />
            <div ref={logRef} style={{ height: 200, overflowY: "auto", fontFamily: "monospace", fontSize: 9, lineHeight: 1.7 }}>
              {streamLog.map((entry, i) => (
                <div key={i} style={{ color: entry.color, opacity: Math.max(0.3, 1 - i * 0.025) }}>
                  <span style={{ color: "rgba(148,163,184,0.3)", marginRight: 5 }}>{entry.time}</span>
                  {entry.msg}
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Data source health */}
          <GlassCard style={{ padding: "12px 14px" }}>
            <SectionHeader icon={Shield} title="Source Health" color="#34d399" />
            {[
              { name: "NYC DOT Feeds", key: "cameras",    color: "#00F5FF" },
              { name: "CCTV Network",  key: "cctv",       color: "#6E56FF" },
              { name: "Open-Meteo",    key: "weather",    color: "#38bdf8" },
              { name: "OpenAQ v3",     key: "airquality", color: "#fbbf24" },
              { name: "NYC 311",       key: "complaints", color: "#FF2E88" },
              { name: "NYC Open Data", key: "govdata",    color: "#34d399" },
            ].map((src, i) => {
              const isLoading = loading[src.key];
              const hasError  = !!errors[src.key];
              const status    = isLoading ? "loading" : hasError ? "error" : "ok";
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "6px 0", borderBottom: i < 5 ? "1px solid rgba(255,255,255,0.04)" : "none"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <StatusDot status={status === "ok" ? "online" : status === "error" ? "offline" : "warning"} />
                    <span style={{ fontSize: 9.5, color: "rgba(226,232,240,0.8)", fontFamily: "monospace" }}>{src.name}</span>
                  </div>
                  <span style={{ fontSize: 8.5, color: status === "ok" ? src.color : status === "error" ? "#ef4444" : "#fbbf24", fontFamily: "monospace" }}>
                    {isLoading ? "SYNCING…" : hasError ? "ERROR" : "LIVE"}
                  </span>
                </div>
              );
            })}
          </GlassCard>

          {/* Quick fetch individual sources */}
          <GlassCard style={{ padding: "12px 14px" }}>
            <SectionHeader icon={Zap} title="Quick Refresh" color="#00F5FF" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {[
                { label: "Cameras",    fn: fetchCameras,    color: "#00F5FF", key: "cameras" },
                { label: "CCTV",       fn: fetchCctv,       color: "#6E56FF", key: "cctv" },
                { label: "Weather",    fn: fetchWeather,    color: "#38bdf8", key: "weather" },
                { label: "Pollution",  fn: fetchAirQuality, color: "#fbbf24", key: "airquality" },
                { label: "311",        fn: fetchComplaints, color: "#FF2E88", key: "complaints" },
                { label: "Gov Data",   fn: fetchGovData,    color: "#34d399", key: "govdata" },
              ].map((btn, i) => (
                <button key={i} onClick={btn.fn} disabled={loading[btn.key]} style={{
                  padding: "6px 8px", borderRadius: 7, cursor: loading[btn.key] ? "not-allowed" : "pointer",
                  background: `${btn.color}10`, border: `1px solid ${btn.color}30`, color: btn.color,
                  fontSize: 9, fontFamily: "monospace", letterSpacing: "0.08em", textTransform: "uppercase",
                  transition: "all 0.15s", opacity: loading[btn.key] ? 0.6 : 1,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 4
                }}>
                  {loading[btn.key]
                    ? <Cpu style={{ width: 9, height: 9, animation: "spin 0.8s linear infinite" }} />
                    : <RefreshCw style={{ width: 9, height: 9 }} />
                  }
                  {btn.label}
                </button>
              ))}
            </div>
          </GlassCard>

          {/* Active alerts */}
          <GlassCard style={{ padding: "12px 14px" }}>
            <SectionHeader icon={AlertTriangle} title="Live Alerts" color="#fbbf24" />
            <div>
              {airQuality && airQuality.aqi > 100 && (
                <div style={{ display: "flex", gap: 7, padding: "5px 8px", background: "rgba(239,68,68,0.08)", borderRadius: 6, marginBottom: 5, border: "1px solid rgba(239,68,68,0.25)" }}>
                  <span style={{ fontSize: 11 }}>🔴</span>
                  <span style={{ fontSize: 9.5, color: "#f87171", fontFamily: "monospace" }}>AQI {airQuality.aqi} — {airQuality.aqi_category}</span>
                </div>
              )}
              {cctv && cctv.cameras?.some(c => c.ai_tag === "Alert") && (
                <div style={{ display: "flex", gap: 7, padding: "5px 8px", background: "rgba(239,68,68,0.08)", borderRadius: 6, marginBottom: 5, border: "1px solid rgba(239,68,68,0.2)" }}>
                  <span style={{ fontSize: 11 }}>🔴</span>
                  <span style={{ fontSize: 9.5, color: "#f87171", fontFamily: "monospace" }}>CCTV Anomaly Alert Active</span>
                </div>
              )}
              {incidents && incidents.total > 0 && (
                <div style={{ display: "flex", gap: 7, padding: "5px 8px", background: "rgba(251,191,36,0.08)", borderRadius: 6, marginBottom: 5, border: "1px solid rgba(251,191,36,0.2)" }}>
                  <span style={{ fontSize: 11 }}>🟡</span>
                  <span style={{ fontSize: 9.5, color: "#fbbf24", fontFamily: "monospace" }}>{incidents.total} live traffic incidents</span>
                </div>
              )}
              {complaints && complaints.stats?.critical > 5 && (
                <div style={{ display: "flex", gap: 7, padding: "5px 8px", background: "rgba(239,68,68,0.07)", borderRadius: 6, marginBottom: 5, border: "1px solid rgba(239,68,68,0.2)" }}>
                  <span style={{ fontSize: 11 }}>🔴</span>
                  <span style={{ fontSize: 9.5, color: "#f87171", fontFamily: "monospace" }}>{complaints.stats.critical} critical 311 tickets</span>
                </div>
              )}
              {weather && weather.condition?.includes("Rain") && (
                <div style={{ display: "flex", gap: 7, padding: "5px 8px", background: "rgba(56,189,248,0.07)", borderRadius: 6, marginBottom: 5, border: "1px solid rgba(56,189,248,0.2)" }}>
                  <span style={{ fontSize: 11 }}>🔵</span>
                  <span style={{ fontSize: 9.5, color: "#38bdf8", fontFamily: "monospace" }}>Rain advisory — {weather.condition}</span>
                </div>
              )}
              {weather && !weather.condition?.includes("Rain") && (!airQuality || airQuality.aqi <= 100) && (!incidents || incidents.total === 0) && (!complaints || complaints.stats?.critical <= 5) && (!cctv || !cctv.cameras?.some(c => c.ai_tag === "Alert")) && (
                <div style={{ fontSize: 10, color: "#34d399", fontFamily: "monospace", textAlign: "center", padding: "10px 0" }}>
                  ✅ All systems nominal
                </div>
              )}
              {!weather && !airQuality && !incidents && !complaints && (
                <div style={{ fontSize: 10, color: "rgba(148,163,184,0.5)", fontFamily: "monospace", textAlign: "center", padding: "10px 0" }}>
                  Loading data…
                </div>
              )}
            </div>
          </GlassCard>
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <div style={{
        marginTop: 18, padding: "10px 16px", background: "rgba(2,6,23,0.5)",
        borderRadius: 10, border: "1px solid rgba(0,245,255,0.08)",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 9, fontFamily: "monospace", color: "rgba(148,163,184,0.5)", flexWrap: "wrap" }}>
          <span style={{ color: "#34d399", display: "flex", alignItems: "center", gap: 5 }}>
            <span className="nx-pulse" style={{ width: 5, height: 5, borderRadius: "50%", background: "#34d399", display: "inline-block" }} />
            REAL DATA · 6 LIVE SOURCES
          </span>
          <span>Open-Meteo · Open-Meteo AQ · 511NY DOT · 511NY CCTV · NYC 311 · NYC Open Data</span>
          <span>AUTO: {autoRefresh ? "60s" : "PAUSED"}</span>
        </div>
        <span style={{ fontSize: 9, color: "rgba(148,163,184,0.35)", fontFamily: "monospace" }}>
          NEXUS URBAN INTELLIGENCE · LAST SYNC: {lastRefresh}
        </span>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
