import { useState, useEffect, useCallback } from "react";
import { useSecurity } from "../lib/SecurityContext";
import FaceScanner from "../components/FaceScanner";
import { http } from "../lib/api";
import { toast } from "../components/Toast";
import {
  Shield, ShieldCheck, Key, UserCheck, Trash2, Eye, EyeOff, Save,
  Fingerprint, Settings, HelpCircle, Activity, Video, AlertTriangle
} from "lucide-react";

export default function BiometricSecurity() {
  const { settings, updateSettings, hasRegisteredFace, refreshStatus } = useSecurity();
  const [signatures, setSignatures] = useState([]);
  const [loading, setLoading] = useState(false);

  // Settings form
  const [form, setForm] = useState({
    enabled: false,
    bypass_pin: "1337",
    auto_lock_minutes: 0,
    lock_terminal: false,
    lock_database: false,
  });
  const [showPin, setShowPin] = useState(false);

  // Registration states
  const [regName, setRegName] = useState("");
  const [regStatus, setRegStatus] = useState("idle"); // idle | scanning | matching | success | error
  const [regStage, setRegStage] = useState(0); // 0 = prep, 1 = camera, 2 = done

  // Test scan states
  const [testStatus, setTestStatus] = useState("idle");
  const [testConfidence, setTestConfidence] = useState(null);
  const [testResult, setTestResult] = useState(null); // null | "ok" | "fail"

  // Security logs
  const [logs, setLogs] = useState([
    { id: 1, time: new Date(Date.now() - 3600000).toLocaleTimeString(), event: "SHIELD CONTROLLER INITIALIZED", status: "NOMINAL" },
    { id: 2, time: new Date(Date.now() - 3000000).toLocaleTimeString(), event: "WEBCAM DISCOVERED - CAP_PORT_0", status: "ONLINE" },
    { id: 3, time: new Date(Date.now() - 60000).toLocaleTimeString(), event: "SECURITY POLICY QUERY LOADED", status: "NOMINAL" }
  ]);

  const addLog = useCallback((event, status = "INFO") => {
    setLogs(prev => [
      { id: Date.now(), time: new Date().toLocaleTimeString(), event, status },
      ...prev
    ]);
  }, []);

  // Sync settings when loaded
  useEffect(() => {
    if (settings) {
      setForm(settings);
    }
  }, [settings]);

  // Load signatures
  const loadSignatures = useCallback(async () => {
    try {
      const res = await http.get("/biometrics/signatures");
      setSignatures(res.data);
    } catch (err) {
      toast.error("Failed to load operator signatures");
    }
  }, []);

  useEffect(() => {
    loadSignatures();
  }, [loadSignatures]);

  // Save Settings
  const handleSaveSettings = async () => {
    setLoading(true);
    try {
      await updateSettings(form);
      addLog("SECURITY POLICY UPDATED", "NOMINAL");
      refreshStatus();
    } catch {
      // toast handled in context
    }
    setLoading(false);
  };

  // Register Face ID
  const handleRegisterCapture = async (base64Image) => {
    if (!regName.trim()) {
      toast.error("Please enter operator name before capture");
      return;
    }
    setRegStatus("matching");
    try {
      await http.post("/biometrics/register", {
        operator_name: regName.trim(),
        face_data: base64Image
      });
      setRegStatus("success");
      toast.success(`Registered face signature for ${regName}`);
      addLog(`OPERATOR SIGNATURE REGISTERED: ${regName.toUpperCase()}`, "NOMINAL");
      setRegName("");
      setTimeout(() => {
        setRegStage(2);
        loadSignatures();
        refreshStatus();
      }, 1000);
    } catch (err) {
      setRegStatus("error");
      toast.error("Registration failed");
      setTimeout(() => setRegStatus("idle"), 2500);
    }
  };

  // Delete signature
  const handleDeleteSignature = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete signature for ${name}?`)) return;
    try {
      await http.delete(`/biometrics/signatures/${id}`);
      toast.success("Signature deleted");
      addLog(`OPERATOR SIGNATURE PURGED: ${name.toUpperCase()}`, "ALERT");
      loadSignatures();
      refreshStatus();
    } catch {
      toast.error("Deletion failed");
    }
  };

  // Test match capability
  const handleTestCapture = async (base64Image) => {
    setTestStatus("matching");
    setTestResult(null);
    try {
      const res = await http.post("/biometrics/verify", { face_data: base64Image });
      const { verified, confidence: score, operator_name } = res.data;
      setTestConfidence(score);
      
      if (verified) {
        setTestStatus("success");
        setTestResult("ok");
        toast.success(`Identity Verified: Welcome, ${operator_name}`);
        addLog(`DIAGNOSTIC TEST MATCH PASSED - NAME: ${operator_name.toUpperCase()}`, "NOMINAL");
      } else {
        setTestStatus("error");
        setTestResult("fail");
        toast.error("Identity verification failed");
        addLog("DIAGNOSTIC TEST MATCH DENIED - MUTED CORRELATION", "WARN");
      }
      setTimeout(() => setTestStatus("idle"), 4000);
    } catch (err) {
      setTestStatus("error");
      toast.error("Test failed — backend offline?");
    }
  };

  const inputStyle = { width: "100%", background: "rgba(15,23,42,0.8)", border: "1px solid rgba(0,245,255,0.2)", borderRadius: 8, color: "#e2e8f0", padding: "9px 14px", fontSize: 12, fontFamily: "monospace", outline: "none", transition: "border-color 0.15s" };

  return (
    <div style={{ maxWidth: 1080, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      {/* Header spanning columns */}
      <div style={{ gridColumn: "span 2", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Shield style={{ width: 16, height: 16, color: "#00F5FF" }} />
          <span className="hud-label">OS SECURITY MATRIX</span>
        </div>
        <h1 className="font-display nx-neon-cyan" style={{ fontSize: 26, fontWeight: 900 }}>
          Biometric Security Console
        </h1>
        <p style={{ marginTop: 3, fontSize: 11, color: "rgba(148, 163, 184, 0.5)", fontFamily: "monospace" }}>
          Configure live Operator Face ID matching, action authorization guards, and security settings.
        </p>
      </div>

      {/* Left Column: Settings & Database */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Settings Panel */}
        <div className="nx-glass" style={{ borderRadius: 14, padding: "18px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, paddingBottom: 12, borderBottom: "1px solid rgba(0,245,255,0.1)" }}>
            <Settings style={{ width: 14, height: 14, color: "#00F5FF" }} />
            <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>Biometric Shields Configuration</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Global Enable Toggle */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 10, background: "rgba(0, 245, 255, 0.03)", border: "1px solid rgba(0, 245, 255, 0.12)" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#f8fafc" }}>Enable Biometric Lock</div>
                <div style={{ fontSize: 10, color: "rgba(148, 163, 184, 0.6)", fontFamily: "monospace", marginTop: 2 }}>Prompts Face ID lock screen on startup/inactivity</div>
              </div>
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))}
                style={{ cursor: "pointer", width: 16, height: 16 }}
              />
            </div>

            {/* Inactivity Slider */}
            <div>
              <label className="hud-label" style={{ display: "block", marginBottom: 5 }}>AUTO-LOCK DELAY ({form.auto_lock_minutes > 0 ? `${form.auto_lock_minutes} Min` : "OFF"})</label>
              <input
                type="range"
                min="0"
                max="60"
                step="5"
                value={form.auto_lock_minutes}
                onChange={e => setForm(f => ({ ...f, auto_lock_minutes: parseInt(e.target.value) }))}
                style={{ width: "100%", color: "#00F5FF" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "rgba(148,163,184,0.4)", fontFamily: "monospace", marginTop: 4 }}>
                <span>OFF</span>
                <span>15M</span>
                <span>30M</span>
                <span>45M</span>
                <span>60M</span>
              </div>
            </div>

            {/* Bypass Pin */}
            <div>
              <label className="hud-label" style={{ display: "block", marginBottom: 5 }}>BYPASS PIN</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPin ? "text" : "password"}
                  value={form.bypass_pin}
                  onChange={e => setForm(f => ({ ...f, bypass_pin: e.target.value }))}
                  placeholder="1337"
                  maxLength={8}
                  style={inputStyle}
                />
                <button
                  type="button"
                  onClick={() => setShowPin(p => !p)}
                  style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(148, 163, 184, 0.5)", display: "flex" }}
                >
                  {showPin ? <EyeOff style={{ width: 14, height: 14 }} /> : <Eye style={{ width: 14, height: 14 }} />}
                </button>
              </div>
              <p style={{ marginTop: 4, fontSize: 10, color: "rgba(148, 163, 184, 0.45)", fontFamily: "monospace" }}>Numeric pin to bypass camera lock if unavailable.</p>
            </div>

            {/* Action Guards (Terminal / Database Toggles) */}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 14 }}>
              <span className="hud-label" style={{ display: "block", marginBottom: 8 }}>PROTECTED OPERATION FIELDS</span>
              
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Terminal Toggle */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <span style={{ fontSize: 11.5, fontWeight: 500, color: "#e2e8f0" }}>Guard Terminal Shell</span>
                    <p style={{ fontSize: 9.5, color: "rgba(148, 163, 184, 0.5)", fontFamily: "monospace" }}>Requires Face ID scan before running shell commands</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.lock_terminal}
                    onChange={e => setForm(f => ({ ...f, lock_terminal: e.target.checked }))}
                    style={{ cursor: "pointer" }}
                  />
                </div>

                {/* Database Toggle */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <span style={{ fontSize: 11.5, fontWeight: 500, color: "#e2e8f0" }}>Guard Database Edits</span>
                    <p style={{ fontSize: 9.5, color: "rgba(148, 163, 184, 0.5)", fontFamily: "monospace" }}>Requires Face ID scan before deleting tasks/memories</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.lock_database}
                    onChange={e => setForm(f => ({ ...f, lock_database: e.target.checked }))}
                    style={{ cursor: "pointer" }}
                  />
                </div>
              </div>
            </div>

            {/* Save Button */}
            <button
              onClick={handleSaveSettings}
              disabled={loading}
              style={{
                marginTop: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                padding: "10px 20px", borderRadius: 8, background: "rgba(0, 245, 255, 0.15)",
                border: "1px solid rgba(0, 245, 255, 0.35)", color: "#00F5FF", cursor: "pointer",
                fontSize: 12, fontFamily: "monospace", transition: "all 0.15s"
              }}
            >
              <Save style={{ width: 13, height: 13 }} />
              {loading ? "SAVING POLICY..." : "APPLY SECURITY POLICY"}
            </button>
          </div>
        </div>

        {/* Database Signatures List */}
        <div className="nx-glass" style={{ borderRadius: 14, padding: "18px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid rgba(0,245,255,0.1)" }}>
            <UserCheck style={{ width: 14, height: 14, color: "#00F5FF" }} />
            <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>Registered Face Profiles</span>
          </div>

          {signatures.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px 0", color: "rgba(148, 163, 184, 0.5)", fontSize: 11, fontFamily: "monospace" }}>
              <AlertTriangle style={{ width: 22, height: 22, color: "#FFC857", marginBottom: 8, display: "inline" }} />
              <div>NO OPERATORS ENROLLED IN SECURE ENCLAVE.</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {signatures.map(sig => (
                <div key={sig.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 9, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#00F5FF", fontFamily: "monospace" }}>OPERATOR: {sig.operator_name.toUpperCase()}</div>
                    <div style={{ fontSize: 9.5, color: "rgba(148, 163, 184, 0.45)", fontFamily: "monospace", marginTop: 2 }}>ENROLLED: {new Date(sig.created_at).toLocaleString()}</div>
                  </div>
                  <button
                    onClick={() => handleDeleteSignature(sig.id, sig.operator_name)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(239, 68, 68, 0.6)", padding: 6, display: "flex", borderRadius: 6, border: "1px solid rgba(239, 68, 68, 0.15)" }}
                    onMouseEnter={e => { e.currentTarget.style.color = "#f87171"; e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.4)"; }}
                    onMouseLeave={e => { e.currentTarget.style.color = "rgba(239, 68, 68, 0.6)"; e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.15)"; }}
                    title="Purge profile"
                  >
                    <Trash2 style={{ width: 13, height: 13 }} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Scanner & Diagnostics */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Registration Wizard */}
        <div className="nx-glass" style={{ borderRadius: 14, padding: "18px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid rgba(0,245,255,0.1)" }}>
            <Fingerprint style={{ width: 14, height: 14, color: "#00F5FF" }} />
            <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>Operator Enrollment Portal</span>
          </div>

          {regStage === 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ fontSize: 11.5, color: "rgba(148,163,184,0.7)", lineHeight: 1.5 }}>
                Enrolling a new operator profile creates a grayscaled facial signature hash in the secure local mock database.
              </p>
              
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label className="hud-label">OPERATOR IDENTIFIER</label>
                <input
                  value={regName}
                  onChange={e => setRegName(e.target.value)}
                  placeholder="e.g. Operator Pushkar"
                  style={inputStyle}
                />
              </div>

              <button
                onClick={() => {
                  if (!regName.trim()) { toast.error("Operator name is required"); return; }
                  setRegStage(1);
                  setRegStatus("idle");
                }}
                disabled={!regName.trim()}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  padding: "10px 14px", borderRadius: 8, background: regName.trim() ? "rgba(0, 245, 255, 0.12)" : "rgba(255,255,255,0.02)",
                  border: regName.trim() ? "1px solid rgba(0, 245, 255, 0.28)" : "1px solid rgba(255,255,255,0.04)",
                  color: regName.trim() ? "#00F5FF" : "rgba(148, 163, 184, 0.4)",
                  cursor: regName.trim() ? "pointer" : "not-allowed", fontSize: 11, fontFamily: "monospace"
                }}
              >
                <Video style={{ width: 13, height: 13 }} />
                ENGAGE SCANNING HARDWARE
              </button>
            </div>
          )}

          {regStage === 1 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <div style={{ width: "100%", display: "flex", justifyBetween: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.04)", paddingBottom: 6 }}>
                <span className="hud-label" style={{ color: "#FF2E88" }}>ENROLLING: {regName.toUpperCase()}</span>
                <button
                  onClick={() => setRegStage(0)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(148,163,184,0.5)", fontSize: 10.5, fontFamily: "monospace" }}
                >
                  [Cancel]
                </button>
              </div>

              <FaceScanner
                mode="register"
                status={regStatus}
                placeholderName={regName}
                onCapture={handleRegisterCapture}
              />
            </div>
          )}

          {regStage === 2 && (
            <div style={{ textAlign: "center", padding: "18px 0" }}>
              <div style={{ display: "inline-flex", width: 44, height: 44, borderRadius: "50%", background: "rgba(0, 255, 136, 0.09)", border: "1px solid rgba(0, 255, 136, 0.35)", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                <ShieldCheck style={{ width: 20, height: 20, color: "#00FF88" }} />
              </div>
              <h3 className="font-display text-sm" style={{ fontWeight: 700, color: "#00FF88", marginBottom: 4 }}>ENROLLMENT LOGGED SUCCESSFULLY</h3>
              <p style={{ fontSize: 10.5, color: "rgba(148, 163, 184, 0.6)", fontFamily: "monospace", marginBottom: 16 }}>Facial signature matrices are compiled and stored.</p>
              <button
                onClick={() => setRegStage(0)}
                style={{ padding: "8px 16px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#e2e8f0", fontSize: 11, fontFamily: "monospace" }}
              >
                REGISTER ANOTHER OPERATOR
              </button>
            </div>
          )}
        </div>

        {/* Diagnostics & Test Matching */}
        {hasRegisteredFace && (
          <div className="nx-glass" style={{ borderRadius: 14, padding: "18px 22px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid rgba(0,245,255,0.1)" }}>
              <Activity style={{ width: 14, height: 14, color: "#00F5FF" }} />
              <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>Calibration Diagnostics</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <FaceScanner
                mode="test"
                status={testStatus}
                confidence={testConfidence}
                onCapture={handleTestCapture}
              />

              {testResult && (
                <div
                  style={{
                    width: "100%", padding: "10px 14px", borderRadius: 8,
                    textAlign: "center", fontSize: 11, fontFamily: "monospace",
                    background: testResult === "ok" ? "rgba(0, 255, 136, 0.08)" : "rgba(239, 68, 68, 0.08)",
                    border: testResult === "ok" ? "1px solid rgba(0, 255, 136, 0.28)" : "1px solid rgba(239, 68, 68, 0.28)",
                    color: testResult === "ok" ? "#00FF88" : "#f87171"
                  }}
                >
                  {testResult === "ok"
                    ? "BIOMETRIC MATCH CONFIRMED (NOMINAL CORRELATION)"
                    : "BIOMETRIC MATCH DENIED (CORRELATION FAILURE)"}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Access Log Audit Trail */}
        <div className="nx-glass" style={{ borderRadius: 14, padding: "18px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid rgba(0,245,255,0.1)" }}>
            <Activity style={{ width: 14, height: 14, color: "#00F5FF" }} />
            <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>Audit Logs</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 150, overflowY: "auto", fontFamily: "monospace", fontSize: 10.5 }}>
            {logs.map(log => (
              <div key={log.id} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.02)", padding: "3px 0" }}>
                <span style={{ color: "rgba(148, 163, 184, 0.45)" }}>[{log.time}]</span>
                <span style={{ flex: 1, marginLeft: 8, color: "#94a3b8" }}>{log.event}</span>
                <span style={{ color: log.status === "NOMINAL" ? "#00FF88" : log.status === "ALERT" ? "#FF2E88" : "#FFC857" }}>{log.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
