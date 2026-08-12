/**
 * tts.js — Human-like Text-to-Speech engine for NEXUS AI OS
 *
 * Strategy:
 *  1. Pick the BEST available voice using a scored priority list (neural > standard)
 *  2. Pre-process text so pauses, emphasis and sentence rhythm sound natural
 *  3. Expose a simple speak(text, options) API used across the whole app
 */

// ─── Voice priority scoring ────────────────────────────────────────────────────
// Higher score = better / more natural-sounding voice.
const VOICE_SCORES = [
  // Google neural voices (Chrome on Windows / Android) — best quality
  { match: /Google.*English.*United States/i, score: 100 },
  { match: /Google.*English.*UK/i,            score: 95  },
  { match: /Google.*English/i,                score: 90  },
  { match: /Google/i,                         score: 80  },

  // Microsoft neural online voices (Edge / Windows 11)
  { match: /Microsoft.*Aria.*Online/i,        score: 98  },
  { match: /Microsoft.*Jenny.*Online/i,       score: 96  },
  { match: /Microsoft.*Guy.*Online/i,         score: 94  },
  { match: /Microsoft.*Emma.*Online/i,        score: 93  },
  { match: /Microsoft.*Ryan.*Online/i,        score: 92  },
  { match: /Microsoft.*Ana.*Online/i,         score: 91  },
  { match: /Microsoft.*Online/i,              score: 85  },
  { match: /Microsoft.*Zira/i,                score: 72  },
  { match: /Microsoft.*David/i,               score: 70  },
  { match: /Microsoft/i,                      score: 65  },

  // macOS / iOS high-quality voices
  { match: /Samantha/i,                       score: 88  },
  { match: /Karen/i,                          score: 86  },
  { match: /Moira/i,                          score: 84  },
  { match: /Daniel/i,                         score: 83  },

  // Generic named voices
  { match: /female/i,                         score: 40  },
  { match: /male/i,                           score: 38  },
];

function scoreVoice(voice) {
  for (const { match, score } of VOICE_SCORES) {
    if (match.test(voice.name)) return score;
  }
  return 10;
}

// ─── Voice cache ───────────────────────────────────────────────────────────────
let _voiceCache = null;
let _voiceCacheTime = 0;

function getVoices() {
  const now = Date.now();
  if (_voiceCache && now - _voiceCacheTime < 10_000) return _voiceCache;
  _voiceCache = window.speechSynthesis?.getVoices() || [];
  _voiceCacheTime = now;
  return _voiceCache;
}

/** Returns the highest-quality voice for the given BCP-47 language code. */
export function getBestVoice(langCode = "en-US") {
  const voices = getVoices();
  const langPrefix = langCode.split("-")[0].toLowerCase();

  // Gather candidates: exact lang first, then prefix-matched
  const exact  = voices.filter(v => v.lang.toLowerCase() === langCode.toLowerCase());
  const prefix = voices.filter(v => v.lang.toLowerCase().startsWith(langPrefix));
  const seen   = new Set();
  const unique = [...exact, ...prefix].filter(v => {
    if (seen.has(v.name)) return false;
    seen.add(v.name);
    return true;
  });

  if (!unique.length) {
    // Absolute fallback — any English voice
    const eng = voices.filter(v => v.lang.toLowerCase().startsWith("en"));
    return eng.length
      ? eng.sort((a, b) => scoreVoice(b) - scoreVoice(a))[0]
      : voices[0] || null;
  }

  return unique.sort((a, b) => scoreVoice(b) - scoreVoice(a))[0];
}

// ─── Text pre-processing ───────────────────────────────────────────────────────
/**
 * Clean AI/markdown output so it sounds natural when read aloud:
 *  - Strip markdown formatting & code blocks
 *  - Expand symbols to words
 *  - Add natural pause markers at sentence & clause boundaries
 */
