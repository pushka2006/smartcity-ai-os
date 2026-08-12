import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import { BACKEND_URL } from "../lib/api";

const PROXY_BASE = `${BACKEND_URL}/api/urban/hls-proxy`;

/**
 * Convert a raw HLS .m3u8 URL into a proxied manifest URL so the
 * backend can strip CORS headers from nysdot.skyvdn.com streams.
 * Adds a cache-bust timestamp so the browser never serves stale manifests.
 */
function proxyManifestUrl(originalUrl) {
  if (!originalUrl) return "";
  return `${PROXY_BASE}/manifest?url=${encodeURIComponent(originalUrl)}&_t=${Date.now()}`;
}

/**
 * HlsPlayer — plays a live HLS (.m3u8) stream via a backend CORS proxy.
 * Shows a cyberpunk loading / error HUD while buffering.
 *
 * Props:
 *   src         — original HLS manifest URL (.m3u8)
 *   accentColor — border / glow colour (default "#00F5FF")
 *   height      — pixel height (default 130)
 *   label       — top-left overlay label (default "LIVE")
 *   showOverlay — render HUD corner brackets & scanlines (default true)
 */
export default function HlsPlayer({
  src,
  accentColor = "#00F5FF",
  height = 130,
  label = "LIVE",
  showOverlay = true,
}) {
  const videoRef   = useRef(null);
  const hlsRef     = useRef(null);
  const retryTimer = useRef(null);
  const retryCount = useRef(0);
  const timeoutCount = useRef(0);
  const [state, setState] = useState("loading"); // loading | playing | error

  const destroyHls = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (retryTimer.current) {
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
  }, []);

  const initHls = useCallback(() => {
    if (!src || !videoRef.current) return;
    const video = videoRef.current;
    timeoutCount.current = 0;

    // Always generate a fresh proxy URL so the manifest is never stale
    const proxySrc = proxyManifestUrl(src);

    if (!Hls.isSupported()) {
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        // Safari native HLS — still go through the CORS proxy
        video.src = proxySrc;
        video.load();
        video.play().catch(() => {});
        setState("playing");
      } else {
        setState("error");
      }
      return;
    }

    destroyHls();

    const hls = new Hls({
      enableWorker: true,

      // ── Live stream settings ──────────────────────────────────
      // Do NOT use lowLatencyMode — these are standard HLS streams,
      // not LL-HLS. lowLatencyMode causes them to loop / stall.
      lowLatencyMode: false,

      // Keep buffer small so we stay near real-time, not stuck in a loop
      maxBufferLength:    8,
      maxMaxBufferLength: 16,
      backBufferLength:   4,

      // How far back from the live edge to start playback (seconds).
      // 0 = as close to live as possible.
      liveSyncDurationCount: 2,
      liveMaxLatencyDurationCount: 4,

      // Retry policy — 6 retries with exponential back-off
      manifestLoadingMaxRetry:     6,
      manifestLoadingRetryDelay:   1000,
      manifestLoadingMaxRetryTimeout: 8000,
      levelLoadingMaxRetry:        6,
      levelLoadingRetryDelay:      1000,
      fragLoadingMaxRetry:         6,
      fragLoadingRetryDelay:       1000,

      // Don't cache manifest responses (chunklist changes every ~6 s)
      manifestLoadingTimeOut:  12000,
      levelLoadingTimeOut:     12000,
      fragLoadingTimeOut:      15000,

      // Force-reload the manifest every N seconds to pick up new segments
      // (the chunklist window slides forward continually for live)
      xhrSetup(xhr) {
        xhr.setRequestHeader("Cache-Control", "no-cache, no-store");
        xhr.setRequestHeader("Pragma", "no-cache");
      },
    });

    hlsRef.current = hls;

    hls.loadSource(proxySrc);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      retryCount.current = 0;
      timeoutCount.current = 0;
      // Seek to the absolute live edge before playing
      if (video.duration && isFinite(video.duration)) {
        video.currentTime = video.duration;
      }
      video.play().catch(() => {});
      setState("playing");
    });

    hls.on(Hls.Events.ERROR, (_, data) => {
      console.warn("[HlsPlayer]", data.type, data.details, data.fatal);

      // Check for unrecoverable HTTP response status codes immediately (even if flagged non-fatal)
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
        const statusCode = data.response?.code;
        if (statusCode === 404 || statusCode === 502 || statusCode === 503 || statusCode === 504) {
          console.info(`[HlsPlayer] Upstream returned fatal status ${statusCode}. Marking offline.`);
          setState("error");
          destroyHls();
          return;
        }

        // Count and limit timeout warnings (like levelLoadTimeOut / fragLoadTimeOut) to avoid infinite buffering
        if (data.details === "levelLoadTimeOut" || data.details === "manifestLoadTimeOut" || data.details === "fragLoadTimeOut") {
          timeoutCount.current += 1;
          console.warn(`[HlsPlayer] Timeout warning (${timeoutCount.current}/3)`);
          if (timeoutCount.current >= 3) {
            console.info("[HlsPlayer] Too many network timeouts. Marking offline.");
            setState("error");
            destroyHls();
            return;
          }
        }
      }

      if (!data.fatal) {
        // Non-fatal — let hls.js recover automatically
        return;
      }

      // Fatal error — try to recover or restart
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
        if (retryCount.current < 4) {
          retryCount.current += 1;
          console.info(`[HlsPlayer] Network error — retrying (${retryCount.current}/4)…`);
          hls.startLoad();           // ask hls.js to restart loading
          // Also reload with a fresh manifest URL after a short delay
          retryTimer.current = setTimeout(() => {
            setState("loading");
            initHls();              // full reinit with fresh proxy URL
          }, 3000 * retryCount.current);
        } else {
          setState("error");
          destroyHls();
        }
      } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
        console.info("[HlsPlayer] Media error — attempting media recovery…");
        hls.recoverMediaError();
      } else {
        setState("error");
        destroyHls();
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  useEffect(() => {
    setState("loading");
    retryCount.current = 0;
    initHls();
    return () => destroyHls();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // Auto-recover after signal loss / network glitch
  useEffect(() => {
    if (state === "error") {
      const timer = setTimeout(() => {
        console.info("[HlsPlayer] Auto-retrying stream connection...");
        setState("loading");
        retryCount.current = 0;
        initHls();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [state, initHls]);

  /* ── Layout ── */
  const container = {
    position: "relative",
    width: "100%",
    height,
    borderRadius: 6,
    overflow: "hidden",
    border: `1px solid ${accentColor}30`,
    background: "#030712",
    marginBottom: 8,
  };

  return (
    <div style={container}>
      {/* Video element — always mounted; hidden until stream is confirmed playing */}
      <video
        ref={videoRef}
        muted
        playsInline
        autoPlay
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: state === "playing" ? "block" : "none",
        }}
      />

      {/* ── Loading state ── */}
      {state === "loading" && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 8,
        }}>
          {/* Animated radar rings */}
          <div style={{ position: "relative", width: 42, height: 42 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                position: "absolute",
                inset: `${i * 6}px`,
                borderRadius: "50%",
                border: `1px solid ${accentColor}`,
                opacity: 0.45 - i * 0.1,
                animation: `hlsPulse${i} ${1.2 + i * 0.35}s ease-in-out infinite`,
              }} />
            ))}
            <div style={{
              position: "absolute", inset: "16px", borderRadius: "50%",
              background: accentColor, opacity: 0.55,
              animation: "hlsCore 1s ease-in-out infinite alternate",
            }} />
          </div>
          <span style={{
            fontSize: 8, fontFamily: "monospace",
            color: `${accentColor}99`, letterSpacing: "0.18em",
          }}>
            BUFFERING STREAM…
          </span>
          <style>{`
            @keyframes hlsPulse0{0%,100%{transform:scale(1);opacity:.45}50%{transform:scale(1.12);opacity:.2}}
            @keyframes hlsPulse1{0%,100%{transform:scale(1);opacity:.35}50%{transform:scale(1.09);opacity:.15}}
            @keyframes hlsPulse2{0%,100%{transform:scale(1);opacity:.25}50%{transform:scale(1.06);opacity:.1}}
            @keyframes hlsCore{from{opacity:.3}to{opacity:.7}}
          `}</style>
        </div>
      )}

      {/* ── Error / offline state ── */}
      {state === "error" && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 5,
        }}>
          {/* Static noise overlay */}
          <div style={{
            position: "absolute", inset: 0,
            backgroundImage:
              "repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(239,68,68,0.04) 3px,rgba(239,68,68,0.04) 4px)",
          }} />
          <div style={{
            fontSize: 9, fontFamily: "monospace",
            color: "#ef4444", opacity: 0.75, letterSpacing: "0.12em", zIndex: 1,
          }}>
            ⚠ STREAM OFFLINE
          </div>
          <div style={{
            fontSize: 7.5, color: "rgba(148,163,184,0.4)",
            fontFamily: "monospace", zIndex: 1,
          }}>
            SIGNAL LOSS // FEED UNAVAILABLE
          </div>
          {/* Retry button */}
          <button
            onClick={() => { setState("loading"); retryCount.current = 0; initHls(); }}
            style={{
              marginTop: 6, padding: "3px 10px",
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 4, color: "#ef4444",
              fontSize: 8, fontFamily: "monospace",
              cursor: "pointer", zIndex: 1,
              letterSpacing: "0.1em",
            }}
          >
            ↺ RETRY
          </button>
        </div>
      )}

      {/* ── Cyberpunk HUD overlay (when playing) ── */}
      {showOverlay && state === "playing" && (
        <>
          {/* CRT scanlines */}
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            backgroundImage: "linear-gradient(rgba(0,0,0,0) 50%, rgba(0,0,0,0.18) 50%)",
            backgroundSize: "100% 4px",
          }} />

          {/* Live badge — top left */}
          <div style={{
            position: "absolute", top: 5, left: 5,
            display: "flex", alignItems: "center", gap: 4,
            background: "rgba(2,6,23,0.78)",
            border: `1px solid ${accentColor}55`,
            borderRadius: 3, padding: "2px 6px",
          }}>
            <span style={{
              width: 5, height: 5, borderRadius: "50%",
              background: "#34d399", display: "inline-block",
              animation: "nx-pulse 1.5s ease-in-out infinite",
            }} />
            <span style={{
              fontSize: 7, fontFamily: "monospace",
              color: accentColor, letterSpacing: "0.15em",
            }}>
              {label}
            </span>
          </div>

          {/* Corner bracket SVG overlay */}
          <svg style={{
            position: "absolute", inset: 0,
            width: "100%", height: "100%", pointerEvents: "none",
          }}>
            <path d="M 10 24 L 10 10 L 24 10" stroke={accentColor} strokeWidth="1.5" fill="none" opacity="0.65" />
            <path d="M calc(100% - 24) 10 L calc(100% - 10) 10 L calc(100% - 10) 24" stroke={accentColor} strokeWidth="1.5" fill="none" opacity="0.65" />
            <path d="M 10 calc(100% - 24) L 10 calc(100% - 10) L 24 calc(100% - 10)" stroke={accentColor} strokeWidth="1.5" fill="none" opacity="0.65" />
            <path d="M calc(100% - 24) calc(100% - 10) L calc(100% - 10) calc(100% - 10) L calc(100% - 10) calc(100% - 24)" stroke={accentColor} strokeWidth="1.5" fill="none" opacity="0.65" />
          </svg>
        </>
      )}
    </div>
  );
}
