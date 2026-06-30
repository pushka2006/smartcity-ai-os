import { useEffect, useRef, useState, useCallback } from "react";
import { Camera, CameraOff, Video, Sparkles, Trash2, Download, Activity } from "lucide-react";
import { toast } from "../components/Toast";

export default function CameraConsole() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const activeStreamRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [mirror, setMirror] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [flash, setFlash] = useState(false);
  const [snapshots, setSnapshots] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("nexus_camera_snapshots") || "[]");
    } catch {
      return [];
    }
  });

  // Diagnostics states
  const [fps, setFps] = useState(0);
  const [frameCount, setFrameCount] = useState(0);
  const [cpuLoad, setCpuLoad] = useState(0);
  const [ramLoad, setRamLoad] = useState(0);

  const frameCounterRef = useRef(0);
  const rotationAngleRef = useRef(0);
  const scanPosRef = useRef(0);
  const scanDirectionRef = useRef(1);
  const animationRef = useRef(null);

  // Load devices list
  const getDevices = useCallback(async () => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter((d) => d.kind === "videoinput");
      setDevices(videoDevices);
      setSelectedDevice((curr) => {
        if (videoDevices.length > 0 && !curr) {
          return videoDevices[0].deviceId;
        }
        return curr;
      });
    } catch (err) {
      console.warn("Failed to enumerate video inputs", err);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach((track) => track.stop());
      activeStreamRef.current = null;
    }
    setCameraActive(false);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Start webcam stream
  const startCamera = useCallback(async (deviceId) => {
    stopCamera();
    setErrorMsg("");
    try {
      const constraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: 640, height: 480 }
          : { width: 640, height: 480 },
        audio: false,
      };
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      activeStreamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch(e => console.warn("Video play failed:", e));
      }
      setCameraActive(true);
      toast.success("Webcam telemetry streaming initialized");
    } catch (err) {
      console.warn("Camera permissions blocked / hardware not found:", err);
      setCameraActive(false);
      setErrorMsg("PHYSICAL CAM DISCONNECTED / BLOCKED. RETURNING MOCK VECTOR HUD.");
    }
  }, [stopCamera]);

  // Sync devices list and start stream
  useEffect(() => {
    getDevices();
    startCamera(selectedDevice);
    return () => {
      stopCamera();
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [selectedDevice, getDevices, startCamera, stopCamera]);

  // Save snapshots to local storage
  useEffect(() => {
    localStorage.setItem("nexus_camera_snapshots", JSON.stringify(snapshots));
  }, [snapshots]);

  // Diagnostics interval loop
  useEffect(() => {
    const iv = setInterval(() => {
      if (cameraActive) {
        setFps(parseFloat((29.4 + Math.random() * 0.9).toFixed(1)));
        setFrameCount(frameCounterRef.current);
        setCpuLoad(Math.floor(12 + Math.random() * 8));
        setRamLoad(Math.floor(45 + Math.random() * 5));
      } else {
        setFps(0);
        setCpuLoad(0);
        setRamLoad(0);
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [cameraActive]);

  // Draw cyber HUD on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const drawHUD = () => {
      const w = canvas.width;
      const h = canvas.height;
      frameCounterRef.current++;

      ctx.clearRect(0, 0, w, h);

      // Draw background stream or static grid
      if (cameraActive && videoRef.current && videoRef.current.readyState >= 2) {
        ctx.save();
        if (mirror) {
          ctx.translate(w, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(videoRef.current, 0, 0, w, h);
        ctx.restore();

        // Cyber theme overlay filter
        ctx.fillStyle = "rgba(6, 13, 34, 0.16)";
        ctx.fillRect(0, 0, w, h);
      } else {
        // stand-by radar grid
        ctx.fillStyle = "#030712";
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = "rgba(0, 245, 255, 0.04)";
        ctx.lineWidth = 1;
        const gridGap = 24;
        for (let x = 0; x < w; x += gridGap) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        }
        for (let y = 0; y < h; y += gridGap) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        }

        // Radar circle sweeps
        ctx.strokeStyle = "rgba(0, 245, 255, 0.15)";
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, 100 + Math.sin(Date.now() * 0.003) * 5, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = "rgba(255, 46, 136, 0.1)";
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, 150, 0, Math.PI * 2);
        ctx.stroke();

        // Standby alert banner
        ctx.fillStyle = "rgba(239, 68, 68, 0.08)";
        ctx.fillRect(w / 2 - 130, h / 2 - 18, 260, 36);
        ctx.strokeStyle = "rgba(239, 68, 68, 0.35)";
        ctx.strokeRect(w / 2 - 130, h / 2 - 18, 260, 36);

        ctx.fillStyle = "#ef4444";
        ctx.font = "bold 11px monospace";
        ctx.textAlign = "center";
        ctx.fillText("SIGNAL LOSS // WEB_STREAM_OFFLINE", w / 2, h / 2 + 4);
      }

      const accentColor = cameraActive ? "#00F5FF" : "#94a3b8";

      // 1. Grid / Scanlines Overlay
      if (showGrid && cameraActive) {
        ctx.strokeStyle = "rgba(0, 245, 255, 0.05)";
        ctx.lineWidth = 1;
        for (let y = 0; y < h; y += 12) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        }
      }

      // 2. Corner brackets
      const padding = 20;
      const length = 24;
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 2.5;

      // Top-Left
      ctx.beginPath();
      ctx.moveTo(padding, padding + length); ctx.lineTo(padding, padding); ctx.lineTo(padding + length, padding);
      ctx.stroke();
      // Top-Right
      ctx.beginPath();
      ctx.moveTo(w - padding, padding + length); ctx.lineTo(w - padding, padding); ctx.lineTo(w - padding - length, padding);
      ctx.stroke();
      // Bottom-Left
      ctx.beginPath();
      ctx.moveTo(padding, h - padding - length); ctx.lineTo(padding, h - padding); ctx.lineTo(padding + length, h - padding);
      ctx.stroke();
      // Bottom-Right
      ctx.beginPath();
      ctx.moveTo(w - padding, h - padding - length); ctx.lineTo(w - padding, h - padding); ctx.lineTo(w - padding - length, h - padding);
      ctx.stroke();

      // 3. Central targeting crosshairs
      ctx.strokeStyle = cameraActive ? "rgba(0, 245, 255, 0.4)" : "rgba(148, 163, 184, 0.2)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      // Horizontal crosshair dashes
      ctx.moveTo(w / 2 - 25, h / 2); ctx.lineTo(w / 2 - 10, h / 2);
      ctx.moveTo(w / 2 + 10, h / 2); ctx.lineTo(w / 2 + 25, h / 2);
      // Vertical crosshair dashes
      ctx.moveTo(w / 2, h / 2 - 25); ctx.lineTo(w / 2, h / 2 - 10);
      ctx.moveTo(w / 2, h / 2 + 10); ctx.lineTo(w / 2, h / 2 + 25);
      ctx.stroke();

      // Target ring
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 40, 0, Math.PI * 2);
      ctx.stroke();

      // Rotating compass azimuth
      rotationAngleRef.current += 0.006;
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(rotationAngleRef.current);
      ctx.setLineDash([4, 16]);
      ctx.strokeStyle = cameraActive ? "rgba(0, 245, 255, 0.25)" : "rgba(148, 163, 184, 0.1)";
      ctx.beginPath();
      ctx.arc(0, 0, 72, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      ctx.setLineDash([]); // reset

      // 4. Scanning Sweep line
      if (cameraActive) {
        scanPosRef.current += scanDirectionRef.current * 3;
        if (scanPosRef.current > h - 40) scanDirectionRef.current = -1;
        if (scanPosRef.current < 40) scanDirectionRef.current = 1;

        const scanGrad = ctx.createLinearGradient(0, scanPosRef.current - 14, 0, scanPosRef.current + 14);
        scanGrad.addColorStop(0, "rgba(0, 245, 255, 0)");
        scanGrad.addColorStop(0.5, "rgba(0, 245, 255, 0.2)");
        scanGrad.addColorStop(1, "rgba(0, 245, 255, 0)");

        ctx.fillStyle = scanGrad;
        ctx.fillRect(padding + 2, scanPosRef.current - 14, w - (padding * 2) - 4, 28);

        ctx.strokeStyle = "rgba(0, 245, 255, 0.6)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(padding + 4, scanPosRef.current);
        ctx.lineTo(w - padding - 4, scanPosRef.current);
        ctx.stroke();
      }

      // 5. HUD Telemetry overlay texts
      ctx.fillStyle = cameraActive ? "rgba(0, 245, 255, 0.85)" : "rgba(148, 163, 184, 0.5)";
      ctx.font = "9px monospace";
      
      // Top HUD tags
      ctx.textAlign = "left";
      ctx.fillText("CAM_PORT: DEV_WEB_0", padding + 10, padding + 15);
      ctx.textAlign = "right";
      ctx.fillText(`BUFFER: nominal`, w - padding - 10, padding + 15);

      // Bottom HUD tags
      ctx.textAlign = "left";
      ctx.fillText("RESOL: 640x480 (1.33:1)", padding + 10, h - padding - 10);
      ctx.textAlign = "right";
      ctx.fillText("SIGNAL: nominal", w - padding - 10, h - padding - 10);

      animationRef.current = requestAnimationFrame(drawHUD);
    };

    drawHUD();
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [cameraActive, mirror, showGrid]);

  // Capture Snapshot
  const captureSnapshot = () => {
    if (!canvasRef.current) return;
    
    // Trigger visual flash
    setFlash(true);
    setTimeout(() => setFlash(false), 200);
    
    // Create capturing canvas for final export
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = 640;
    exportCanvas.height = 480;
    const ctx = exportCanvas.getContext("2d");

    if (cameraActive && videoRef.current) {
      ctx.save();
      if (mirror) {
        ctx.translate(640, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(videoRef.current, 0, 0, 640, 480);
      ctx.restore();
    } else {
      // Standby frame
      ctx.fillStyle = "#030712";
      ctx.fillRect(0, 0, 640, 480);
      ctx.strokeStyle = "#00F5FF";
      ctx.strokeRect(20, 20, 600, 440);
      ctx.fillStyle = "#00F5FF";
      ctx.font = "24px monospace";
      ctx.textAlign = "center";
      ctx.fillText("NEXUS CAM SIMULATOR PREVIEW", 320, 240);
    }

    const dataUrl = exportCanvas.toDataURL("image/jpeg", 0.9);
    const newSnapshot = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      url: dataUrl,
    };

    setSnapshots((prev) => [newSnapshot, ...prev]);
    toast.success("Snapshot logged to local vault");
  };

  // Delete snapshot
  const deleteSnapshot = (id) => {
    setSnapshots((prev) => prev.filter((snap) => snap.id !== id));
    toast.info("Snapshot purged");
  };

  // Download snapshot
  const downloadSnapshot = (snap) => {
    const a = document.createElement("a");
    a.href = snap.url;
    a.download = `nexus-capture-${new Date(snap.timestamp).getTime()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("Snapshot downloaded");
  };

  const inputStyle = {
    background: "rgba(15,23,42,0.85)",
    border: "1px solid rgba(0,245,255,0.22)",
    borderRadius: 8,
    color: "#e2e8f0",
    padding: "8px 12px",
    fontSize: 12,
    fontFamily: "monospace",
    outline: "none",
    cursor: "pointer",
  };

  return (
    <div style={{ maxWidth: 1080, display: "grid", gridTemplateColumns: "1fr 340px", gap: 20 }}>
      {/* Header */}
      <div style={{ gridColumn: "span 2" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Video style={{ width: 16, height: 16, color: "#00F5FF" }} />
          <span className="hud-label">CAM_SECTOR // OPERATOR_VIEW</span>
        </div>
        <h1 className="font-display nx-neon-cyan" style={{ fontSize: 26, fontWeight: 900 }}>
          Camera Console
        </h1>
        <p style={{ marginTop: 3, fontSize: 11, color: "rgba(148, 163, 184, 0.5)", fontFamily: "monospace" }}>
          Monitor system camera matrices, configure filters, and capture high-resolution environment logs.
        </p>
      </div>

      {/* Left Column: Video Monitor & Action Bar */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Stream Card */}
        <div className="nx-glass" style={{ borderRadius: 14, padding: "18px 22px", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ width: "100%", display: "flex", justifyBetween: "space-between", alignItems: "center", marginBottom: 14, borderBottom: "1px solid rgba(0,245,255,0.1)", paddingBottom: 10 }}>
            <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>Live Surveillance Terminal</span>
            <span style={{ fontSize: 10, color: cameraActive ? "#00FF88" : "#94a3b8", fontFamily: "monospace", display: "flex", alignItems: "center", gap: 4 }}>
              <span className={cameraActive ? "nx-pulse" : ""} style={{ width: 6, height: 6, borderRadius: "50%", background: cameraActive ? "#00FF88" : "#94a3b8" }} />
              {cameraActive ? "SURVEILLANCE ONLINE" : "STANDBY"}
            </span>
          </div>

          {errorMsg && (
            <div style={{ fontSize: 10.5, color: "#f87171", fontFamily: "monospace", padding: "6px 12px", background: "rgba(239, 68, 68, 0.1)", borderRadius: 8, border: "1px solid rgba(239, 68, 68, 0.2)", textAlign: "center", width: "100%", marginBottom: 14 }}>
              {errorMsg}
            </div>
          )}

          {/* Canvas HUD Frame */}
          <div style={{ position: "relative", width: "100%", maxWidth: 640, aspectRatio: "4/3", borderRadius: 10, overflow: "hidden", border: "1px solid rgba(0,245,255,0.22)", boxShadow: "0 10px 25px rgba(0,0,0,0.5)" }}>
            {/* Hidden video stream */}
            <video
              ref={videoRef}
              style={{ display: "none" }}
              width={640}
              height={480}
              playsInline
              muted
            />

            {/* Rendered Canvas HUD */}
            <canvas
              ref={canvasRef}
              width={640}
              height={480}
              style={{ display: "block", width: "100%", height: "100%" }}
            />

            {/* Flash Overlay Effect */}
            {flash && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "#ffffff",
                  zIndex: 20,
                  animation: "nx-fadeIn 0.15s ease-out forwards",
                }}
              />
            )}

            {/* Screen static overlay */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: "linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%)",
                backgroundSize: "100% 4px",
                pointerEvents: "none",
                opacity: cameraActive ? 0.35 : 0.05,
              }}
            />
          </div>

          {/* Quick controls bar */}
          <div style={{ width: "100%", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 14 }}>
            {/* Device select */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="hud-label">INPUT_DEVICE</span>
              <select
                value={selectedDevice}
                onChange={(e) => setSelectedDevice(e.target.value)}
                style={inputStyle}
              >
                {devices.length === 0 ? (
                  <option value="">No cameras detected</option>
                ) : (
                  devices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Camera Channel ${devices.indexOf(d)}`}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Option Toggles */}
            <div style={{ display: "flex", gap: 14 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 11, fontFamily: "monospace", color: "rgba(148,163,184,0.8)" }}>
                <input
                  type="checkbox"
                  checked={mirror}
                  onChange={(e) => setMirror(e.target.checked)}
                  style={{ cursor: "pointer" }}
                />
                MIRROR_FEED
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 11, fontFamily: "monospace", color: "rgba(148,163,184,0.8)" }}>
                <input
                  type="checkbox"
                  checked={showGrid}
                  onChange={(e) => setShowGrid(e.target.checked)}
                  style={{ cursor: "pointer" }}
                />
                GRID_SCANLINES
              </label>
            </div>
          </div>
        </div>

        {/* Buttons Row */}
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={captureSnapshot}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "12px 24px",
              borderRadius: 10,
              background: "rgba(0, 245, 255, 0.16)",
              border: "1px solid rgba(0, 245, 255, 0.38)",
              color: "#00F5FF",
              fontFamily: "monospace",
              fontSize: 13,
              fontWeight: "bold",
              cursor: "pointer",
              boxShadow: "0 0 15px rgba(0, 245, 255, 0.15)",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0, 245, 255, 0.26)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(0, 245, 255, 0.16)")}
          >
            <Sparkles style={{ width: 15, height: 15 }} />
            LOG SNAPSHOT TO VAULT
          </button>

          <button
            onClick={() => {
              if (cameraActive) {
                stopCamera();
              } else {
                startCamera(selectedDevice);
              }
            }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "12px 24px",
              borderRadius: 10,
              background: cameraActive ? "rgba(239, 68, 68, 0.12)" : "rgba(0, 255, 136, 0.12)",
              border: cameraActive ? "1px solid rgba(239, 68, 68, 0.32)" : "1px solid rgba(0, 255, 136, 0.32)",
              color: cameraActive ? "#f87171" : "#00FF88",
              fontFamily: "monospace",
              fontSize: 12,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = cameraActive ? "rgba(239, 68, 68, 0.22)" : "rgba(0, 255, 136, 0.22)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = cameraActive ? "rgba(239, 68, 68, 0.12)" : "rgba(0, 255, 136, 0.12)")}
          >
            {cameraActive ? (
              <>
                <CameraOff style={{ width: 14, height: 14 }} />
                DISENGAGE CAMERA
              </>
            ) : (
              <>
                <Camera style={{ width: 14, height: 14 }} />
                ENGAGE CAMERA
              </>
            )}
          </button>
        </div>
      </div>

      {/* Right Column: Telemetry & Snapshots Enclave */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Stream Telemetry */}
        <div className="nx-glass" style={{ borderRadius: 14, padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, borderBottom: "1px solid rgba(0,245,255,0.1)", paddingBottom: 8 }}>
            <Activity style={{ width: 14, height: 14, color: "#00F5FF" }} />
            <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>Stream Diagnostics</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11, fontFamily: "monospace", color: "rgba(148, 163, 184, 0.65)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
              <span>LINK_STATUS</span>
              <span style={{ color: cameraActive ? "#00FF88" : "#f87171" }}>{cameraActive ? "ACTIVE" : "OFFLINE"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
              <span>ACTIVE_FPS</span>
              <span style={{ color: "#00F5FF" }}>{fps} / 30.0</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
              <span>ELAPSED_FRAMES</span>
              <span style={{ color: "#6E56FF" }}>{frameCount}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
              <span>CPU_OVERHEAD</span>
              <span style={{ color: "#FF2E88" }}>{cpuLoad}%</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
              <span>BUFFER_CAPACITY</span>
              <span style={{ color: "#00FF88" }}>{ramLoad}MB</span>
            </div>
          </div>
        </div>

        {/* Gallery Enclave */}
        <div className="nx-glass" style={{ borderRadius: 14, padding: "16px 20px", flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, borderBottom: "1px solid rgba(0,245,255,0.1)", paddingBottom: 8 }}>
            <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>Capture Vault</span>
            <span style={{ fontSize: 10.5, fontFamily: "monospace", color: "#FF2E88" }}>[{snapshots.length} SECURED]</span>
          </div>

          {snapshots.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, padding: "40px 0", color: "rgba(148, 163, 184, 0.4)", fontSize: 11, fontFamily: "monospace", textAlign: "center" }}>
              <Camera style={{ width: 28, height: 28, color: "rgba(148,163,184,0.2)", marginBottom: 8 }} />
              <div>VAULT EMPTY. CLICK 'LOG SNAPSHOT' TO RECORD SECTOR IMAGES.</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, overflowY: "auto", maxHeight: 360, paddingRight: 4 }}>
              {snapshots.map((snap) => (
                <div
                  key={snap.id}
                  style={{
                    position: "relative",
                    borderRadius: 8,
                    overflow: "hidden",
                    border: "1px solid rgba(255,255,255,0.06)",
                    background: "rgba(15,23,42,0.45)",
                  }}
                  className="nx-hover-trigger"
                >
                  <img
                    src={snap.url}
                    alt="capture"
                    style={{ width: "100%", height: "auto", display: "block", aspectRatio: "4/3", objectFit: "cover" }}
                  />

                  {/* Actions overlay */}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "rgba(2, 6, 23, 0.72)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      opacity: 0,
                      transition: "opacity 0.15s ease",
                      zIndex: 5,
                    }}
                    className="nx-hover-target"
                  >
                    <button
                      onClick={() => downloadSnapshot(snap)}
                      title="Download image"
                      style={{
                        background: "rgba(0, 245, 255, 0.15)",
                        border: "1px solid rgba(0, 245, 255, 0.35)",
                        color: "#00F5FF",
                        padding: 6,
                        borderRadius: 6,
                        cursor: "pointer",
                      }}
                    >
                      <Download style={{ width: 13, height: 13 }} />
                    </button>
                    <button
                      onClick={() => deleteSnapshot(snap.id)}
                      title="Purge snapshot"
                      style={{
                        background: "rgba(239, 68, 68, 0.15)",
                        border: "1px solid rgba(239, 68, 68, 0.35)",
                        color: "#f87171",
                        padding: 6,
                        borderRadius: 6,
                        cursor: "pointer",
                      }}
                    >
                      <Trash2 style={{ width: 13, height: 13 }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Styles injection specifically for hover actions */}
      <style>{`
        .nx-hover-trigger:hover .nx-hover-target {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
}
