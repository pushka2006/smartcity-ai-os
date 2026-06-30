import { useState, useEffect } from "react";
import { useSecurity } from "../lib/SecurityContext";
import FaceScanner from "./FaceScanner";
import { http } from "../lib/api";
import { toast } from "./Toast";
import { ShieldAlert, KeyRound, ArrowRight, Eye, EyeOff, AlertTriangle } from "lucide-react";

export default function LockScreen() {
  const { isLocked, settings, unlockSystem, refreshStatus } = useSecurity();
  const [pinVal, setPinVal] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [scanStatus, setScanStatus] = useState("idle"); // "idle" | "scanning" | "matching" | "success" | "error"
  const [confidence, setConfidence] = useState(null);
  const [errorBanner, setErrorBanner] = useState("");
  const [pinActive, setPinActive] = useState(false); // toggle between Face ID and PIN UI on mobile or small devices

  // Lock status check
  useEffect(() => {
    if (isLocked) {
      setScanStatus("idle");
      setConfidence(null);
      setPinVal("");
      setErrorBanner("");
      refreshStatus();
    }
  }, [isLocked, refreshStatus]);

  if (!isLocked) return null;

  // Handle face snapshot scan
  const handleFaceCapture = async (base64Image) => {
    setScanStatus("matching");
    setErrorBanner("");
    try {
      const res = await http.post("/biometrics/verify", { face_data: base64Image });
      const { verified, operator_name, confidence: score } = res.data;
      setConfidence(score);
      
      if (verified) {
        setScanStatus("success");
        setTimeout(() => {
          unlockSystem();
        }, 1200);
      } else {
        setScanStatus("error");
        setErrorBanner(res.data.reason || `BIOMETRIC ERROR: MATCH INDEX BELOW SECURE CORRELATION LIMIT.`);
        toast.error("Biometric mismatch. Access denied.");
        setTimeout(() => setScanStatus("idle"), 3000);
      }
    } catch (err) {
      setScanStatus("error");
      setErrorBanner("NETWORK INTERRUPT: UNABLE TO CONNECT TO BIOMETRIC VALIDATION ROUTER.");
      setTimeout(() => setScanStatus("idle"), 3000);
    }
  };

  // Handle PIN unlock
  const handlePinSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!pinVal) return;
    setErrorBanner("");

    try {
      const res = await http.post("/biometrics/verify-pin", { pin: pinVal });
      if (res.data.verified) {
        setScanStatus("success");
        setTimeout(() => {
          unlockSystem();
        }, 800);
      } else {
        setPinVal("");
        setErrorBanner("SECURITY PIN DENIED: ENCODED KEY VALUE MISMATCH.");
        toast.error("Bypass PIN incorrect");
        // Flash screen red effect
        const keypad = document.getElementById("pin-wrapper");
        if (keypad) {
          keypad.classList.add("nx-glow-pink");
          setTimeout(() => keypad.classList.remove("nx-glow-pink"), 800);
        }
      }
    } catch (err) {
      setErrorBanner("CONNECTION EXCEPTION: SERVER SECURE MODULE TIMEOUT.");
    }
  };

  const handleKeypadPress = (val) => {
    if (val === "clear") {
      setPinVal("");
    } else if (val === "enter") {
      handlePinSubmit();
    } else {
      if (pinVal.length < 8) {
        setPinVal(prev => prev + val);
      }
    }
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(2, 6, 23, 0.8)", backdropFilter: "blur(26px)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: 24, animation: "nx-fadeIn 0.4s ease forwards"
      }}
    >
      {/* Background vector rings */}
      <div style={{ position: "absolute", width: 800, height: 800, borderRadius: "50%", border: "1px solid rgba(0, 245, 255, 0.03)", pointerEvents: "none", zIndex: 1 }} className="nx-spin-slow" />
      <div style={{ position: "absolute", width: 500, height: 500, borderRadius: "50%", border: "1px solid rgba(255, 46, 136, 0.02)", pointerEvents: "none", zIndex: 1 }} />

      <div style={{ zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", maxWidth: 640, width: "100%" }}>
        {/* Glowing Header HUD */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 26, textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 20, background: "rgba(239, 68, 68, 0.09)", border: "1px solid rgba(239, 68, 68, 0.28)", boxShadow: "0 0 15px rgba(239, 68, 68, 0.08)", marginBottom: 12 }}>
            <ShieldAlert style={{ width: 14, height: 14, color: "#FF4D4D" }} />
            <span style={{ fontSize: 9, fontFamily: "monospace", letterSpacing: "0.24em", color: "#FF4D4D", fontWeight: 700 }}>NEXUS // SYS_SECURE_LOCKED</span>
          </div>
          <h1 className="font-display nx-neon-cyan" style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-0.02em" }}>BIOMETRIC IDENTITY SHIELD</h1>
          <p style={{ fontSize: 10.5, color: "rgba(148, 163, 184, 0.5)", fontFamily: "monospace", marginTop: 4 }}>RESTRICTED SECTOR. OPERATOR CERTIFICATION REQUIRED.</p>
        </div>

        {/* Action failed banner message */}
        {errorBanner && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", maxWidth: 420, padding: "10px 14px", background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.35)", borderRadius: 10, marginBottom: 18, color: "#f87171", fontSize: 10, fontFamily: "monospace", animation: "nx-fadeIn 0.2s ease" }}>
            <AlertTriangle style={{ width: 14, height: 14, flexShrink: 0 }} />
            <span>{errorBanner}</span>
          </div>
        )}

        {/* Scanner or PIN bypass selection */}
        <div style={{ display: "flex", flexDirection: "column", mdFlexDirection: "row", gap: 40, alignItems: "center", justifyContent: "center", width: "100%" }}>
          {/* Left: Webcam Scanner */}
          {!pinActive ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <FaceScanner
                mode="verify"
                status={scanStatus}
                confidence={confidence}
                onCapture={handleFaceCapture}
              />
              <button
                onClick={() => setPinActive(true)}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "rgba(148, 163, 184, 0.5)", fontFamily: "monospace",
                  fontSize: 10.5, textDecoration: "underline", marginTop: 18, transition: "color 0.15s"
                }}
                onMouseEnter={e => e.currentTarget.style.color = "#00F5FF"}
                onMouseLeave={e => e.currentTarget.style.color = "rgba(148, 163, 184, 0.5)"}
              >
                Bypass using Secure PIN Keypad
              </button>
            </div>
          ) : (
            /* Right: PIN Keyboard */
            <div id="pin-wrapper" className="nx-glass" style={{ width: 280, borderRadius: 18, padding: 20, display: "flex", flexDirection: "column", alignItems: "center", animation: "nx-fadeIn 0.3s ease", transition: "box-shadow 0.2s" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
                <KeyRound style={{ width: 13, height: 13, color: "#00F5FF" }} />
                <span className="hud-label">SECURE ENTRY KEYPAD</span>
              </div>

              {/* Display screen */}
              <div style={{ position: "relative", width: "100%", marginBottom: 16 }}>
                <input
                  type={showPin ? "text" : "password"}
                  value={pinVal}
                  readOnly
                  placeholder="••••••••"
                  style={{
                    width: "100%", background: "rgba(2, 6, 23, 0.7)",
                    border: "1px solid rgba(0, 245, 255, 0.25)", borderRadius: 8,
                    color: "#00F5FF", padding: "10px 14px", paddingRight: 40,
                    fontSize: 14, letterSpacing: showPin ? "2px" : "4px",
                    fontFamily: "monospace", textAlign: "center", outline: "none"
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPin(p => !p)}
                  style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(148, 163, 184, 0.5)", display: "flex" }}
                >
                  {showPin ? <EyeOff style={{ width: 14, height: 14 }} /> : <Eye style={{ width: 14, height: 14 }} />}
                </button>
              </div>

              {/* Keypad Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, width: "100%" }}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                  <button
                    key={num}
                    onClick={() => handleKeypadPress(num.toString())}
                    style={{
                      height: 44, borderRadius: 10, background: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid rgba(255, 255, 255, 0.06)", color: "#e2e8f0",
                      fontSize: 14, fontWeight: 700, fontFamily: "monospace", cursor: "pointer",
                      transition: "all 0.1s"
                    }}
                    onMouseDown={e => { e.currentTarget.style.background = "rgba(0, 245, 255, 0.09)"; e.currentTarget.style.borderColor = "rgba(0, 245, 255, 0.35)"; }}
                    onMouseUp={e => { e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)"; e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.06)"; }}
                  >
                    {num}
                  </button>
                ))}
                <button
                  onClick={() => handleKeypadPress("clear")}
                  style={{ height: 44, borderRadius: 10, background: "rgba(239, 68, 68, 0.06)", border: "1px solid rgba(239, 68, 68, 0.15)", color: "#f87171", fontSize: 11, fontFamily: "monospace", cursor: "pointer" }}
                >
                  CLR
                </button>
                <button
                  onClick={() => handleKeypadPress("0")}
                  style={{ height: 44, borderRadius: 10, background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.06)", color: "#e2e8f0", fontSize: 14, fontWeight: 700, fontFamily: "monospace", cursor: "pointer" }}
                >
                  0
                </button>
                <button
                  onClick={() => handleKeypadPress("enter")}
                  disabled={!pinVal}
                  style={{ height: 44, borderRadius: 10, background: pinVal ? "rgba(0, 255, 136, 0.12)" : "rgba(255, 255, 255, 0.02)", border: pinVal ? "1px solid rgba(0, 255, 136, 0.35)" : "1px solid rgba(255, 255, 255, 0.04)", color: pinVal ? "#00FF88" : "rgba(148, 163, 184, 0.4)", fontSize: 11, fontFamily: "monospace", cursor: pinVal ? "pointer" : "not-allowed" }}
                >
                  ENT
                </button>
              </div>

              <button
                onClick={() => setPinActive(false)}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "rgba(148, 163, 184, 0.5)", fontFamily: "monospace",
                  fontSize: 10.5, textDecoration: "underline", marginTop: 18, transition: "color 0.15s"
                }}
                onMouseEnter={e => e.currentTarget.style.color = "#00F5FF"}
                onMouseLeave={e => e.currentTarget.style.color = "rgba(148, 163, 184, 0.5)"}
              >
                Return to Webcam Biometric Stream
              </button>
            </div>
          )}
        </div>

        {/* Footer legalities */}
        <div style={{ marginTop: 48, fontSize: 9.5, color: "rgba(148, 163, 184, 0.35)", fontFamily: "monospace", display: "flex", alignItems: "center", gap: 18 }}>
          <span>HOST: LOCALHOST</span>
          <span>•</span>
          <span>PORT: 8000</span>
          <span>•</span>
          <span>Biometric matching is processed locally.</span>
        </div>
      </div>
    </div>
  );
}
