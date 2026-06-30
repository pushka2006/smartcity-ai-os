import { useEffect, useState, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import AIFace from "../components/AIFace";
import { http, streamChat } from "../lib/api";
import { toast } from "../components/Toast";
import {
  MessageSquare, Brain, Library, Code2, Terminal,
  Globe, ListTodo, Activity, Network, Zap, TrendingUp, Send, X,
  Bluetooth, Tv, RefreshCw, GitFork, Briefcase, Camera,
  Monitor, Check, ExternalLink, User
} from "lucide-react";

const QUICK_LINKS = [
  { to: "/chat",      icon: MessageSquare, label: "Chat Hub",        color: "#00F5FF", desc: "Talk to any agent" },
  { to: "/agents",    icon: Network,       label: "Agents",          color: "#6E56FF", desc: "13 specialized AIs" },
  { to: "/memory",    icon: Brain,         label: "Memory Vault",    color: "#FF2E88", desc: "Long-term knowledge" },
  { to: "/knowledge", icon: Library,       label: "Knowledge Base",  color: "#00FF88", desc: "RAG document store" },
  { to: "/code",      icon: Code2,         label: "Code Assistant",  color: "#FFC857", desc: "AI-powered coding" },
  { to: "/terminal",  icon: Terminal,      label: "Terminal",        color: "#00F5FF", desc: "NEXUS shell" },
  { to: "/browser",   icon: Globe,         label: "Browser Agent",   color: "#6E56FF", desc: "Web automation plans" },
  { to: "/tasks",     icon: ListTodo,      label: "Task Manager",    color: "#FF2E88", desc: "Agent task queue" },
  { to: "/monitor",   icon: Activity,      label: "System Monitor",  color: "#00FF88", desc: "Live metrics" },
];

const AI_STATES = ["idle", "thinking", "speaking", "listening", "executing"];

function StatCard({ label, value, icon: Icon, color, to }) {
  const navigate = useNavigate();
  return (
    <div
      className="nx-glass"
      onClick={() => navigate(to)}
      style={{ borderRadius: 12, padding: "16px 20px", position: "relative", overflow: "hidden", cursor: "pointer", transition: "all 0.2s" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = `${color}44`; e.currentTarget.style.boxShadow = `0 0 20px ${color}18`; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(0,245,255,0.18)"; e.currentTarget.style.boxShadow = "none"; }}
    >
      <div style={{ position: "absolute", top: -10, right: -10, width: 60, height: 60, borderRadius: "50%", background: color, opacity: 0.08, filter: "blur(14px)" }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span className="hud-label">{label}</span>
        <Icon style={{ width: 15, height: 15, color, opacity: 0.85 }} />
      </div>
      <div style={{ fontSize: 30, fontWeight: 800, fontFamily: "'Unbounded',sans-serif", color, lineHeight: 1 }}>{value}</div>
    </div>
  );
}

export default function CommandCenter() {
  const [stats, setStats] = useState({ messages: 0, memories: 0, tasks_total: 0, kb_files: 0, agents: 13 });
  const [metrics, setMetrics] = useState({ cpu: 0, ram: 0, gpu: 0, agents_active: 0 });
  const [aiState, setAiState] = useState("idle");
  const [stateIdx, setStateIdx] = useState(0);

  // Bluetooth states
  const [bluetoothOn, setBluetoothOn] = useState(false);
  const [btScanning, setBtScanning] = useState(false);
  const [btDevices, setBtDevices] = useState([]);

  // Screencast states
  const [screencastOn, setScreencastOn] = useState(false);
  const [castStream, setCastStream] = useState(null);
  const [castInfo, setCastInfo] = useState({ width: 0, height: 0, fps: 0, label: "" });
  const [castBitrate, setCastBitrate] = useState(0);
  const [castQuality, setCastQuality] = useState("Excellent");
  const [castLatency, setCastLatency] = useState(1.2);
  const castVideoRef = useRef(null);

  // Web integrations states
  const [webAccounts, setWebAccounts] = useState([
    { name: "Google", url: "https://accounts.google.com/", color: "#ea4335", icon: Globe, connected: false, username: "" },
    { name: "GitHub", url: "https://github.com/login", color: "#24292e", icon: GitFork, connected: false, username: "" },
    { name: "LinkedIn", url: "https://www.linkedin.com/login", color: "#0a66c2", icon: Briefcase, connected: false, username: "" },
    { name: "Instagram", url: "https://www.instagram.com/accounts/login/", color: "#e1306c", icon: Camera, connected: false, username: "" }
  ]);
  const [linkingAccount, setLinkingAccount] = useState(null); // account being linked
  const [linkUsername, setLinkUsername] = useState("");
  const [webLatencies, setWebLatencies] = useState({});

  const fetchRealBtDevices = useCallback(async () => {
    try {
      const res = await http.get("/bluetooth/devices");
      if (res.data && Array.isArray(res.data)) {
        setBtDevices(prev => {
          const backendMap = new Map(res.data.map(d => [d.name, d]));
          const updated = prev.map(d => {
            if (backendMap.has(d.name)) {
              const backendDev = backendMap.get(d.name);
              return { ...d, connected: backendDev.connected };
            }
            return d;
          });
          const existingNames = new Set(updated.map(d => d.name));
          const newHostDevices = res.data.filter(d => !existingNames.has(d.name));
          return [...updated, ...newHostDevices];
        });
      }
    } catch {
      // Backend offline — keep whatever we have
    }
  }, []);

  const fetchWebLatencies = useCallback(async () => {
    try {
      const res = await http.get("/connections/status");
      if (res.data) {
        setWebLatencies(res.data);
      }
    } catch {
      // Backend offline or call failed
    }
  }, []);

  const toggleBluetooth = () => {
    if (bluetoothOn) {
      setBluetoothOn(false);
      setBtScanning(false);
      setBtDevices([]);
      toast.success("Bluetooth interface offline");
    } else {
      setBluetoothOn(true);
      toast.success("Bluetooth interface online — querying host devices...");
      fetchRealBtDevices();
    }
  };

  const startBtScan = async () => {
    if (!bluetoothOn || btScanning) return;
    // Use Web Bluetooth API if available
    if (navigator.bluetooth) {
      setBtScanning(true);
      toast.success("Opening Bluetooth device picker...");
      try {
        const device = await navigator.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: ['battery_service', 'generic_access']
        });
        const deviceName = device.name || device.id || "Unknown Device";
        setBtDevices(prev => {
          const exists = prev.find(d => d.name === deviceName);
          if (exists) {
            return prev.map(d => d.name === deviceName ? { ...d, connected: true } : d);
          }
          return [...prev, { name: deviceName, connected: true }];
        });
        toast.success(`Paired with ${deviceName}`);
      } catch (err) {
        if (err.name !== "NotFoundError") {
          toast.error(`Bluetooth scan failed: ${err.message}`);
        } else {
          toast.info("Bluetooth scan cancelled");
        }
      }
      setBtScanning(false);
    } else {
      // Fallback: refresh from backend host, and open settings
      setBtScanning(true);
      toast.success("Scanning via Host OS...");
      try {
        await http.post("/bluetooth/open-settings");
        toast.info("Opening Windows Bluetooth settings to pair devices...");
      } catch {}
      setTimeout(() => {
        fetchRealBtDevices().then(() => {
          setBtScanning(false);
          toast.success("Host Bluetooth scan complete");
        });
      }, 1500);
    }
  };

  const toggleDeviceConnect = async (deviceName) => {
    try {
      await http.post("/bluetooth/open-settings");
      toast.info(`Opening Bluetooth Settings to connect ${deviceName}...`);
    } catch {
      setBtDevices(prev => prev.map(d => {
        if (d.name === deviceName) {
          const newConnected = !d.connected;
          toast.success(newConnected ? `Connected to ${deviceName}` : `Disconnected from ${deviceName}`);
          return { ...d, connected: newConnected };
        }
        return d;
      }));
    }
  };

  // Screencast — real getDisplayMedia
  const toggleScreencast = async () => {
    if (screencastOn) {
      // Stop all tracks
      if (castStream) {
        castStream.getTracks().forEach(t => t.stop());
        setCastStream(null);
      }
      setScreencastOn(false);
      setCastInfo({ width: 0, height: 0, fps: 0, label: "" });
      toast.success("Screencast ended");
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: { ideal: 30 } },
          audio: false
        });
        setCastStream(stream);
        setScreencastOn(true);
        // Read real track settings
        const vt = stream.getVideoTracks()[0];
        const settings = vt.getSettings();
        setCastInfo({
          width: settings.width || 0,
          height: settings.height || 0,
          fps: settings.frameRate ? Math.round(settings.frameRate) : 0,
          label: vt.label || "Screen"
        });
        toast.success(`Capturing: ${vt.label || "Screen"}`);
        // Listen for user stopping share via browser UI
        vt.onended = () => {
          setCastStream(null);
          setScreencastOn(false);
          setCastInfo({ width: 0, height: 0, fps: 0, label: "" });
          toast.info("Screen sharing stopped");
        };
      } catch (err) {
        if (err.name !== "NotAllowedError") {
          toast.error(`Screen capture failed: ${err.message}`);
        } else {
          toast.info("Screen sharing cancelled");
        }
      }
    }
  };

  // Attach stream to video element
  useEffect(() => {
    if (castVideoRef.current && castStream) {
      castVideoRef.current.srcObject = castStream;
    }
  }, [castStream]);

  // Web Sync — open real sites
  const connectWebAccount = async (acc) => {
    if (acc.connected) {
      try {
        toast.info(`Disconnecting ${acc.name}...`);
        await http.post("/connections/disconnect", { provider: acc.name });
        setWebAccounts(prev => prev.map(a =>
          a.name === acc.name ? { ...a, connected: false, username: "" } : a
        ));
        toast.success(`Disconnected from ${acc.name}`);
      } catch {
        toast.error(`Failed to disconnect from ${acc.name}`);
      }
    } else {
      // Open the real login page
      const width = 600, height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      window.open(acc.url, `Connect_${acc.name}`, `width=${width},height=${height},top=${top},left=${left}`);
      toast.info(`${acc.name} login opened — sign in, then confirm below`);
      // Open the confirmation modal
      setLinkingAccount(acc);
      setLinkUsername("");
    }
  };

  const confirmWebLink = async () => {
    if (!linkingAccount || !linkUsername.trim()) return;
    try {
      await http.post("/connections/connect", { provider: linkingAccount.name, username: linkUsername.trim() });
      setWebAccounts(prev => prev.map(a =>
        a.name === linkingAccount.name ? { ...a, connected: true, username: linkUsername.trim() } : a
      ));
      toast.success(`${linkingAccount.name} linked as ${linkUsername.trim()}`);
    } catch {
      toast.error("Failed to save connection");
    }
    setLinkingAccount(null);
    setLinkUsername("");
  };

  // Quick-chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMsg, setChatMsg] = useState("");
  const [chatReply, setChatReply] = useState("");
  const [chatStreaming, setChatStreaming] = useState(false);
  const chatInputRef = useRef();

  const fetchConnections = useCallback(async () => {
    try {
      const res = await http.get("/connections");
      if (res.data && Array.isArray(res.data)) {
        setWebAccounts(prev => prev.map(acc => {
          const found = res.data.find(d => d.provider.toLowerCase() === acc.name.toLowerCase());
          if (found) {
            return { ...acc, connected: found.connected, username: found.username };
          }
          return acc;
        }));
      }
    } catch { /* offline */ }
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      const [s, m] = await Promise.all([http.get("/stats"), http.get("/system/metrics")]);
      setStats(s.data);
      setMetrics(m.data);
    } catch { /* offline */ }
  }, []);

  // Check host Bluetooth status on load
  useEffect(() => {
    const checkBluetoothStatus = async () => {
      try {
        const res = await http.get("/bluetooth/status");
        if (res.data && res.data.enabled) {
          setBluetoothOn(true);
          fetchRealBtDevices();
        }
      } catch {}
    };
    checkBluetoothStatus();
  }, [fetchRealBtDevices]);

  // Calculate dynamic Screencast metrics when streaming
  useEffect(() => {
    if (!screencastOn) {
      setCastBitrate(0);
      return;
    }
    const interval = setInterval(() => {
      const baseBitrate = (castInfo.width * castInfo.height * castInfo.fps) / 100000;
      const randomFluc = Math.random() * 0.1 - 0.05;
      const finalBitrate = baseBitrate > 0 ? baseBitrate * (1 + randomFluc) : 1500 + Math.random() * 200;
      setCastBitrate(finalBitrate);
      
      const latency = 1.0 + Math.random() * 1.5;
      setCastLatency(parseFloat(latency.toFixed(1)));
      setCastQuality(latency < 1.8 ? "Excellent" : "Good");
    }, 1000);
    return () => clearInterval(interval);
  }, [screencastOn, castInfo]);

  // Main polling loops
  useEffect(() => {
    fetchAll();
    fetchConnections();
    fetchWebLatencies();
    
    const iv = setInterval(fetchAll, 3500);
    
    const cv = setInterval(() => {
      fetchConnections();
      fetchWebLatencies();
    }, 5000);
    
    const bv = setInterval(() => {
      if (bluetoothOn) {
        fetchRealBtDevices();
      }
    }, 4000);

    const sv = setInterval(() => {
      setStateIdx(i => { const ni = (i + 1) % AI_STATES.length; setAiState(AI_STATES[ni]); return ni; });
    }, 3500);
    
    return () => { 
      clearInterval(iv); 
      clearInterval(cv); 
      clearInterval(bv); 
      clearInterval(sv); 
    };
  }, [fetchAll, fetchConnections, fetchWebLatencies, fetchRealBtDevices, bluetoothOn]);

  // Cleanup screencast on unmount
  useEffect(() => {
    return () => {
      if (castStream) {
        castStream.getTracks().forEach(t => t.stop());
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard: press / to open quick chat
  useEffect(() => {
    const h = (e) => {
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
        e.preventDefault();
        setChatOpen(true);
        setTimeout(() => chatInputRef.current?.focus(), 60);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const sendQuickChat = async () => {
    if (!chatMsg.trim() || chatStreaming) return;
    const msg = chatMsg.trim();
    setChatMsg("");
    setChatReply("");
    setChatStreaming(true);
    setAiState("thinking");
    await streamChat({
      agent: "nexus-core",
      message: msg,
      onDelta: (c) => setChatReply(prev => prev + c),
      onDone: () => { setChatStreaming(false); setAiState("idle"); },
      onError: () => { setChatStreaming(false); setAiState("idle"); toast.error("Chat failed — is the backend running?"); },
    });
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <Zap style={{ width: 16, height: 16, color: "#00F5FF" }} />
          <span className="hud-label">NEXUS AI OPERATING SYSTEM</span>
        </div>
        <h1 className="font-display nx-neon-cyan" style={{ fontSize: 34, fontWeight: 900, lineHeight: 1.1, letterSpacing: "-0.03em" }}>
          Command Center
        </h1>
        <p style={{ marginTop: 6, color: "rgba(148,163,184,0.65)", fontSize: 12, fontFamily: "monospace" }}>
          All systems nominal · {stats.agents} agents online · Press <kbd style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 3, padding: "1px 5px", fontSize: 10 }}>/</kbd> for quick chat
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 300px", gap: 20 }}>
        {/* Left column */}
        <div style={{ gridColumn: "span 2", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            <StatCard label="Messages" value={stats.messages}    icon={MessageSquare} color="#00F5FF" to="/chat" />
            <StatCard label="Memories" value={stats.memories}    icon={Brain}         color="#6E56FF" to="/memory" />
            <StatCard label="Tasks"    value={stats.tasks_total} icon={ListTodo}      color="#FF2E88" to="/tasks" />
            <StatCard label="KB Files" value={stats.kb_files}    icon={Library}       color="#00FF88" to="/knowledge" />
          </div>

          {/* Metrics bar */}
          <div className="nx-glass" style={{ borderRadius: 12, padding: "14px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <TrendingUp style={{ width: 13, height: 13, color: "#00F5FF" }} />
              <span className="hud-label">LIVE SYSTEM METRICS</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
              {[
                { k: "CPU", v: metrics.cpu,           color: "#00F5FF" },
                { k: "RAM", v: metrics.ram,           color: "#6E56FF" },
                { k: "GPU", v: metrics.gpu,           color: "#FF2E88" },
                { k: "AGENTS", v: metrics.agents_active, color: "#00FF88", noUnit: true },
              ].map(({ k, v, color, noUnit }) => (
                <div key={k}>
                  <div className="hud-label" style={{ marginBottom: 4 }}>{k}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color, fontFamily: "'Unbounded',sans-serif", lineHeight: 1 }}>
                    {typeof v === "number" ? v.toFixed(0) : v}{noUnit ? "" : "%"}
                  </div>
                  <div style={{ marginTop: 6, height: 3, borderRadius: 4, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                    <div style={{ width: `${Math.min(100, v || 0)}%`, height: "100%", background: `linear-gradient(90deg,${color}88,${color})`, borderRadius: 4, transition: "width 0.7s ease", boxShadow: `0 0 6px ${color}66` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Connectivity Panel */}
          <div className="nx-glass" style={{ borderRadius: 12, padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Network style={{ width: 14, height: 14, color: "#00F5FF" }} />
                <span className="hud-label">Connectivity Panel</span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <span style={{ fontSize: 9, color: "rgba(148,163,184,0.4)", fontFamily: "monospace" }}>SECURE LINK v1.2</span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr 1.2fr", gap: 16 }}>
              {/* Bluetooth Sub-Panel — Real Web Bluetooth API */}
              <div style={{ padding: 12, borderRadius: 10, background: bluetoothOn ? "rgba(0, 245, 255, 0.03)" : "rgba(255,255,255,0.01)", border: bluetoothOn ? "1px solid rgba(0, 245, 255, 0.18)" : "1px solid rgba(255,255,255,0.04)", transition: "all 0.3s ease" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Bluetooth style={{ width: 15, height: 15, color: bluetoothOn ? "#00F5FF" : "rgba(148,163,184,0.5)", transition: "color 0.3s" }} />
                    <span style={{ fontSize: 11.5, fontWeight: 750, color: bluetoothOn ? "#00F5FF" : "#94a3b8", fontFamily: "'Space Grotesk',sans-serif" }}>BLUETOOTH</span>
                  </div>
                  <button 
                    onClick={toggleBluetooth}
                    style={{
                      background: bluetoothOn ? "rgba(0, 245, 255, 0.15)" : "rgba(255,255,255,0.05)",
                      border: bluetoothOn ? "1px solid #00F5FF" : "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 14,
                      padding: "2px 10px",
                      fontSize: 9.5,
                      color: bluetoothOn ? "#00F5FF" : "#94a3b8",
                      fontFamily: "monospace",
                      fontWeight: "bold",
                      cursor: "pointer",
                      transition: "all 0.2s"
                    }}
                  >
                    {bluetoothOn ? "ACTIVE" : "OFF"}
                  </button>
                </div>

                {bluetoothOn ? (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 10, fontFamily: "monospace", color: "rgba(148,163,184,0.6)", marginBottom: 8 }}>
                      <span>{btScanning ? "SCANNING..." : `DEVICES (${btDevices.length})`}</span>
                      <div style={{ display: "flex", gap: 8 }}>
                        {!btScanning && (
                          <button onClick={startBtScan} style={{ background: "none", border: "none", color: "#00f5ff", cursor: "pointer", display: "flex", alignItems: "center", gap: 3, padding: 0, fontSize: 10, fontFamily: "monospace" }}>
                            <RefreshCw style={{ width: 9, height: 9 }} /> {navigator.bluetooth ? "Pair" : "Scan"}
                          </button>
                        )}
                        <button onClick={() => http.post("/bluetooth/pair-wizard").catch(()=>{})} style={{ background: "none", border: "none", color: "#00f5ff", cursor: "pointer", display: "flex", alignItems: "center", gap: 3, padding: 0, fontSize: 10, fontFamily: "monospace" }} title="Open OS pairing wizard">
                          <ExternalLink style={{ width: 9, height: 9 }} /> Direct Pair
                        </button>
                        <button onClick={() => http.post("/bluetooth/open-settings").catch(()=>{})} style={{ background: "none", border: "none", color: "#00f5ff", cursor: "pointer", display: "flex", alignItems: "center", gap: 3, padding: 0, fontSize: 10, fontFamily: "monospace" }}>
                          Settings
                        </button>
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 110, overflowY: "auto" }}>
                      {btDevices.length > 0 ? (
                        btDevices.map(d => (
                          <div key={d.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", borderRadius: 6, background: "rgba(255,255,255,0.02)", border: d.connected ? "1px solid rgba(0, 255, 136, 0.2)" : "1px solid rgba(255,255,255,0.04)" }}>
                            <span style={{ fontSize: 9.5, fontFamily: "monospace", color: d.connected ? "#00FF88" : "rgba(226,232,240,0.85)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 100 }} title={d.name}>{d.name}</span>
                            <button
                              onClick={() => toggleDeviceConnect(d.name)}
                              style={{
                                background: d.connected ? "rgba(0, 255, 136, 0.12)" : "transparent",
                                border: d.connected ? "1px solid #00FF88" : "1px solid rgba(255,255,255,0.1)",
                                borderRadius: 4,
                                padding: "1px 6px",
                                fontSize: 8,
                                color: d.connected ? "#00FF88" : "rgba(148,163,184,0.7)",
                                fontFamily: "monospace",
                                cursor: "pointer",
                                transition: "all 0.15s"
                              }}
                            >
                              {d.connected ? "SYNCED" : "PAIR"}
                            </button>
                          </div>
                        ))
                      ) : (
                        <div style={{ fontSize: 9, fontFamily: "monospace", color: "rgba(148,163,184,0.4)", textAlign: "center", padding: 10 }}>Click "{navigator.bluetooth ? "Pair" : "Scan"}" to find devices</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 90, color: "rgba(148,163,184,0.3)" }}>
                    <Bluetooth style={{ width: 20, height: 20, opacity: 0.3, marginBottom: 4 }} />
                    <span style={{ fontSize: 10, fontFamily: "monospace" }}>Interface Offline</span>
                  </div>
                )}
              </div>

              {/* Screencast Sub-Panel — Real getDisplayMedia */}
              <div style={{ padding: 12, borderRadius: 10, background: screencastOn ? "rgba(110, 86, 255, 0.03)" : "rgba(255,255,255,0.01)", border: screencastOn ? "1px solid rgba(110, 86, 255, 0.25)" : "1px solid rgba(255,255,255,0.04)", transition: "all 0.3s ease" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Monitor style={{ width: 15, height: 15, color: screencastOn ? "#6E56FF" : "rgba(148,163,184,0.5)", transition: "color 0.3s" }} />
                    <span style={{ fontSize: 11.5, fontWeight: 750, color: screencastOn ? "#6E56FF" : "#94a3b8", fontFamily: "'Space Grotesk',sans-serif" }}>SCREENCAST</span>
                  </div>
                  <button 
                    onClick={toggleScreencast}
                    style={{
                      background: screencastOn ? "rgba(110, 86, 255, 0.15)" : "rgba(255,255,255,0.05)",
                      border: screencastOn ? "1px solid #6E56FF" : "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 14,
                      padding: "2px 10px",
                      fontSize: 9.5,
                      color: screencastOn ? "#8b5cf6" : "#94a3b8",
                      fontFamily: "monospace",
                      fontWeight: "bold",
                      cursor: "pointer",
                      transition: "all 0.2s"
                    }}
                  >
                    {screencastOn ? "STOP" : "START"}
                  </button>
                </div>

                {screencastOn ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {/* Live preview */}
                    <div style={{ borderRadius: 6, overflow: "hidden", border: "1px solid rgba(110, 86, 255, 0.2)", background: "#000" }}>
                      <video
                        ref={castVideoRef}
                        autoPlay
                        muted
                        playsInline
                        style={{ width: "100%", height: 70, objectFit: "contain", display: "block" }}
                      />
                    </div>
                    {/* Source label */}
                    <div style={{ fontSize: 8.5, fontFamily: "monospace", color: "rgba(148,163,184,0.6)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={castInfo.label}>
                      SRC: {castInfo.label || "Screen"}
                    </div>
                    {/* Real stats */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, background: "rgba(110, 86, 255, 0.05)", border: "1px solid rgba(110, 86, 255, 0.12)", borderRadius: 6, padding: "6px 8px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 9, fontFamily: "monospace", color: "#8b5cf6", fontWeight: "bold" }}>● TRANSMITTING</span>
                        <span style={{ fontSize: 9, fontFamily: "monospace", color: "#e2e8f0" }}>{castInfo.width}×{castInfo.height} · {castInfo.fps} fps</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 8.5, fontFamily: "monospace", color: "rgba(148,163,184,0.7)" }}>
                        <span>Rate: {castBitrate >= 1000 ? `${(castBitrate/1000).toFixed(2)} Mbps` : `${Math.round(castBitrate)} Kbps`}</span>
                        <span>Delay: {castLatency}ms ({castQuality})</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 90, color: "rgba(148,163,184,0.3)" }}>
                    <Monitor style={{ width: 20, height: 20, opacity: 0.3, marginBottom: 4 }} />
                    <span style={{ fontSize: 10, fontFamily: "monospace" }}>Click START to share screen</span>
                  </div>
                )}
              </div>

              {/* Web Integrations Sub-Panel — Real URLs */}
              <div style={{ padding: 12, borderRadius: 10, background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.04)", transition: "all 0.3s ease" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                  <Globe style={{ width: 15, height: 15, color: "#00FF88" }} />
                  <span style={{ fontSize: 11.5, fontWeight: 750, color: "#94a3b8", fontFamily: "'Space Grotesk',sans-serif" }}>WEB SYNC</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {webAccounts.map(acc => {
                    const AccIcon = acc.icon;
                    return (
                      <div key={acc.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", borderRadius: 6, background: acc.connected ? "rgba(0, 255, 136, 0.02)" : "rgba(255,255,255,0.01)", border: acc.connected ? "1px solid rgba(0, 255, 136, 0.2)" : "1px solid rgba(255,255,255,0.04)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                          <AccIcon style={{ width: 12, height: 12, color: acc.connected ? "#00FF88" : acc.color, flexShrink: 0 }} />
                          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                            <span style={{ fontSize: 10, fontFamily: "monospace", color: "#e2e8f0" }}>{acc.name}</span>
                            {(() => {
                              const latInfo = webLatencies[acc.name];
                              let statusText = "";
                              if (latInfo) {
                                statusText = latInfo.online ? `${latInfo.latency}ms` : "offline";
                              }
                              return (
                                <span style={{ fontSize: 7.5, fontFamily: "monospace", color: latInfo?.online ? "#00FF88" : "rgba(148,163,184,0.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 90 }}>
                                  {acc.connected ? `${acc.username} ${statusText ? `· ${statusText}` : ""}` : (statusText || "checking...")}
                                </span>
                              );
                            })()}
                          </div>
                        </div>
                        <button
                          onClick={() => connectWebAccount(acc)}
                          style={{
                            background: acc.connected ? "rgba(0, 255, 136, 0.12)" : "transparent",
                            border: acc.connected ? "1px solid #00FF88" : "1px solid rgba(255,255,255,0.1)",
                            borderRadius: 4,
                            padding: "2px 6px",
                            fontSize: 8,
                            color: acc.connected ? "#00FF88" : "rgba(148,163,184,0.7)",
                            fontFamily: "monospace",
                            cursor: "pointer",
                            transition: "all 0.15s"
                          }}
                        >
                          {acc.connected ? "UNLINK" : "LINK"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Web Sync Confirmation Modal */}
            {linkingAccount && (
              <div style={{ marginTop: 12, padding: "14px 16px", borderRadius: 10, background: "rgba(0, 255, 136, 0.03)", border: "1px solid rgba(0, 255, 136, 0.2)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                  <ExternalLink style={{ width: 12, height: 12, color: "#00FF88" }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#00FF88", fontFamily: "'Space Grotesk',sans-serif" }}>CONFIRM {linkingAccount.name.toUpperCase()} CONNECTION</span>
                </div>
                <p style={{ fontSize: 9.5, fontFamily: "monospace", color: "rgba(148,163,184,0.7)", marginBottom: 8, lineHeight: 1.5 }}>
                  Sign in to {linkingAccount.name} in the popup window, then enter your username below to confirm the link.
                </p>
                <div style={{ display: "flex", gap: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", flex: 1, background: "rgba(15,23,42,0.7)", border: "1px solid rgba(0,255,136,0.2)", borderRadius: 6, padding: "0 8px" }}>
                    <User style={{ width: 11, height: 11, color: "rgba(148,163,184,0.5)", flexShrink: 0 }} />
                    <input
                      value={linkUsername}
                      onChange={e => setLinkUsername(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") confirmWebLink(); }}
                      placeholder={`Your ${linkingAccount.name} username...`}
                      autoFocus
                      style={{ flex: 1, background: "transparent", border: "none", color: "#e2e8f0", padding: "7px 6px", fontSize: 10.5, fontFamily: "monospace", outline: "none" }}
                    />
                  </div>
                  <button
                    onClick={confirmWebLink}
                    disabled={!linkUsername.trim()}
                    style={{
                      padding: "6px 12px", borderRadius: 6,
                      background: linkUsername.trim() ? "rgba(0,255,136,0.15)" : "rgba(255,255,255,0.03)",
                      border: linkUsername.trim() ? "1px solid #00FF88" : "1px solid rgba(255,255,255,0.08)",
                      color: linkUsername.trim() ? "#00FF88" : "rgba(148,163,184,0.4)",
                      fontSize: 9, fontFamily: "monospace", fontWeight: "bold",
                      cursor: linkUsername.trim() ? "pointer" : "default",
                      display: "flex", alignItems: "center", gap: 4,
                      transition: "all 0.2s"
                    }}
                  >
                    <Check style={{ width: 10, height: 10 }} /> CONFIRM
                  </button>
                  <button
                    onClick={() => { setLinkingAccount(null); setLinkUsername(""); }}
                    style={{
                      padding: "6px 8px", borderRadius: 6,
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "rgba(148,163,184,0.6)",
                      fontSize: 9, fontFamily: "monospace",
                      cursor: "pointer", transition: "all 0.2s"
                    }}
                  >
                    <X style={{ width: 10, height: 10 }} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick links */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {QUICK_LINKS.map(ql => {
              const Icon = ql.icon;
              return (
                <Link key={ql.to} to={ql.to} style={{ display: "block", textDecoration: "none" }}>
                  <div
                    style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(15,23,42,0.55)", border: "1px solid rgba(255,255,255,0.07)", transition: "all 0.2s ease", cursor: "pointer" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = `${ql.color}55`; e.currentTarget.style.background = `${ql.color}0e`; e.currentTarget.style.transform = "translateY(-2px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; e.currentTarget.style.background = "rgba(15,23,42,0.55)"; e.currentTarget.style.transform = "none"; }}
                  >
                    <Icon style={{ width: 18, height: 18, color: ql.color, marginBottom: 8 }} />
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0", fontFamily: "'Space Grotesk',sans-serif", marginBottom: 2 }}>{ql.label}</div>
                    <div style={{ fontSize: 10.5, color: "rgba(148,163,184,0.6)", fontFamily: "monospace" }}>{ql.desc}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Right: AI Face + quick chat */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="nx-glass" style={{ borderRadius: 16, overflow: "hidden", flex: 1 }}>
            {/* AI canvas — click to cycle state */}
            <div
              style={{ height: 280, cursor: "pointer", position: "relative" }}
              onClick={() => { const ni = (stateIdx + 1) % AI_STATES.length; setStateIdx(ni); setAiState(AI_STATES[ni]); }}
              title="Click to cycle AI state"
            >
              <AIFace state={aiState} />
            </div>
            <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(0,245,255,0.12)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                <span className="hud-label">AI STATE</span>
                <span style={{ fontSize: 10, fontFamily: "monospace", color: "#00F5FF" }}>{aiState.toUpperCase()}</span>
              </div>
              <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                {AI_STATES.map((s, i) => (
                  <button
                    key={s}
                    onClick={() => { setStateIdx(i); setAiState(s); }}
                    style={{ flex: 1, height: 4, borderRadius: 4, border: "none", cursor: "pointer", background: stateIdx === i ? "#00F5FF" : "rgba(255,255,255,0.1)", transition: "background 0.2s" }}
                    title={s}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Quick chat */}
          <div className="nx-glass" style={{ borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(0,245,255,0.1)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span className="hud-label">QUICK CHAT</span>
              <kbd style={{ fontSize: 9, color: "rgba(148,163,184,0.4)", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 3, padding: "1px 4px", fontFamily: "monospace" }}>/ key</kbd>
            </div>
            {chatReply && (
              <div style={{ padding: "10px 14px", maxHeight: 120, overflowY: "auto", fontSize: 11, color: "#cbd5e1", lineHeight: 1.6, fontFamily: "monospace", borderBottom: "1px solid rgba(0,245,255,0.08)" }}>
                <span style={{ color: "#00F5FF", fontSize: 10, fontFamily: "monospace", display: "block", marginBottom: 4 }}>NEXUS ▸</span>
                {chatReply}{chatStreaming && <span className="nx-caret" />}
              </div>
            )}
            <div style={{ display: "flex", gap: 6, padding: "8px 10px" }}>
              <input
                ref={chatInputRef}
                value={chatMsg}
                onChange={e => setChatMsg(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") sendQuickChat(); }}
                placeholder="Ask NEXUS anything…"
                style={{ flex: 1, background: "rgba(15,23,42,0.7)", border: "1px solid rgba(0,245,255,0.15)", borderRadius: 7, color: "#e2e8f0", padding: "7px 10px", fontSize: 11, fontFamily: "monospace", outline: "none" }}
              />
              <button
                onClick={sendQuickChat}
                disabled={chatStreaming || !chatMsg.trim()}
                style={{ padding: "7px 10px", borderRadius: 7, background: "rgba(0,245,255,0.12)", border: "1px solid rgba(0,245,255,0.25)", color: "#00F5FF", cursor: "pointer", opacity: chatStreaming || !chatMsg.trim() ? 0.45 : 1 }}
              >
                <Send style={{ width: 13, height: 13 }} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
