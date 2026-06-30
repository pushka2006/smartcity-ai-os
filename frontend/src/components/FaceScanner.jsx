import { useEffect, useRef, useState } from "react";
import { Sparkles, RefreshCw } from "lucide-react";

export default function FaceScanner({
  mode = "verify", // "register" | "verify" | "test"
  status = "idle", // "idle" | "scanning" | "matching" | "success" | "error"
  onCapture,
  confidence = null,
  placeholderName = "Operator",
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // UI animation properties
  const animationRef = useRef(null);
  const scanPos = useRef(0);
  const scanDirection = useRef(1);
  const rotationAngle = useRef(0);

  // Initialize camera
  const startCamera = async () => {
    setErrorMsg("");
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 320, facingMode: "user" },
        audio: false,
      });
      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err) {
      console.warn("Webcam access failed, falling back to simulated data", err);
      setCameraActive(false);
      setErrorMsg("PHYSICAL CAM BLOCKED / UNAVAILABLE. ENGAGING MOCK SHIELD CONTROLLER.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Capture current frame
  const captureFrame = () => {
    if (!canvasRef.current) return;
    
    // Create a square capture
    const captureCanvas = document.createElement("canvas");
    captureCanvas.width = 160;
    captureCanvas.height = 160;
    const ctx = captureCanvas.getContext("2d");
    
    if (cameraActive && videoRef.current) {
      // Crop center square from video
      const v = videoRef.current;
      const size = Math.min(v.videoWidth, v.videoHeight);
      const sx = (v.videoWidth - size) / 2;
      const sy = (v.videoHeight - size) / 2;
      ctx.drawImage(v, sx, sy, size, size, 0, 0, 160, 160);
    } else {
      // Draw simulated static/noise face snapshot
      ctx.fillStyle = "#020617";
      ctx.fillRect(0, 0, 160, 160);
      
      // Draw grid
      ctx.strokeStyle = "rgba(0, 245, 255, 0.15)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 160; i += 16) {
        ctx.beginPath();
        ctx.moveTo(i, 0); ctx.lineTo(i, 160);
        ctx.moveTo(0, i); ctx.lineTo(160, i);
        ctx.stroke();
      }
      
      // Draw mock face outline
      ctx.strokeStyle = "#00F5FF";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(80, 75, 45, 0, Math.PI * 2); // head
      ctx.stroke();
      
      // eyes
      ctx.fillStyle = "#FF2E88";
      ctx.beginPath();
      ctx.arc(65, 65, 3, 0, Math.PI * 2);
      ctx.arc(95, 65, 3, 0, Math.PI * 2);
      ctx.fill();
      
      // mouth
      ctx.beginPath();
      ctx.arc(80, 95, 12, 0.1, Math.PI - 0.1);
      ctx.stroke();
    }
    
    const base64Data = captureCanvas.toDataURL("image/jpeg", 0.85);
    if (onCapture) {
      onCapture(base64Data);
    }
  };

  // Canvas drawing loop (gorgeous retro-sci-fi HUD)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const renderLoop = () => {
      const w = canvas.width;
      const h = canvas.height;
      
      ctx.clearRect(0, 0, w, h);

      // 1. Draw video background or simulated vector grid
      if (cameraActive && videoRef.current && videoRef.current.readyState >= 2) {
        ctx.save();
        // Mirror the webcam feed
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(videoRef.current, 0, 0, w, h);
        ctx.restore();
        
        // Add cyber tint
        ctx.fillStyle = "rgba(2, 6, 34, 0.15)";
        ctx.fillRect(0, 0, w, h);
      } else {
        // Draw matrix grid
        ctx.fillStyle = "#020617";
        ctx.fillRect(0, 0, w, h);
        
        ctx.strokeStyle = "rgba(0, 245, 255, 0.06)";
        ctx.lineWidth = 1;
        const spacing = 20;
        for (let x = 0; x < w; x += spacing) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        }
        for (let y = 0; y < h; y += spacing) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        }

        // Draw animated scanning circular waveform
        ctx.strokeStyle = "rgba(0, 245, 255, 0.25)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, 80 + Math.sin(Date.now() * 0.005) * 4, 0, Math.PI * 2);
        ctx.stroke();

        // Draw wireframe head in the center
        const t = Date.now() * 0.001;
        ctx.strokeStyle = "rgba(0, 245, 255, 0.45)";
        ctx.lineWidth = 1.5;
        
        ctx.beginPath();
        // Head outline
        ctx.ellipse(w / 2, h / 2 - 10, 50, 68, Math.sin(t * 0.5) * 0.05, 0, Math.PI * 2);
        ctx.stroke();

        // Face grid lines
        ctx.strokeStyle = "rgba(0, 245, 255, 0.18)";
        ctx.beginPath();
        ctx.moveTo(w / 2 - 50, h / 2 - 10); ctx.lineTo(w / 2 + 50, h / 2 - 10); // horizontal
        ctx.moveTo(w / 2, h / 2 - 78); ctx.lineTo(w / 2, h / 2 + 58); // vertical
        ctx.stroke();

        // Eyes points
        ctx.fillStyle = "#00FF88";
        ctx.beginPath();
        ctx.arc(w / 2 - 18, h / 2 - 20, 3, 0, Math.PI * 2);
        ctx.arc(w / 2 + 18, h / 2 - 20, 3, 0, Math.PI * 2);
        ctx.fill();

        // HUD offline label
        ctx.fillStyle = "#ef4444";
        ctx.font = "9px monospace";
        ctx.textAlign = "center";
        ctx.fillText("SIMULATION MODE ACTIVE", w / 2, h / 2 + 82);
      }

      // Determine state-based theme colors
      let mainColor = "#00F5FF"; // Cyan (idle/scanning)
      if (status === "matching") mainColor = "#6E56FF"; // Purple
      if (status === "success") mainColor = "#00FF88"; // Green
      if (status === "error") mainColor = "#FF4D4D";   // Red

      // 2. Draw rotating HUD circle
      rotationAngle.current += (status === "matching" ? 0.06 : 0.015);
      ctx.strokeStyle = mainColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([8, 12]);
      
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(rotationAngle.current);
      ctx.beginPath();
      ctx.arc(0, 0, 110, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      
      ctx.setLineDash([]); // reset

      // Outer rings
      ctx.strokeStyle = "rgba(0, 245, 255, 0.08)";
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 125, 0, Math.PI * 2);
      ctx.stroke();

      // 3. Draw targeting corner brackets (locks onto center)
      const borderLen = 18;
      const pad = 48; // offset from edge
      ctx.strokeStyle = mainColor;
      ctx.lineWidth = 2.5;

      // Top-Left
      ctx.beginPath();
      ctx.moveTo(pad, pad + borderLen); ctx.lineTo(pad, pad); ctx.lineTo(pad + borderLen, pad);
      ctx.stroke();
      // Top-Right
      ctx.beginPath();
      ctx.moveTo(w - pad, pad + borderLen); ctx.lineTo(w - pad, pad); ctx.lineTo(w - pad - borderLen, pad);
      ctx.stroke();
      // Bottom-Left
      ctx.beginPath();
      ctx.moveTo(pad, h - pad - borderLen); ctx.lineTo(pad, h - pad); ctx.lineTo(pad + borderLen, h - pad);
      ctx.stroke();
      // Bottom-Right
      ctx.beginPath();
      ctx.moveTo(w - pad, h - pad - borderLen); ctx.lineTo(w - pad, h - pad); ctx.lineTo(w - pad - borderLen, h - pad);
      ctx.stroke();

      // 4. Draw horizontal scanning line sweep
      if (status === "scanning" || status === "matching") {
        scanPos.current += (scanDirection.current * (status === "matching" ? 4.5 : 2.5));
        if (scanPos.current > h - 70) scanDirection.current = -1;
        if (scanPos.current < 70) scanDirection.current = 1;

        // Draw scanning bar
        const grad = ctx.createLinearGradient(0, scanPos.current - 12, 0, scanPos.current + 12);
        grad.addColorStop(0, "rgba(0, 245, 255, 0)");
        grad.addColorStop(0.5, `${mainColor}48`);
        grad.addColorStop(1, "rgba(0, 245, 255, 0)");
        
        ctx.fillStyle = grad;
        ctx.fillRect(40, scanPos.current - 12, w - 80, 24);

        // Core scanning line
        ctx.strokeStyle = mainColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(50, scanPos.current);
        ctx.lineTo(w - 50, scanPos.current);
        ctx.stroke();

        // Draw minor grid coordinates overlay on the line
        ctx.fillStyle = mainColor;
        ctx.fillRect(w / 2 - 4, scanPos.current - 4, 8, 8);
      }

      // 5. Blinking target nodes (face landmarks simulation)
      if (status === "scanning" || status === "matching") {
        const seed = Math.floor(Date.now() / 150);
        ctx.fillStyle = "#FF2E88";
        
        // Landmark coordinates offsets relative to center
        const landmarks = [
          [-25, -20], [25, -20], // eyes
          [0, 2],                 // nose
          [-15, 25], [15, 25],   // mouth sides
          [-35, 10], [35, 10],   // cheekbones
          [0, 42]                 // chin
        ];
        
        landmarks.forEach(([lx, ly], idx) => {
          if ((seed + idx) % 3 !== 0) {
            ctx.beginPath();
            ctx.arc(w / 2 + lx, h / 2 + ly, 2, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw connector threads occasionally
            if ((seed + idx) % 5 === 0) {
              ctx.strokeStyle = "rgba(255, 46, 136, 0.22)";
              ctx.lineWidth = 0.8;
              ctx.beginPath();
              ctx.moveTo(w / 2, h / 2);
              ctx.lineTo(w / 2 + lx, h / 2 + ly);
              ctx.stroke();
            }
          }
        });
      }

      // 6. Draw telemetry overlay text
      ctx.fillStyle = "rgba(0, 245, 255, 0.7)";
      ctx.font = "8px monospace";
      ctx.textAlign = "left";

      // Draw bottom telemetry
      ctx.fillText(`CAM_PORT: DEV_WEB_0`, 16, h - 26);
      ctx.fillText(`LIVENESS: ACTIVE`, 16, h - 16);
      
      ctx.textAlign = "right";
      ctx.fillText(`GRID_PTS: ${status === "idle" ? "000" : "1024"}/1024`, w - 16, h - 26);
      ctx.fillText(`SYS_CAL: NOMINAL`, w - 16, h - 16);

      // Draw matching confidence
      if (confidence !== null) {
        ctx.textAlign = "center";
        ctx.fillStyle = mainColor;
        ctx.font = "bold 9px monospace";
        ctx.fillText(`MATCH INDEX: ${(confidence * 100).toFixed(1)}%`, w / 2, 28);
      }

      // Draw upper scanning states
      if (status !== "idle") {
        ctx.fillStyle = mainColor;
        ctx.font = "bold 10px Unbounded, sans-serif";
        ctx.textAlign = "center";
        let title = "SCANNING BIOMETRICS";
        if (status === "matching") title = "COMPARING NEURAL HASHES";
        if (status === "success") title = "ACCESS GRANTED";
        if (status === "error") title = "VERIFICATION FAILURE";
        ctx.fillText(title, w / 2, h / 2 + 138);
      }

      animationRef.current = requestAnimationFrame(renderLoop);
    };

    renderLoop();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [cameraActive, status, confidence]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      {/* Scanner Wrapper */}
      <div style={{ position: "relative", width: 280, height: 280, borderRadius: "50%", overflow: "hidden", border: "2px solid rgba(0, 245, 255, 0.25)", boxShadow: "0 0 30px rgba(0, 245, 255, 0.12)" }}>
        {/* Hidden video element that provides stream */}
        <video
          ref={videoRef}
          style={{ display: "none" }}
          width={320}
          height={320}
          playsInline
          muted
        />

        {/* Canvas that renders HUD overlay */}
        <canvas
          ref={canvasRef}
          width={276}
          height={276}
          style={{ display: "block", borderRadius: "50%" }}
        />

        {/* Flash overlay for scan capture */}
        {status === "matching" && (
          <div
            style={{
              position: "absolute", inset: 0,
              background: "white", animation: "nx-fadeIn 0.2s ease-out forwards",
              opacity: 0, pointerEvents: "none", zIndex: 10
            }}
          />
        )}
      </div>

      {/* Control panel & error fallback */}
      <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        {errorMsg && (
          <div style={{ fontSize: 10, color: "#f87171", fontFamily: "monospace", padding: "4px 10px", background: "rgba(239, 68, 68, 0.1)", borderRadius: 6, border: "1px solid rgba(239, 68, 68, 0.2)", textAlign: "center", width: "100%" }}>
            {errorMsg}
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={captureFrame}
            disabled={status === "scanning" || status === "matching"}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              background: "rgba(0, 245, 255, 0.14)", border: "1px solid rgba(0, 245, 255, 0.35)",
              color: "#00F5FF", borderRadius: 8, padding: "8px 18px",
              cursor: "pointer", fontSize: 11, fontFamily: "monospace", transition: "all 0.15s",
              boxShadow: "0 0 10px rgba(0, 245, 255, 0.15)"
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(0, 245, 255, 0.24)"; e.currentTarget.style.borderColor = "#00F5FF"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(0, 245, 255, 0.14)"; e.currentTarget.style.borderColor = "rgba(0, 245, 255, 0.35)"; }}
          >
            <Sparkles style={{ width: 12, height: 12 }} />
            {mode === "register" ? "REGISTER OPERATOR" : "SCAN FACE ID"}
          </button>

          {!cameraActive && (
            <button
              onClick={startCamera}
              title="Retry Webcam Connection"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 33, height: 33, background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: 8,
                cursor: "pointer", color: "rgba(148, 163, 184, 0.7)"
              }}
            >
              <RefreshCw style={{ width: 13, height: 13 }} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