export function preprocessForSpeech(text) {
  let t = text;

  // Remove fenced code blocks
  t = t.replace(/```[\s\S]*?```/g, " [code omitted] ");
  // Inline code → plain text
  t = t.replace(/`([^`]+)`/g, "$1");

  // Strip markdown formatting
  t = t.replace(/#{1,6}\s+/g, "");
  t = t.replace(/\*\*(.*?)\*\*/gs, "$1");
  t = t.replace(/\*(.*?)\*/gs, "$1");
  t = t.replace(/__(.*?)__/gs, "$1");
  t = t.replace(/_(.*?)_/gs, "$1");
  t = t.replace(/~~(.*?)~~/gs, "$1");
  t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  t = t.replace(/^\s*[-*•]\s+/gm, "");
  t = t.replace(/^\s*\d+\.\s+/gm, "");
  t = t.replace(/\|[^\n]+\|/g, "");
  t = t.replace(/---+/g, ".");

  // Expand symbols
  t = t.replace(/&/g, " and ");
  t = t.replace(/%/g, " percent ");
  t = t.replace(/\$/g, " dollars ");
  t = t.replace(/€/g, " euros ");
  t = t.replace(/\+/g, " plus ");
  t = t.replace(/\bvs\.\b/gi, "versus");
  t = t.replace(/\betc\./gi, "etcetera");
  t = t.replace(/\be\.g\./gi, "for example,");
  t = t.replace(/\bi\.e\./gi, "that is,");

  // Natural pauses: double space after sentence-ending punctuation
  t = t.replace(/([.!?])\s+/g, "$1  ");

  // Collapse excessive whitespace
  t = t.replace(/[ \t]{3,}/g, "  ").trim();

  return t;
}

// ─── Core speak() API ──────────────────────────────────────────────────────────
/**
 * speak(text, options) — speak text with the best available voice.
 *
 * Options:
 *   lang    {string}  BCP-47 code, e.g. "en-US"  (default: "en-US")
 *   rate    {number}  0.8–1.2, natural feels like 0.95–1.05  (default: 1.0)
 *   pitch   {number}  0.9–1.1  (default: 1.0)
 *   volume  {number}  0–1  (default: 1.0)
 *   onStart {fn}      fired when speech starts
 *   onEnd   {fn}      fired when speech ends or is cancelled
 *   onError {fn}      fired on a real error
 *
 * Returns a cancel() function you can call to stop speech early.
 */
export function speak(text, options = {}) {
  const synth = window.speechSynthesis;
  if (!synth) return () => {};

  const {
    lang   = "en-US",
    rate   = 1.0,
    pitch  = 1.0,
    volume = 1.0,
    onStart = null,
    onEnd   = null,
    onError = null,
  } = options;

  synth.cancel(); // stop anything currently playing

  const clean = preprocessForSpeech(text);
  if (!clean.trim()) return () => {};

  const utter = new SpeechSynthesisUtterance(clean);
  utter.lang   = lang;
  utter.rate   = rate;
  utter.pitch  = pitch;
  utter.volume = volume;

  const assignVoice = () => {
    const best = getBestVoice(lang);
    if (best) utter.voice = best;
  };

  const voices = getVoices();
  if (voices.length > 0) {
    assignVoice();
    synth.speak(utter);
  } else {
    // Voices not ready yet — wait for voiceschanged then speak
    const handler = () => {
      _voiceCache = null;
      assignVoice();
      synth.speak(utter);
      synth.removeEventListener("voiceschanged", handler);
    };
    synth.addEventListener("voiceschanged", handler);
    // Safety: speak anyway after 600 ms even if event never fires
    setTimeout(() => {
      if (synth.pending || synth.speaking) return;
      synth.speak(utter);
    }, 600);
  }

  utter.onstart = () => onStart?.();
  utter.onend   = () => onEnd?.();
  utter.onerror = (e) => {
    if (e.error === "interrupted" || e.error === "canceled") {
      onEnd?.(); // normal cancellation — not a real error
    } else {
      onError?.(e);
    }
  };

  return () => synth.cancel();
}

/** Stop any current speech immediately. */
export function stopSpeaking() {
  window.speechSynthesis?.cancel();
}

/**
 * preloadVoices() — kick off voice list loading at app boot so voices are
 * ready the first time the user clicks Speak.
 */
export function preloadVoices() {
  if (!window.speechSynthesis) return;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) {
    window.speechSynthesis.addEventListener("voiceschanged", () => {
      _voiceCache = null;
      getVoices();
    }, { once: true });
  } else {
    _voiceCache = voices;
    _voiceCacheTime = Date.now();
  }
}
