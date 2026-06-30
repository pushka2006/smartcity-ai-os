import { useState, useEffect, useRef } from "react";
import { useVoice } from "../lib/VoiceContext";
import { Mic, X, Send, Command } from "lucide-react";

export default function VoicePromptOverlay() {
  const { isListening, stopListening, executeVoiceCommand, errorState } = useVoice();
  const [typedCommand, setTypedCommand] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (isListening) {
      setTypedCommand("");
      // Delay focus slightly for overlay animation
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isListening]);

  if (!isListening) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (typedCommand.trim()) {
      executeVoiceCommand(typedCommand.trim());
      stopListening();
    }
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9980,
        background: "rgba(2, 6, 23, 0.45)", backdropFilter: "blur(8px)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        animation: "nx-fadeIn 0.2s ease forwards"
      }}
    >
      <div
        className="nx-glass nx-glow-cyan"
        style={{
          width: "100%", maxWidth: 420, borderRadius: 16,
          padding: "24px 20px", display: "flex", flexDirection: "column",
          alignItems: "center", position: "relative",
          background: "rgba(6, 13, 34, 0.8)", border: "1px solid rgba(0, 245, 255, 0.3)"
        }}
      >
        {/* Close Button */}
        <button
          onClick={stopListening}
          style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", cursor: "pointer", color: "rgba(148, 163, 184, 0.6)" }}
        >
          <X style={{ width: 16, height: 16 }} />
        </button>

        {/* Pulsing Visual Waveform */}
        <div style={{ display: "flex", alignItems: "center", justifyCenter: "center", gap: 6, height: 50, marginBottom: 18 }}>
          {[1, 2, 3, 4, 5, 6, 7].map((bar) => {
            // Randomize speed and delays for natural voice simulation
            const delay = `${bar * 0.15}s`;
            const duration = `${0.6 + Math.random() * 0.4}s`;
            return (
              <div
                key={bar}
                style={{
                  width: 4,
                  height: 35,
                  background: "linear-gradient(180deg, #00F5FF, #6E56FF)",
                  borderRadius: 4,
                  animation: `voice-pulse-bar ${duration} ease-in-out infinite alternate`,
                  animationDelay: delay,
                  boxShadow: "0 0 10px rgba(0, 245, 255, 0.3)"
                }}
              />
            );
          })}
        </div>

        {/* Listening HUD Title */}
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
          <Mic style={{ width: 14, height: 14, color: "#FF2E88", className: "nx-blink" }} />
          <span style={{ fontSize: 9.5, fontFamily: "monospace", letterSpacing: "0.22em", color: "#FF2E88", fontWeight: 700 }}>NEXUS // CORE_LISTENING</span>
        </div>
        
        <h3 className="font-display text-base" style={{ fontWeight: 800, marginBottom: 6, textTransform: "uppercase" }}>
          Awaiting Directives
        </h3>

        <p style={{ fontSize: 10.5, color: "rgba(148, 163, 184, 0.55)", fontFamily: "monospace", textAlign: "center", lineHeight: 1.5, marginBottom: 20 }}>
          Speak clearly: <span style={{ color: "#00F5FF" }}>"open terminal"</span>, <span style={{ color: "#00F5FF" }}>"lock system"</span>, <span style={{ color: "#00F5FF" }}>"create task [name]"</span>, or <span style={{ color: "#00F5FF" }}>"shutdown"</span>.
        </p>

        {/* Command fallbacks or warning */}
        {errorState && (
          <div style={{ fontSize: 9.5, color: "#FFC857", background: "rgba(255, 200, 87, 0.08)", border: "1px solid rgba(255, 200, 87, 0.22)", borderRadius: 8, padding: "8px 12px", width: "100%", textAlign: "center", marginBottom: 14, fontFamily: "monospace" }}>
            MIC DRIVER ERROR: TYPING SIMULATION FALLBACK ENGAGED.
          </div>
        )}

        {/* Manual Keyboard input prompt */}
        <form onSubmit={handleSubmit} style={{ width: "100%", display: "flex", gap: 8 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Command style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 12, height: 12, color: "rgba(148, 163, 184, 0.5)" }} />
            <input
              ref={inputRef}
              type="text"
              value={typedCommand}
              onChange={e => setTypedCommand(e.target.value)}
              placeholder="Or type directive here…"
              style={{
                width: "100%", background: "rgba(2, 6, 23, 0.85)",
                border: "1px solid rgba(0, 245, 255, 0.2)", borderRadius: 8,
                color: "#e2e8f0", padding: "8px 12px", paddingLeft: 28,
                fontSize: 11, fontFamily: "monospace", outline: "none"
              }}
            />
          </div>
          <button
            type="submit"
            disabled={!typedCommand.trim()}
            style={{
              display: "flex", alignItems: "center", justifyCenter: "center",
              padding: "8px 14px", borderRadius: 8, background: typedCommand.trim() ? "rgba(0, 245, 255, 0.15)" : "rgba(255,255,255,0.02)",
              border: typedCommand.trim() ? "1px solid rgba(0, 245, 255, 0.3)" : "1px solid rgba(255,255,255,0.05)",
              color: typedCommand.trim() ? "#00F5FF" : "rgba(148, 163, 184, 0.4)",
              cursor: typedCommand.trim() ? "pointer" : "not-allowed", transition: "all 0.15s"
            }}
          >
            <Send style={{ width: 12, height: 12 }} />
          </button>
        </form>

        {/* CSS Keyframes injected for pulsing bars */}
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes voice-pulse-bar {
            0% { transform: scaleY(0.2); opacity: 0.45; }
            100% { transform: scaleY(1); opacity: 1; }
          }
        `}} />
      </div>
    </div>
  );
}
