import { useState } from "react";

const GLOW_COLORS = {
  cyan: {
    base: "#00F5FF",
    glow: "rgba(0, 245, 255, 0.35)",
    border: "rgba(0, 245, 255, 0.25)",
    bg: "rgba(0, 245, 255, 0.03)",
  },
  pink: {
    base: "#FF2E88",
    glow: "rgba(255, 46, 136, 0.35)",
    border: "rgba(255, 46, 136, 0.25)",
    bg: "rgba(255, 46, 136, 0.03)",
  },
  purple: {
    base: "#6E56FF",
    glow: "rgba(110, 86, 255, 0.35)",
    border: "rgba(110, 86, 255, 0.25)",
    bg: "rgba(110, 86, 255, 0.03)",
  },
  green: {
    base: "#00FF88",
    glow: "rgba(0, 255, 136, 0.35)",
    border: "rgba(0, 255, 136, 0.25)",
    bg: "rgba(0, 255, 136, 0.03)",
  },
  amber: {
    base: "#FFC857",
    glow: "rgba(255, 200, 87, 0.35)",
    border: "rgba(255, 200, 87, 0.25)",
    bg: "rgba(255, 200, 87, 0.03)",
  },
  red: {
    base: "#FF4D4D",
    glow: "rgba(255, 77, 77, 0.35)",
    border: "rgba(255, 77, 77, 0.25)",
    bg: "rgba(255, 77, 77, 0.03)",
  },
  none: {
    base: "rgba(255, 255, 255, 0.7)",
    glow: "rgba(255, 255, 255, 0)",
    border: "rgba(255, 255, 255, 0.1)",
    bg: "rgba(255, 255, 255, 0)",
  }
};

export default function GlassCard({
  children,
  glowColor = "cyan",
  hoverEffect = true,
  reflection = true,
  header,
  footer,
  style = {},
  className = "",
  titleStyle = {},
  onClick,
}) {
  const [isHovered, setIsHovered] = useState(false);
  const theme = GLOW_COLORS[glowColor] || GLOW_COLORS.none;

  const cardStyle = {
    position: "relative",
    overflow: "hidden",
    borderRadius: "16px",
    background: isHovered && hoverEffect
      ? `linear-gradient(135deg, rgba(15, 23, 42, 0.55) 0%, rgba(6, 13, 34, 0.45) 100%)`
      : `linear-gradient(135deg, rgba(15, 23, 42, 0.45) 0%, rgba(6, 13, 34, 0.3) 100%)`,
    backdropFilter: "blur(18px) saturate(140%)",
    WebkitBackdropFilter: "blur(18px) saturate(140%)",
    border: `1px solid ${isHovered && hoverEffect ? theme.base : theme.border}`,
    boxShadow: isHovered && hoverEffect
      ? `0 12px 40px rgba(0, 0, 0, 0.5), 0 0 25px ${theme.glow}, inset 0 0 12px rgba(255, 255, 255, 0.05)`
      : `0 8px 32px rgba(0, 0, 0, 0.4), 0 0 10px ${theme.glow ? `rgba(${hexToRgb(theme.base)}, 0.15)` : "rgba(0,0,0,0)"}, inset 0 0 8px rgba(255, 255, 255, 0.02)`,
    transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
    transform: isHovered && hoverEffect ? "translateY(-6px) scale(1.015)" : "none",
    cursor: onClick ? "pointer" : "default",
    display: "flex",
    flexDirection: "column",
    ...style,
  };

  // Helper function to extract RGB from hex for alpha modification
  function hexToRgb(hex) {
    if (hex.startsWith("rgba")) return "0, 245, 255"; // Safe default fallback
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
      : "0, 245, 255";
  }

  const sheenStyle = {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: isHovered && hoverEffect
      ? "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 40%, rgba(255,255,255,0.01) 60%, rgba(255,255,255,0.05) 100%)"
      : "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 50%, rgba(255,255,255,0.02) 100%)",
    pointerEvents: "none",
    zIndex: 1,
    transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
  };

  const ambientBgStyle = {
    position: "absolute",
    top: "-30%",
    left: "-30%",
    width: "160%",
    height: "160%",
    background: `radial-gradient(circle at center, ${theme.bg} 0%, transparent 60%)`,
    pointerEvents: "none",
    zIndex: 0,
    opacity: isHovered && hoverEffect ? 1 : 0.6,
    transition: "opacity 0.4s ease",
  };

  return (
    <div
      style={cardStyle}
      className={`nx-glass-card ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      {reflection && <div style={sheenStyle} />}
      <div style={ambientBgStyle} />

      {/* Decorative cyber corner accents */}
      {glowColor !== "none" && (
        <>
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: 12,
              height: 12,
              borderTop: `2px solid ${theme.base}`,
              borderLeft: `2px solid ${theme.base}`,
              borderTopLeftRadius: 16,
              opacity: isHovered ? 1 : 0.4,
              transition: "opacity 0.3s",
              zIndex: 2,
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 0,
              right: 0,
              width: 12,
              height: 12,
              borderBottom: `2px solid ${theme.base}`,
              borderRight: `2px solid ${theme.base}`,
              borderBottomRightRadius: 16,
              opacity: isHovered ? 1 : 0.4,
              transition: "opacity 0.3s",
              zIndex: 2,
            }}
          />
        </>
      )}

      {/* Card Header */}
      {header && (
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            position: "relative",
            zIndex: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            ...titleStyle,
          }}
        >
          {typeof header === "string" ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {glowColor !== "none" && (
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    backgroundColor: theme.base,
                    boxShadow: `0 0 8px ${theme.base}`,
                    display: "inline-block",
                  }}
                />
              )}
              <span
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 600,
                  fontSize: "14px",
                  color: "#f1f5f9",
                  letterSpacing: "0.02em",
                }}
              >
                {header}
              </span>
            </div>
          ) : (
            header
          )}
        </div>
      )}

      {/* Card Body */}
      <div
        style={{
          padding: "20px",
          flex: 1,
          position: "relative",
          zIndex: 2,
        }}
      >
        {children}
      </div>

      {/* Card Footer */}
      {footer && (
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid rgba(255, 255, 255, 0.05)",
            background: "rgba(2, 6, 23, 0.2)",
            position: "relative",
            zIndex: 2,
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );
}
