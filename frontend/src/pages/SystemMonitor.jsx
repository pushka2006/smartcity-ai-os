import { useState, useCallback, useEffect, useRef } from "react";
import { http } from "../lib/api";
import { toast } from "../components/Toast";
import { Activity, Cpu, HardDrive, Wifi, Zap, Server, Pause, Play, Download, AlertTriangle, Bluetooth, Headphones, MousePointer, Keyboard, Video, Monitor, Settings, ExternalLink, RefreshCw } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

const METRIC_KEYS = ["cpu", "ram", "gpu", "net"];
const METRIC_COLORS = { cpu: "#00F5FF", ram: "#6E56FF", gpu: "#FF2E88", net: "#00FF88" };

function GaugeCard({ label, value, color, icon: Icon, alertThreshold = 85 }) {
  const isAlert = value > alertThreshold;
  return (
    <div
      className="nx-glass"
      style={{ borderRadius: 12, padding: "14px 18px", borderColor: isAlert ? `${color}66` : undefined, boxShadow: isAlert ? `0 0 24px ${color}22` : undefined, transition: "all 0.4s" }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Icon style={{ width: 14, height: 14, color }} />
          <span className="hud-label">{label}</span>
        </div>
        {isAlert && <AlertTriangle style={{ width: 13, height: 13, color: "#FFC857" }} />}
        <span style={{ fontFamily: "'Unbounded',sans-serif", fontSize: 24, fontWeight: 800, color, lineHeight: 1 }}>{typeof value === "number" ? value.toFixed(1) : value}%</span>
      </div>
      <div style={{ height: 7, borderRadius: 6, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${Math.min(100, value || 0)}%`,
          background: `linear-gradient(90deg, ${color}88, ${color})`,
          borderRadius: 6, transition: "width 0.55s ease",
          boxShadow: `0 0 8px ${color}55`,
        }} />
      </div>
      <div style={{ marginTop: 5, fontSize: 10, color: isAlert ? "#FFC857" : "rgba(148,163,184,0.4)", fontFamily: "monospace", fontWeight: isAlert ? 600 : 400 }}>
        {isAlert ? "⚠ HIGH LOAD" : value < 30 ? "LOW" : value < 70 ? "MODERATE" : "HIGH"} LOAD
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "rgba(6,13,34,0.95)", border: "1px solid rgba(0,245,255,0.2)", borderRadius: 8, padding: "8px 12px", fontSize: 11, fontFamily: "monospace" }}>
      {payload.map(p => <div key={p.dataKey} style={{ color: p.color }}>{p.dataKey.toUpperCase()}: {Number(p.value).toFixed(1)}%</div>)}
    </div>
  );
};

export default function SystemMonitor() {
  const [metrics, setMetrics] = useState({ cpu: 0, ram: 0, gpu: 0, disk: 0, network: 0, agents_active: 0, tasks_running: 0 });
  const [series, setSeries] = useState([]);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState({ cpu: true, ram: true, gpu: true, net: true });
  const [devices, setDevices] = useState([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const mounted = useRef(true);
  const pausedRef = useRef(false);
  const ivRef = useRef(null);

  // Keep pausedRef in sync so the stable interval callback can read it
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  const loadMetrics = useCallback(async () => {
    if (!mounted.current || pausedRef.current) return;
    try {
      const [m, s] = await Promise.all([
        http.get("/system/metrics"),
        http.get("/system/series?points=50"),
      ]);
      if (mounted.current) {
        setMetrics(m.data);
        setSeries(s.data);
      }
    } catch (err) {
      console.warn("Metrics fetch failed:", err?.message);
    }
  }, []); // stable — no deps that change

  const loadDevices = useCallback(async () => {
    if (!mounted.current) return;
    setDevicesLoading(true);
    try {
      const res = await http.get("/system/devices");
      if (mounted.current) setDevices(res.data);
    } catch {}
    if (mounted.current) setDevicesLoading(false);
  }, []);

  useEffect(() => {
    mounted.current = true;
    // Immediate first load
    loadMetrics();
    loadDevices();
    // Stable intervals — won't re-create on every render
    ivRef.current = setInterval(loadMetrics, 2000);
    const dvIv = setInterval(loadDevices, 5000);
    return () => {
      mounted.current = false;
      clearInterval(ivRef.current);
      clearInterval(dvIv);
    };
  }, [loadMetrics, loadDevices]); // both are now stable (empty deps)

  const exportMetrics = () => {
    const blob = new Blob([JSON.stringify({ metrics, series, exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "nexus-metrics.json"; a.click();
    URL.revokeObjectURL(url);
    toast.success("Metrics exported as JSON");
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div className="hud-label" style={{ marginBottom: 4 }}>SYSTEM TELEMETRY</div>
          <h1 className="font-display nx-neon-cyan" style={{ fontSize: 26, fontWeight: 800 }}>System Monitor</h1>
          <p style={{ marginTop: 3, fontSize: 11, color: "rgba(148,163,184,0.5)", fontFamily: "monospace" }}>
            Live metrics · {paused ? "⏸ paused" : "updates every 2s"} · alerts at >85%
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => { setPaused(p => !p); toast.info(paused ? "Monitoring resumed" : "Monitoring paused"); }}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, background: paused ? "rgba(255,199,87,0.12)" : "rgba(0,245,255,0.08)", border: `1px solid ${paused ? "rgba(255,199,87,0.3)" : "rgba(0,245,255,0.2)"}`, color: paused ? "#FFC857" : "#00F5FF", cursor: "pointer", fontSize: 12, fontFamily: "monospace" }}
          >
            {paused ? <><Play style={{ width: 13, height: 13 }} /> Resume</> : <><Pause style={{ width: 13, height: 13 }} /> Pause</>}
          </button>
          <button onClick={exportMetrics} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.2)", color: "#00FF88", cursor: "pointer", fontSize: 12, fontFamily: "monospace" }}>
            <Download style={{ width: 13, height: 13 }} /> Export JSON
          </button>
        </div>
      </div>

      {/* Gauges */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 22 }}>
        <GaugeCard label="CPU"     value={metrics.cpu}     color="#00F5FF" icon={Cpu} />
        <GaugeCard label="RAM"     value={metrics.ram}     color="#6E56FF" icon={Server} />
        <GaugeCard label="GPU"     value={metrics.gpu}     color="#FF2E88" icon={Zap} />
        <GaugeCard label="NETWORK" value={metrics.network} color="#00FF88" icon={Wifi} />
      </div>

      {/* Info strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 22 }}>
        {[
          { label: "DISK",        value: `${metrics.disk?.toFixed(1)}%`,  icon: HardDrive, color: "#FFC857" },
          { label: "AGENTS",      value: metrics.agents_active,            icon: Server,    color: "#00F5FF" },
          { label: "TASKS",       value: metrics.tasks_running,            icon: Zap,       color: "#FF2E88" },
          { label: "NET LOAD",    value: `${metrics.network?.toFixed(0)}%`,icon: Wifi,      color: "#00FF88" },
          { label: "CPU PEAK",    value: `${metrics.cpu?.toFixed(0)}%`,    icon: Cpu,       color: "#6E56FF" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="nx-glass" style={{ borderRadius: 10, padding: "12px 14px", textAlign: "center" }}>
            <Icon style={{ width: 16, height: 16, color, margin: "0 auto 5px" }} />
            <div style={{ fontSize: 19, fontWeight: 800, color, fontFamily: "'Unbounded',sans-serif", lineHeight: 1 }}>{value}</div>
            <div className="hud-label" style={{ marginTop: 5, fontSize: "0.58rem" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="nx-glass" style={{ borderRadius: 14, padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Activity style={{ width: 13, height: 13, color: "#00F5FF" }} />
            <span className="hud-label">PERFORMANCE TIMELINE</span>
          </div>
          {/* Toggleable legend */}
          <div style={{ display: "flex", gap: 10 }}>
            {METRIC_KEYS.map(k => (
              <button key={k} onClick={() => setVisible(v => ({ ...v, [k]: !v[k] }))}
                style={{ fontSize: 11, fontFamily: "monospace", padding: "3px 9px", borderRadius: 12, border: `1px solid ${METRIC_COLORS[k]}44`, background: visible[k] ? `${METRIC_COLORS[k]}14` : "rgba(255,255,255,0.04)", color: visible[k] ? METRIC_COLORS[k] : "rgba(148,163,184,0.4)", cursor: "pointer", transition: "all 0.15s", textDecoration: visible[k] ? "none" : "line-through" }}
              >{k.toUpperCase()}</button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={230}>
          <LineChart data={series}>
            <CartesianGrid strokeDasharray="2 4" stroke="rgba(0,245,255,0.06)" />
            <XAxis dataKey="t" hide />
            <YAxis domain={[0, 100]} tick={{ fill: "rgba(148,163,184,0.4)", fontSize: 10, fontFamily: "monospace" }} tickFormatter={v => `${v}%`} width={36} />
            <Tooltip content={<CustomTooltip />} />
            {METRIC_KEYS.map(k => visible[k] && (
              <Line key={k} type="monotone" dataKey={k} stroke={METRIC_COLORS[k]} strokeWidth={1.8} dot={false} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Connected Devices & Pairing */}
      <div className="nx-glass" style={{ borderRadius: 14, padding: "18px 22px", marginTop: 22 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, borderBottom: "1px solid rgba(0,245,255,0.1)", paddingBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Bluetooth style={{ width: 15, height: 15, color: "#00F5FF" }} />
            <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 13.5, fontWeight: 700, color: "#e2e8f0", letterSpacing: "0.05em" }}>CONNECTED DEVICES & PAIRING</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => http.post("/bluetooth/pair-wizard").catch(()=>{})}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, background: "rgba(0,245,255,0.12)", border: "1px solid rgba(0,245,255,0.3)", color: "#00F5FF", cursor: "pointer", fontSize: 11, fontFamily: "monospace", transition: "all 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,245,255,0.2)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,245,255,0.12)"; }}
            >
              <ExternalLink style={{ width: 11, height: 11 }} /> Pair Device (OS Wizard)
            </button>
            <button
              onClick={() => http.post("/bluetooth/open-settings").catch(()=>{})}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(148,163,184,0.85)", cursor: "pointer", fontSize: 11, fontFamily: "monospace", transition: "all 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
            >
              <Settings style={{ width: 11, height: 11 }} /> OS Settings
            </button>
            <button
              onClick={loadDevices}
              disabled={devicesLoading}
              style={{ display: "flex", alignItems: "center", justifyItems: "center", padding: "6px 10px", borderRadius: 8, background: "transparent", border: "none", color: "#00FF88", cursor: "pointer", opacity: devicesLoading ? 0.5 : 1 }}
            >
              <RefreshCw style={{ width: 12, height: 12, animation: devicesLoading ? "spin 1s linear infinite" : "none" }} />
            </button>
          </div>
        </div>

        {devices.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
            {devices.map((dev, i) => {
              // Determine appropriate icon based on class
              let DevIcon = Cpu;
              let devColor = "#94a3b8";
              const cls = dev.class.toLowerCase();
              if (cls.includes("bluetooth")) {
                DevIcon = Bluetooth;
                devColor = "#00F5FF";
              } else if (cls.includes("audio") || cls.includes("media") || dev.name.toLowerCase().includes("headphone") || dev.name.toLowerCase().includes("speaker") || dev.name.toLowerCase().includes("airpods") || dev.name.toLowerCase().includes("noise 4") || dev.name.toLowerCase().includes("rockerz")) {
                DevIcon = Headphones;
                devColor = "#6E56FF";
              } else if (cls.includes("mouse")) {
                DevIcon = MousePointer;
                devColor = "#FF2E88";
              } else if (cls.includes("keyboard")) {
                DevIcon = Keyboard;
                devColor = "#FFC857";
              } else if (cls.includes("camera") || cls.includes("image")) {
                DevIcon = Video;
                devColor = "#00FF88";
              } else if (cls.includes("monitor") || cls.includes("display")) {
                DevIcon = Monitor;
                devColor = "#FF6B6B";
              }

              return (
                <div
                  key={`${dev.name}-${i}`}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", transition: "all 0.2s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = `${devColor}33`; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.04)"; e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
                >
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: `${devColor}10`, border: `1px solid ${devColor}28`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <DevIcon style={{ width: 16, height: 16, color: devColor }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "monospace" }} title={dev.name}>
                      {dev.name}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                      <span style={{ fontSize: 8.5, fontFamily: "monospace", color: "rgba(148,163,184,0.5)", textTransform: "uppercase" }}>{dev.class}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 3.5 }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: dev.status === "OK" ? "#00FF88" : "#FF4D4D", boxShadow: dev.status === "OK" ? "0 0 5px #00FF88" : "none" }} />
                        <span style={{ fontSize: 8.5, fontFamily: "monospace", color: dev.status === "OK" ? "#00FF88" : "#FF4D4D" }}>{dev.status}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "20px 0", color: "rgba(148,163,184,0.4)", fontFamily: "monospace", fontSize: 12 }}>
            No connected devices detected
          </div>
        )}
      </div>
    </div>
  );
}
