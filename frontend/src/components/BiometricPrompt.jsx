import { useState, useEffect } from "react";
import { useSecurity } from "../lib/SecurityContext";
import FaceScanner from "./FaceScanner";
import { http } from "../lib/api";
import { toast } from "./Toast";
import { ShieldCheck, X, Key, Scan } from "lucide-react";

export default function BiometricPrompt() {
  const { isPromptOpen, pendingActionName, confirmAction, cancelAction } = useSecurity();
  const [scanStatus, setScanStatus] = useState("idle");
  const [confidence, setConfidence] = useState(null);
  const [usePin, setUsePin] = useState(false);
  const [pinVal, setPinVal] = useState("");

  useEffect(() => {
    if (isPromptOpen) {
      setScanStatus("idle");
      setConfidence(null);
      setPinVal("");
      setUsePin(false);
    }
  }, [isPromptOpen]);

  if (!isPromptOpen) return null;

  const handleFaceCapture = async (base64Image) => {
    setScanStatus("matching");
    try {
      const res = await http.post("/biometrics/verify", { face_data: base64Image });
      const { verified, confidence: score } = res.data;
      setConfidence(score);

      if (verified) {
        setScanStatus("success");
        setTimeout(() => {
          confirmAction();
        }, 1000);
      } else {
        setScanStatus("error");
        toast.error("Biometric verification failed");
        setTimeout(() => setScanStatus("idle"), 2500);
      }
    } catch (err) {
      setScanStatus("error");
      toast.error("Server connection lost");
      setTimeout(() => setScanStatus("idle"), 2500);
    }
  };

  const handlePinSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!pinVal) return;

    try {
      const res = await http.post("/biometrics/verify-pin", { pin: pinVal });
      if (res.data.verified) {
        confirmAction();
      } else {
        setPinVal("");
        toast.error("Invalid Security PIN");
      }
    } catch (err) {
      toast.error("Server communication error");
    }
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9990,
        background: "rgba(2, 6, 23, 0.72)", backdropFilter: "blur(12px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20, animation: "nx-fadeIn 0.25s ease forwards"
      }}
    >
      <div
        className="nx-glass-strong nx-glow-cyan"
        style={{
          width: "100%", maxWidth: 380, borderRadius: 16,
          padding: "24px 20px", display: "flex", flexDirection: "column",
          position: "relative", border: "1px solid rgba(0, 245, 255, 0.35)",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.55), 0 0 30px rgba(0, 245, 255, 0.1)"
        }}
      >
        {/* Close Button */}
        <button
          onClick={cancelAction}
          style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", cursor: "pointer", color: "rgba(148, 163, 184, 0.65)" }}
        >
          <X style={{ width: 16, height: 16 }} />
        </button>

        {/* Header Title */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <ShieldCheck style={{ width: 15, height: 15, color: "#00F5FF" }} />
          <span style={{ fontSize: 9.5, fontFamily: "monospace", letterSpacing: "0.22em", color: "#00F5FF", fontWeight: 700 }}>NEXUS // BIOMETRIC_GUARD</span>
        </div>
        
        <h2 className="font-display text-base" style={{ fontWeight: 800, marginBottom: 4, textTransform: "uppercase" }}>
          AUTHORIZATION REQUIRED
        </h2>
        
        <p style={{ fontSize: 10.5, color: "rgba(148, 163, 184, 0.6)", fontFamily: "monospace", lineHeight: 1.4, marginBottom: 20 }}>
          Verify operator signature to proceed with <span style={{ color: "#00F5FF", fontWeight: 600 }}>{pendingActionName}</span>.
        </p>

        {/* Scanner or PIN Form */}
        {!usePin ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <FaceScanner
              mode="verify"
              status={scanStatus}
              confidence={confidence}
              onCapture={handleFaceCapture}
            />
            <button
              onClick={() => setUsePin(true)}
              style={{
                display: "flex", alignItems: "center", gap: 5, background: "none", border: "none",
                cursor: "pointer", color: "rgba(148, 163, 184, 0.55)", fontSize: 10.5,
                fontFamily: "monospace", marginTop: 14, textDecoration: "underline"
              }}
            >
              <Key style={{ width: 10, height: 10 }} />
              Use Security PIN instead
            </button>
          </div>
        ) : (
          <form onSubmit={handlePinSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label className="hud-label">ENTER BYPASS PIN</label>
              <input
                type="password"
                value={pinVal}
                onChange={e => setPinVal(e.target.value)}
                placeholder="••••"
                maxLength={8}
                autoFocus
                style={{
                  width: "100%", background: "rgba(15, 23, 42, 0.85)",
                  border: "1px solid rgba(0, 245, 255, 0.3)", borderRadius: 8,
                  color: "#00F5FF", padding: "10px 14px", fontSize: 14,
                  fontFamily: "monospace", outline: "none", textAlign: "center",
                  letterSpacing: "4px"
                }}
              />
            </div>
            
            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              <button
                type="submit"
                disabled={!pinVal}
                style={{
                  flex: 1, padding: "10px 14px", borderRadius: 8,
                  background: pinVal ? "rgba(0, 245, 255, 0.15)" : "rgba(255, 255, 255, 0.02)",
                  border: pinVal ? "1px solid rgba(0, 245, 255, 0.35)" : "1px solid rgba(255, 255, 255, 0.05)",
                  color: pinVal ? "#00F5FF" : "rgba(148, 163, 184, 0.4)",
                  cursor: pinVal ? "pointer" : "not-allowed", fontSize: 11, fontFamily: "monospace"
                }}
              >
                AUTHORIZE PIN
              </button>
              
              <button
                type="button"
                onClick={() => setUsePin(false)}
                style={{
                  display: "flex", alignItems: "center", justifyCenter: "center", gap: 5,
                  padding: "10px 14px", borderRadius: 8, background: "rgba(255, 255, 255, 0.04)",
                  border: "1px solid rgba(255, 255, 255, 0.08)", color: "rgba(148, 163, 184, 0.8)",
                  cursor: "pointer", fontSize: 11, fontFamily: "monospace"
                }}
              >
                <Scan style={{ width: 12, height: 12 }} />
                SCAN FACE
              </button>
            </div>
          </form>
        )}

        {/* Cancel Button */}
        <button
          onClick={cancelAction}
          style={{
            marginTop: 18, width: "100%", padding: "9px 12px", borderRadius: 8,
            background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.22)",
            color: "#f87171", cursor: "pointer", fontSize: 11, fontFamily: "monospace"
          }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(239, 68, 68, 0.14)"}
          onMouseLeave={e => e.currentTarget.style.background = "rgba(239, 68, 68, 0.08)"}
        >
          ABORT OPERATION
        </button>
      </div>
    </div>
  );
}
