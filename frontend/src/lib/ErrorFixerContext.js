import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";

const ErrorFixerContext = createContext(null);

const API = "http://localhost:8001/api/error-fixer";

export function ErrorFixerProvider({ children }) {
  const [errors, setErrors] = useState([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Settings
  const [autoLearnEnabled, setAutoLearnEnabled] = useState(() => {
    try { return JSON.parse(localStorage.getItem("nexus_autofixer_learn") ?? "true"); }
    catch { return true; }
  });
  const [autoApplyEnabled, setAutoApplyEnabled] = useState(() => {
    try { return JSON.parse(localStorage.getItem("nexus_autofixer_apply") ?? "false"); }
    catch { return false; }
  });
  const [autoScanEnabled, setAutoScanEnabled] = useState(() => {
    try { return JSON.parse(localStorage.getItem("nexus_autofixer_autoscan") ?? "false"); }
    catch { return false; }
  });
  const [autoFixErrorEnabled, setAutoFixErrorEnabled] = useState(() => {
    try { return JSON.parse(localStorage.getItem("nexus_autofixer_autofix") ?? "false"); }
    catch { return false; }
  });

  const errorIdRef = useRef(0);

  // Persist settings
  useEffect(() => {
    localStorage.setItem("nexus_autofixer_learn", JSON.stringify(autoLearnEnabled));
  }, [autoLearnEnabled]);
  useEffect(() => {
    localStorage.setItem("nexus_autofixer_apply", JSON.stringify(autoApplyEnabled));
  }, [autoApplyEnabled]);
  useEffect(() => {
    localStorage.setItem("nexus_autofixer_autoscan", JSON.stringify(autoScanEnabled));
  }, [autoScanEnabled]);
  useEffect(() => {
    localStorage.setItem("nexus_autofixer_autofix", JSON.stringify(autoFixErrorEnabled));
  }, [autoFixErrorEnabled]);

  const updateError = useCallback((id, patch) => {
    setErrors((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...patch } : e))
    );
  }, []);

  // Internal refs so callbacks always see fresh state
  const autoLearnRef = useRef(autoLearnEnabled);
  const autoApplyRef = useRef(autoApplyEnabled);
  const autoScanRef = useRef(autoScanEnabled);
  const autoFixErrorRef = useRef(autoFixErrorEnabled);
  const errorsRef = useRef(errors);

  useEffect(() => { autoLearnRef.current = autoLearnEnabled; }, [autoLearnEnabled]);
  useEffect(() => { autoApplyRef.current = autoApplyEnabled; }, [autoApplyEnabled]);
  useEffect(() => { autoScanRef.current = autoScanEnabled; }, [autoScanEnabled]);
  useEffect(() => { autoFixErrorRef.current = autoFixErrorEnabled; }, [autoFixErrorEnabled]);
  useEffect(() => { errorsRef.current = errors; }, [errors]);

  // ── Learn a pattern ──────────────────────────────────────────────
  const learnPattern = useCallback(async (error, analysis) => {
    if (!analysis?.affected_file || !analysis?.original_snippet) return;
    try {
      await fetch(`${API}/patterns/learn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error_message: error.message,
          stack_trace: error.stack,
          file_hint: error.fileHint,
          analysis,
        }),
      });
    } catch { /* non-fatal */ }
  }, []);

  // ── Apply fix (internal helper) ──────────────────────────────────
  const _applyFixForError = useCallback(async (err) => {
    updateError(err.id, { status: "applying" });
    try {
      const res = await fetch(`${API}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_path: err.analysis.affected_file,
          original_snippet: err.analysis.original_snippet,
          fixed_snippet: err.analysis.fixed_snippet,
        }),
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(`Apply failed: ${res.status} — ${detail}`);
      }
      const result = await res.json();
      updateError(err.id, { status: "fixed", applyResult: result });

      // Bump auto_fixed counter if from a learned pattern
      if (err.analysis?.from_learned_pattern && err.analysis?.pattern_id) {
        try {
          const patterns = await fetch(`${API}/patterns`).then(r => r.json());
          const pattern = patterns.find(p => p.id === err.analysis.pattern_id);
          if (pattern) {
            await fetch(`${API}/patterns/learn`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                error_message: err.message,
                stack_trace: err.stack,
                file_hint: err.fileHint,
                analysis: { ...err.analysis, times_auto_fixed: (pattern.times_auto_fixed || 0) + 1 },
              }),
            });
          }
        } catch { /* non-fatal */ }
      }

      return result;
    } catch (ex) {
      updateError(err.id, { status: "failed", applyResult: { success: false, message: ex.message } });
      return null;
    }
  }, [updateError]);

  // ── Analyze error ────────────────────────────────────────────────
  const analyzeError = useCallback(async (errorId) => {
    const err = errorsRef.current.find((e) => e.id === errorId);
    if (!err || err.status === "analyzing" || err.status === "applying") return;

    updateError(errorId, { status: "analyzing" });

    try {
      const res = await fetch(`${API}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error_message: err.message,
          stack_trace: err.stack,
          file_hint: err.fileHint,
        }),
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(`Backend error: ${res.status} — ${detail}`);
      }
      const analysis = await res.json();
      updateError(errorId, { status: "analyzed", analysis });

      // Auto-apply if autoFixError or autoApply is enabled and confidence is sufficient
      const shouldAutoApply = (autoFixErrorRef.current || autoApplyRef.current) &&
        analysis?.affected_file && analysis?.original_snippet && analysis?.fixed_snippet;

      if (shouldAutoApply) {
        const updatedErr = { ...err, analysis };
        await _applyFixForError(updatedErr);
      }
    } catch (ex) {
      updateError(errorId, {
        status: "failed",
        analysis: {
          explanation: ex.message,
          affected_file: null,
          original_snippet: null,
          fixed_snippet: null,
          confidence: "low",
          additional_notes: "Could not reach the backend or the request failed.",
          from_learned_pattern: false,
        },
      });
    }
  }, [updateError, _applyFixForError]);

  // ── Auto-fix new runtime errors automatically ────────────────────
  useEffect(() => {
    if (!autoFixErrorEnabled && !autoApplyEnabled) return;
    const newErrors = errors.filter((e) => e.status === "new");
    newErrors.forEach((e) => {
      analyzeError(e.id);
    });
  }, [errors, autoFixErrorEnabled, autoApplyEnabled, analyzeError]);

  // ── Apply fix (public) ───────────────────────────────────────────
  const applyFix = useCallback(async (errorId) => {
    const err = errorsRef.current.find((e) => e.id === errorId);
    if (!err?.analysis?.affected_file) return;

    const result = await _applyFixForError(err);

    // Auto-learn on successful fix
    if (result?.success && autoLearnRef.current && err.analysis && !err.analysis.from_learned_pattern) {
      await learnPattern(err, err.analysis);
    }
  }, [_applyFixForError, learnPattern]);

  // ── Global error capture ─────────────────────────────────────────
  useEffect(() => {
    const addError = (id, type, message, stack) => {
      const fileMatch = stack.match(/\/([\w\-]+\.[jt]sx?):/);
      const fileHint = fileMatch ? fileMatch[1] : "";
      setErrors((prev) => [
        {
          id, type, message, stack, fileHint,
          timestamp: new Date().toISOString(),
          status: "new",
          analysis: null,
          applyResult: null,
        },
        ...prev,
      ].slice(0, 50));
    };

    const handleError = (e) => {
      const id = ++errorIdRef.current;
      const stack = e.error?.stack || "";
      addError(id, "error", e.message || String(e.error || "Unknown error"), stack);
    };

    const handleRejection = (e) => {
      const id = ++errorIdRef.current;
      const reason = e.reason;
      const stack = reason?.stack || "";
      addError(id, "rejection", reason?.message || String(reason) || "Unhandled Promise Rejection", stack);
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    // Global test helpers
    window.__nexusTestError = (msg = "Test error from ErrorFixerAI") => { throw new Error(msg); };
    window.__nexusTriggerRejection = () => Promise.reject(new Error("Test unhandled rejection"));

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  const clearErrors = useCallback(() => setErrors([]), []);

  // ── Deep Scan State & Actions ─────────────────────────────────────
  const [isScanning, setIsScanning] = useState(false);
  const [scanResults, setScanResults] = useState(null);
  const [scanError, setScanError] = useState(null);
  const [scanProgress, setScanProgress] = useState({ status: "idle", message: "" });

  const applyScanFix = useCallback(async (issue) => {
    if (!issue?.file_path || !issue?.original_snippet || !issue?.fixed_snippet) return null;
    try {
      const res = await fetch(`${API}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_path: issue.file_path,
          original_snippet: issue.original_snippet,
          fixed_snippet: issue.fixed_snippet,
        }),
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(`Apply failed: ${res.status} — ${detail}`);
      }
      const result = await res.json();
      setScanResults((prev) => {
        if (!prev) return prev;
        const updatedIssues = prev.issues.map((i) =>
          i.id === issue.id ? { ...i, fixed: true, applyResult: result } : i
        );
        return { ...prev, issues: updatedIssues };
      });
      return result;
    } catch (ex) {
      setScanResults((prev) => {
        if (!prev) return prev;
        const updatedIssues = prev.issues.map((i) =>
          i.id === issue.id ? { ...i, applyError: ex.message } : i
        );
        return { ...prev, issues: updatedIssues };
      });
      return null;
    }
  }, []);

  const applyAllScanFixes = useCallback(async (issuesToFix) => {
    if (!issuesToFix || issuesToFix.length === 0) return null;
    try {
      const fixes = issuesToFix.map((i) => ({
        file_path: i.file_path,
        original_snippet: i.original_snippet,
        fixed_snippet: i.fixed_snippet,
      }));
      const res = await fetch(`${API}/scan/apply-all`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fixes }),
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(`Bulk apply failed: ${res.status} — ${detail}`);
      }
      const data = await res.json();
      const successResults = data.results?.filter((r) => r.success) || [];
      const successfulPaths = new Set(successResults.map((r) => r.file));

      setScanResults((prev) => {
        if (!prev) return prev;
        const updatedIssues = prev.issues.map((i) => {
          if (successfulPaths.has(i.file_path)) {
            return { ...i, fixed: true };
          }
          return i;
        });
        return { ...prev, issues: updatedIssues };
      });
      return data;
    } catch (ex) {
      setScanError(ex.message);
      return null;
    }
  }, []);

  const scanProject = useCallback(async (options = {}) => {
    setIsScanning(true);
    setScanError(null);
    setScanProgress({ status: "scanning", message: "Walking project source files & analyzing with parallel LLM agents..." });
    try {
      const res = await fetch(`${API}/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_paths: options.targetPaths || [],
          max_files: options.maxFiles || 40,
          severity_filter: options.severityFilter || "all",
        }),
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(`Scan request failed: ${res.status} — ${detail}`);
      }
      const data = await res.json();
      setScanResults(data);

      // Auto-fix scan issues if Auto-Fix Error is enabled
      if ((autoFixErrorRef.current || autoApplyRef.current) && data?.issues?.length) {
        const fixable = data.issues.filter(
          (i) => !i.fixed && i.file_path && i.original_snippet && i.fixed_snippet
        );
        if (fixable.length > 0) {
          setScanProgress({ status: "autofixing", message: `Auto-fixing ${fixable.length} detected scan issues...` });
          await applyAllScanFixes(fixable);
        }
      }
      return data;
    } catch (ex) {
      setScanError(ex.message);
      return null;
    } finally {
      setIsScanning(false);
      setScanProgress({ status: "idle", message: "" });
    }
  }, [applyAllScanFixes]);

  // Periodic Auto-Scan Background Worker
  useEffect(() => {
    if (!autoScanEnabled) return;
    scanProject({ maxFiles: 40, severityFilter: "all" });

    const interval = setInterval(() => {
      if (autoScanRef.current) {
        scanProject({ maxFiles: 40, severityFilter: "all" });
      }
    }, 120000); // 2-minute periodic sweep

    return () => clearInterval(interval);
  }, [autoScanEnabled, scanProject]);

  // ── Urban AI Telemetry Integration ────────────────────────────────
  const [urbanTelemetry, setUrbanTelemetry] = useState(null);

  const fetchUrbanTelemetry = useCallback(async () => {
    try {
      const res = await fetch(`${API}/urban-telemetry`);
      if (res.ok) {
        const data = await res.json();
        setUrbanTelemetry(data);
        return data;
      }
    } catch { /* non-fatal */ }
    return null;
  }, []);

  useEffect(() => {
    fetchUrbanTelemetry();
    const interval = setInterval(fetchUrbanTelemetry, 30000);
    return () => clearInterval(interval);
  }, [fetchUrbanTelemetry]);

  const clearScanResults = useCallback(() => {
    setScanResults(null);
    setScanError(null);
  }, []);

  const value = {
    errors,
    clearErrors,
    analyzeError,
    applyFix,
    learnPattern,
    isDrawerOpen,
    setIsDrawerOpen,
    autoLearnEnabled,
    setAutoLearnEnabled,
    autoApplyEnabled,
    setAutoApplyEnabled,
    autoScanEnabled,
    setAutoScanEnabled,
    autoFixErrorEnabled,
    setAutoFixErrorEnabled,
    newErrorCount: errors.filter((e) => e.status === "new").length,
    // Deep scan additions
    isScanning,
    scanResults,
    scanError,
    scanProgress,
    scanProject,
    applyScanFix,
    applyAllScanFixes,
    clearScanResults,
    // Urban AI integration
    urbanTelemetry,
    fetchUrbanTelemetry,
  };

  return (
    <ErrorFixerContext.Provider value={value}>
      {children}
    </ErrorFixerContext.Provider>
  );
}

export function useErrorFixer() {
  const ctx = useContext(ErrorFixerContext);
  if (!ctx) throw new Error("useErrorFixer must be used inside <ErrorFixerProvider>");
  return ctx;
}
