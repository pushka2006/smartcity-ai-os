import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { http } from "./api";
import { toast } from "../components/Toast";

const SecurityContext = createContext(null);

export function SecurityProvider({ children }) {
  const [isLocked, setIsLocked] = useState(() => {
    return localStorage.getItem("nexus_sys_locked") === "true";
  });
  const [settings, setSettings] = useState({
    enabled: false,
    bypass_pin: "1337",
    auto_lock_minutes: 0,
    lock_terminal: false,
    lock_database: false,
  });
  const [hasRegisteredFace, setHasRegisteredFace] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // { callback }
  const [isPromptOpen, setIsPromptOpen] = useState(false);

  const inactivityTimerRef = useRef(null);

  // Fetch settings & check if faces are registered
  const fetchSecurityStatus = useCallback(async () => {
    try {
      const [settRes, sigRes] = await Promise.all([
        http.get("/biometrics/settings"),
        http.get("/biometrics/signatures"),
      ]);
      setSettings(settRes.data);
      setHasRegisteredFace(sigRes.data.length > 0);
      
      // If biometrics are enabled and no face is registered, display a warning toast
      if (settRes.data.enabled && sigRes.data.length === 0) {
        toast.warning("Biometric lock is active but no face is registered! Please register your face.");
      }
    } catch (err) {
      console.error("Failed to load security status", err);
    }
  }, []);

  useEffect(() => {
    fetchSecurityStatus();
  }, [fetchSecurityStatus]);

  // Handle system lock state persistence
  const lockSystem = useCallback(() => {
    setIsLocked(true);
    localStorage.setItem("nexus_sys_locked", "true");
    toast.info("NEXUS OS locked");
  }, []);

  const unlockSystem = useCallback(() => {
    setIsLocked(false);
    localStorage.removeItem("nexus_sys_locked");
    toast.success("Identity verified. System unlocked.");
  }, []);

  // Update biometric settings
  const updateSettings = async (newSettings) => {
    try {
      const res = await http.post("/biometrics/settings", newSettings);
      setSettings(res.data);
      toast.success("Security settings updated");
      return res.data;
    } catch (err) {
      toast.error("Failed to save security settings");
      throw err;
    }
  };

  // Inactivity auto-lock timer
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    if (!settings.enabled || settings.auto_lock_minutes <= 0 || isLocked) {
      return;
    }

    inactivityTimerRef.current = setTimeout(() => {
      lockSystem();
    }, settings.auto_lock_minutes * 60 * 1000);
  }, [settings.enabled, settings.auto_lock_minutes, isLocked, lockSystem]);

  useEffect(() => {
    const events = ["mousemove", "keydown", "mousedown", "touchstart"];
    const handler = () => resetInactivityTimer();

    events.forEach((evt) => window.addEventListener(evt, handler));
    resetInactivityTimer();

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handler));
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [resetInactivityTimer]);

  // Guarded actions
  const verifyAction = useCallback((callback, actionName = "secure operation") => {
    // If security is disabled, just run callback immediately
    if (!settings.enabled) {
      callback();
      return;
    }
    
    // Check which guards are active depending on the action name
    if (actionName === "terminal" && !settings.lock_terminal) {
      callback();
      return;
    }
    if (actionName === "database" && !settings.lock_database) {
      callback();
      return;
    }

    // Otherwise, prompt for biometric check
    setPendingAction({ callback, actionName });
    setIsPromptOpen(true);
  }, [settings]);

  const confirmAction = useCallback(() => {
    if (pendingAction?.callback) {
      pendingAction.callback();
    }
    setIsPromptOpen(false);
    setPendingAction(null);
    toast.success("Action authorized");
  }, [pendingAction]);

  const cancelAction = useCallback(() => {
    setIsPromptOpen(false);
    setPendingAction(null);
    toast.error("Action authorization cancelled");
  }, []);

  return (
    <SecurityContext.Provider
      value={{
        isLocked,
        settings,
        hasRegisteredFace,
        isPromptOpen,
        pendingActionName: pendingAction?.actionName || "",
        lockSystem,
        unlockSystem,
        updateSettings,
        verifyAction,
        confirmAction,
        cancelAction,
        refreshStatus: fetchSecurityStatus,
      }}
    >
      {children}
    </SecurityContext.Provider>
  );
}

export function useSecurity() {
  const context = useContext(SecurityContext);
  if (!context) {
    throw new Error("useSecurity must be used within a SecurityProvider");
  }
  return context;
}
