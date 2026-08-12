import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { http, streamChat } from "./api";
import { toast } from "../components/Toast";
import { useSecurity } from "./SecurityContext";
import { speak as ttsSpeak, stopSpeaking as ttsStop, preloadVoices } from "./tts";

const VoiceContext = createContext(null);

export function VoiceProvider({ children }) {
  const navigate = useNavigate();
  const { lockSystem, isLocked } = useSecurity();

  const [isListening, setIsListening] = useState(false);
  const [isShutdown, setIsShutdown] = useState(false);
  const [lastTranscript, setLastTranscript] = useState("");
  const [voices, setVoices] = useState([]);
  const [ambientActive, setAmbientActive] = useState(() => {
    try {
      const stored = localStorage.getItem("nexus_voice_ambient");
      return stored !== null ? JSON.parse(stored) : true;
    } catch {
      return true;
    }
  });
  const [errorState, setErrorState] = useState("");

  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);
  const ambientActiveRef = useRef(true);
  const isRecognitionRunningRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const speakingSafetyTimerRef = useRef(null); // safety reset for isSpeakingRef
  const speakRef = useRef(null);              // stable ref so recognition effect never re-runs due to speak changes
  const executeVoiceCommandRef = useRef(null); // same for executeVoiceCommand

  // Sync state refs to prevent hooks closure problems
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    ambientActiveRef.current = ambientActive;
  }, [ambientActive]);

  // Preload voices at mount so the best voice is ready immediately
  useEffect(() => {
    preloadVoices();
  }, []);

  // Text-To-Speech — uses the shared human-like TTS engine
  const speak = useCallback((text) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    // Clear any existing safety timer
    if (speakingSafetyTimerRef.current) {
      clearTimeout(speakingSafetyTimerRef.current);
      speakingSafetyTimerRef.current = null;
    }

    isSpeakingRef.current = true;

    const clearSpeaking = () => {
      isSpeakingRef.current = false;
      if (speakingSafetyTimerRef.current) {
        clearTimeout(speakingSafetyTimerRef.current);
        speakingSafetyTimerRef.current = null;
      }
    };

    // Safety fallback: browsers sometimes never fire onend
    const wordCount = text.trim().split(/\s+/).length;
    const estimatedMs = Math.ceil((wordCount / 130) * 60 * 1000) + 2000;
    speakingSafetyTimerRef.current = setTimeout(() => {
      if (isSpeakingRef.current) {
        console.warn("[NEXUS Voice] Safety reset: isSpeakingRef was stuck true.");
        isSpeakingRef.current = false;
      }
    }, estimatedMs);

    ttsSpeak(text, {
      lang: "en-US",
      rate: 1.0,
      pitch: 1.0,
      onEnd: clearSpeaking,
      onError: clearSpeaking,
    });
  }, []);

  // Keep speakRef always pointing to latest speak without causing effect re-runs
  useEffect(() => { speakRef.current = speak; }, [speak]);

  // Execute text commands (shared between speech recognition and typing fallback console)
  // Execute text commands (shared between speech recognition and typing fallback console)
  const executeVoiceCommand = useCallback(async (transcript) => {
    const clean = transcript.toLowerCase().trim();
    setLastTranscript(transcript);

    // If system is secure-locked, intercept directives
    if (isLocked) {
      if (clean.includes("unlock") || clean.includes("access")) {
        speak("Biometric identity shield is active. Please perform face scan or enter bypass PIN.");
        toast.info("System is locked. Perform Face Scan or enter bypass PIN.");
        return;
      }
      speak("Access denied. System secure locked.");
      toast.warning("Access denied: OS is locked");
      return;
    }

    // 1. SHUTDOWN COMMANDS
    if (clean.includes("shutdown") || clean.includes("power down") || clean.includes("power off")) {
      speak("Initiating OS shutdown sequence. Purging memory blocks. System offline.");
      setIsShutdown(true);
      return;
    }

    // 2. LOCK SYSTEM COMMANDS
    if (clean.includes("lock system") || clean.includes("lock os") || clean.includes("engage lock")) {
      speak("Locking system. Biometric security engaged.");
      lockSystem();
      return;
    }

    // 3. NAVIGATION COMMANDS
    if (clean.includes("terminal") || clean.includes("shell") || clean.includes("console")) {
      speak("Navigating to sector terminal.");
      navigate("/terminal");
      return;
    }
    if (clean.includes("security") || clean.includes("biometrics") || clean.includes("lock setting")) {
      speak("Navigating to sector security.");
      navigate("/biometrics");
      return;
    }
    if (clean.includes("chat") || clean.includes("talk") || clean.includes("assistant")) {
      speak("Navigating to chat sector.");
      navigate("/chat");
      return;
    }
    if (clean.includes("agent") || clean.includes("agents") || clean.includes("swarm")) {
      speak("Navigating to agents hub.");
      navigate("/agents");
      return;
    }
    if (clean.includes("knowledge") || clean.includes("kb") || clean.includes("docs") || clean.includes("documents")) {
      speak("Navigating to knowledge base.");
      navigate("/knowledge");
      return;
    }
    if (clean.includes("code") || clean.includes("editor") || clean.includes("assistant editor") || clean.includes("compiler")) {
      speak("Navigating to code assistant.");
      navigate("/code");
      return;
    }
    if (clean.includes("browser") || clean.includes("web") || clean.includes("internet") || clean.includes("chrome")) {
      speak("Navigating to sandbox browser.");
      navigate("/browser");
      return;
    }
    if (clean.includes("memory") || clean.includes("vault")) {
      speak("Navigating to memory vault.");
      navigate("/memory");
      return;
    }
    if (clean.includes("task") || clean.includes("todo") || clean.includes("planner")) {
      speak("Navigating to task manager.");
      navigate("/tasks");
      return;
    }
    if (clean.includes("monitor") || clean.includes("metrics") || clean.includes("system status") || clean.includes("telemetry")) {
      speak("Navigating to system monitor.");
      navigate("/monitor");
      return;
    }
    if (clean.includes("settings") || clean.includes("config")) {
      speak("Navigating to settings console.");
      navigate("/settings");
      return;
    }
    if (clean.includes("camera") || clean.includes("video") || clean.includes("webcam")) {
      speak("Navigating to camera console.");
      navigate("/camera");
      return;
    }
    if (clean.includes("particle") || clean.includes("particles") || clean.includes("playground")) {
      speak("Launching particle playground.");
      navigate("/particles");
      return;
    }
    if (clean.includes("hand anim") || clean.includes("hand tracking") || clean.includes("kinetic")) {
      speak("Navigating to hand animation studio.");
      navigate("/handanim");
      return;
    }
    if (clean.includes("animation studio") || clean.includes("animate")) {
      speak("Navigating to animation studio.");
      navigate("/animate");
      return;
    }
    if (clean.includes("dashboard") || clean.includes("home") || clean.includes("command center")) {
      speak("Navigating to primary command center.");
      navigate("/");
      return;
    }

    // 4. TERMINAL COMMAND EXECUTION: "run command ls" or "execute terminal command status"
    if (clean.startsWith("run command ") || clean.startsWith("execute command ") || clean.startsWith("terminal execute ") || clean.startsWith("terminal run ")) {
      const commandToRun = clean.replace(/^(run command|execute command|terminal execute|terminal run)\s+/, "");
      if (commandToRun) {
        // Automatically navigate to terminal screen to see output
        navigate("/terminal");
        speak(`Executing terminal command: ${commandToRun}`);
        try {
          const res = await http.post("/terminal/exec", { command: commandToRun });
          const output = res.data.output || "No output returned.";
          speak(`Command execution completed. Output matches console log.`);
          toast.success(`Terminal Command run: "${commandToRun}"`);
          // Dispatch a global event to refresh terminal console if open
          window.dispatchEvent(new CustomEvent("terminal-command-executed", { detail: { command: commandToRun, output } }));
        } catch (err) {
          speak("Command failed to execute.");
          toast.error("Failed to run terminal command");
        }
        return;
      }
    }

    // 5. MEMORY CREATION: "remember that my name is Pushkar" or "add memory buy servers"
    if (clean.startsWith("remember that ") || clean.startsWith("remember ") || clean.startsWith("save memory ") || clean.startsWith("add memory ")) {
      const content = transcript.replace(/^(remember that|remember|save memory|add memory)\s+/i, "");
      if (content) {
        speak(`Saving memory block: ${content}`);
        try {
          await http.post("/memory", {
            title: "Voice Memory",
            content: content.charAt(0).toUpperCase() + content.slice(1),
            category: "general",
            tags: ["voice"],
            importance: 3
          });
          toast.success(`Memory Saved: "${content}"`);
          // Trigger reload/update if on Memory page
          if (window.location.pathname === "/memory") {
            window.location.reload();
          }
        } catch (err) {
          toast.error("Failed to save memory via voice");
        }
        return;
      }
    }

    // 6. TASK CREATION: "create task clean log files" or "add task audit subnet"
    if (clean.startsWith("create task ") || clean.startsWith("add task ") || clean.startsWith("new task ") || clean.startsWith("add to-do ")) {
      const taskTitle = transcript.replace(/^(create task|add task|new task|add to-do)\s+/i, "");
      if (taskTitle) {
        speak(`Creating task: ${taskTitle}`);
        try {
          await http.post("/tasks", {
            title: taskTitle.charAt(0).toUpperCase() + taskTitle.slice(1),
            description: "Created via Operator Voice command.",
            priority: "medium",
          });
          toast.success(`Task created: "${taskTitle}"`);
          // Refresh list if on Tasks page
          if (window.location.pathname === "/tasks") {
            window.location.reload();
          }
        } catch (err) {
          toast.error("Failed to create task via voice");
        }
        return;
      }
    }

    // 7. SYSTEM STATUS CHECKS
    if (clean.includes("system status") || clean.includes("security status") || clean.includes("shield status") || clean.includes("status check")) {
      speak("System status is nominal. Security shields are active. All core services online.");
      toast.info("Status Check: Nominal");
      return;
    }

    // 8. HELP COMMANDS
    if (clean === "help" || clean.includes("what can i say") || clean.includes("list commands")) {
      speak("Valid voice directives include: navigate sector, run command, save memory, lock system, initiate shutdown, or create task.");
      toast.info("Try: 'open terminal', 'run command ls', 'remember meeting tomorrow', 'lock system'");
      return;
    }

    // 9. AI CHAT FALLBACK (Allows accessing all capabilities via general voice AI queries)
    speak("Analyzing directive...");
    toast.info(`Querying AI: "${transcript}"`);
    
    let fullResponseText = "";
    try {
      await streamChat({
        agent: "nexus-core",
        message: transcript,
        onMeta: () => {},
        onDelta: (content) => {
          fullResponseText += content;
        },
        onDone: () => {
          const cleanText = fullResponseText
            .replace(/```[\s\S]*?```/g, "[code block]")
            .replace(/[*#`_\-]/g, "")
            .trim();
          speak(cleanText);
          toast.success("Response compiled.");
        },
        onError: (err) => {
          speak("Failed to query the Nexus database.");
          toast.error("Query failed: " + err.message);
        }
      });
    } catch (err) {
      speak("An error occurred during network transit.");
    }
  }, [navigate, lockSystem, isLocked, speak]);

  // Keep executeVoiceCommandRef always pointing to latest without causing effect re-runs
  useEffect(() => { executeVoiceCommandRef.current = executeVoiceCommand; }, [executeVoiceCommand]);

  // Speech Recognition setup — runs ONCE only (uses stable refs for speak/executeVoiceCommand)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Web Speech Recognition API not supported in this browser.");
      return;
    }

    // continuous=true keeps the mic ALWAYS open — no gap between utterances
    // where wake words can be missed during a restart window
    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = "en-US";

    const tryRestart = (delayMs = 400) => {
      setTimeout(() => {
        if (!isRecognitionRunningRef.current && ambientActiveRef.current) {
          try {
            rec.start();
          } catch (err) {
            console.warn("[NEXUS Voice] Ambient restart failed:", err);
          }
        }
      }, delayMs);
    };

    rec.onstart = () => {
      isRecognitionRunningRef.current = true;
      setErrorState("");
    };

    // onend only fires if the session is explicitly stopped or crashes
    rec.onend = () => {
      isRecognitionRunningRef.current = false;
      if (ambientActiveRef.current) tryRestart();
    };

    rec.onerror = (e) => {
      if (e.error === "aborted") return; // normal rec.stop() — ignore

      if (e.error === "not-allowed") {
        toast.error("Microphone access blocked. Enable permissions in browser settings.");
        return; // do NOT restart — user must grant permission first
      }

      // no-speech / network / audio-capture: non-fatal, restart after short delay
      console.warn("[NEXUS Voice] Error:", e.error, "— restarting");
      isRecognitionRunningRef.current = false;
      if (ambientActiveRef.current) tryRestart(600);
    };

    rec.onresult = (e) => {
      // In continuous mode, results accumulate — always read the LAST one
      const lastResult = e.results[e.results.length - 1];
      if (!lastResult.isFinal) return; // only act on final (confirmed) transcripts

      const transcript = lastResult[0].transcript.trim();
      const clean = transcript.toLowerCase();

      if (isListeningRef.current) {
        // COMMAND MODE: user already said wake word, now giving a command.
        // Do NOT block on isSpeakingRef here — NEXUS's own "online" response
        // sets isSpeakingRef=true which would swallow the user's actual command.
        if (executeVoiceCommandRef.current) executeVoiceCommandRef.current(transcript);
        isListeningRef.current = false;
        setIsListening(false);
      } else {
        // AMBIENT MODE: only listen for wake words.
        // Block TTS echo here to avoid our own speech triggering a wake word.
        if (isSpeakingRef.current) return;

        // Normalise: remove hyphens so "wake-up" → "wake up", lowercase already done
        const normalised = clean.replace(/-/g, " ");

        const isWakeWord =
          // "wake up" variants — Chrome often transcribes as "wakeup" (no space) or "wake-up"
          normalised.includes("wake up") ||
          normalised.includes("wakeup") ||
          normalised === "wake" ||
          normalised.startsWith("wake ") ||
          normalised.includes("activate voice mode") ||
          normalised.includes("start voice mode") ||
          normalised.includes("enable voice mode") ||
          normalised.includes("voice command mode") ||
          normalised.includes("activate assistant") ||
          // nexus variants
          normalised.includes("nexus") ||
          normalised.includes("hey nexus") ||
          normalised.includes("hello nexus") ||
          normalised.includes("activate nexus") ||
          normalised.includes("nexus wake") ||
          normalised.includes("nexus online");

        if (isWakeWord) {
          isListeningRef.current = true; // set synchronously — beats any follow-up result
          setIsListening(true);
          if (speakRef.current) speakRef.current("NEXUS online. Awaiting your directive.");
          toast.success("✦ NEXUS activated — speak your command");
        }
      }
    };

    recognitionRef.current = rec;

    // Boot the ambient listener
    if (ambientActiveRef.current) {
      try {
        rec.start();
      } catch (err) {
        console.warn("Initial ambient speech recognition start failed:", err);
      }
    }

    // Fallback: Start ambient listener on first user interaction to bypass browser gestures policy
    const startAmbientOnInteraction = () => {
      if (ambientActiveRef.current && !isRecognitionRunningRef.current) {
        try {
          rec.start();
          console.log("[NEXUS Voice] Ambient listening started on user interaction.");
        } catch (err) {
          // ignore
        }
      }
      window.removeEventListener("click", startAmbientOnInteraction);
      window.removeEventListener("keydown", startAmbientOnInteraction);
    };

    window.addEventListener("click", startAmbientOnInteraction);
    window.addEventListener("keydown", startAmbientOnInteraction);

    return () => {
      rec.onend = null;
      rec.onerror = null;
      rec.onresult = null;
      window.removeEventListener("click", startAmbientOnInteraction);
      window.removeEventListener("keydown", startAmbientOnInteraction);
      try { rec.stop(); } catch (_) {}
    };
  }, []); // ← empty deps: intentionally runs once, uses refs for all callbacks

  const startListening = () => {
    if (recognitionRef.current) {
      setIsListening(true);
      speak("NEXUS online. Awaiting directives.");
      if (!isRecognitionRunningRef.current) {
        try {
          recognitionRef.current.start();
        } catch (err) {
          console.warn("Failed to start speech recognition:", err);
        }
      }
    } else {
      setIsListening(true);
      toast.warning("Speech Recognition API is not supported in this browser. Triggering keyboard simulation.");
      setErrorState("Speech Recognition API not supported");
    }
  };

  const stopListening = () => {
    setIsListening(false);
    if (!ambientActiveRef.current && recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const toggleAmbientActive = (val) => {
    setAmbientActive(val);
    try {
      localStorage.setItem("nexus_voice_ambient", JSON.stringify(val));
    } catch {}
    if (!val && !isListeningRef.current && recognitionRef.current) {
      recognitionRef.current.stop();
    } else if (val && recognitionRef.current && !isRecognitionRunningRef.current) {
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.warn("Failed to start ambient recognition:", err);
      }
    }
  };

  const rebootSystem = () => {
    setIsShutdown(false);
    speak("NEXUS OS Core online. Welcome back, operator.");
    toast.success("System reboot complete. Operating normal.");
    navigate("/");
  };

  return (
    <VoiceContext.Provider
      value={{
        isListening,
        isShutdown,
        lastTranscript,
        errorState,
        ambientActive,
        setAmbientActive: toggleAmbientActive,
        startListening,
        stopListening,
        speak,
        executeVoiceCommand,
        rebootSystem,
      }}
    >
      {children}
    </VoiceContext.Provider>
  );
}

export function useVoice() {
  const context = useContext(VoiceContext);
  if (!context) {
    throw new Error("useVoice must be used within a VoiceProvider");
  }
  return context;
}
