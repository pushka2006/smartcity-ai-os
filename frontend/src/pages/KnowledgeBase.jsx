import { useState, useEffect, useCallback, useRef } from "react";
import { http } from "../lib/api";
import { toast } from "../components/Toast";
import { Library, Upload, Trash2, Search, FileText, Loader, Eye, Copy, X } from "lucide-react";
import ReactMarkdown from "react-markdown";

export default function KnowledgeBase() {
  const [files, setFiles] = useState([]);
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState([]);
  const [querying, setQuerying] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null); // file being previewed
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef();

  const loadFiles = useCallback(async () => {
    try { const r = await http.get("/kb"); setFiles(r.data); } catch {}
  }, []);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const doUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await http.post("/kb/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      loadFiles();
      toast.success(`"${file.name}" uploaded & indexed`);
    } catch { toast.error("Upload failed"); }
    setUploading(false);
  };

  const onFileChange = (e) => { doUpload(e.target.files?.[0]); e.target.value = ""; };

  const onDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) doUpload(file);
  };

  const del = async (id, name) => {
    try {
      await http.delete(`/kb/${id}`);
      setFiles(prev => prev.filter(f => f.id !== id));
      if (preview?.id === id) setPreview(null);
      toast.success(`"${name}" removed`);
    } catch { toast.error("Delete failed"); }
  };

  const previewFile = async (file) => {
    try {
      // Fetch full file with content
      const r = await http.get(`/kb`); // Get all files
      const full = r.data.find(f => f.id === file.id) || file;
      // Actually need content — fetch from a different endpoint or use what we have
      setPreview(full);
    } catch {}
  };

  const askKB = async () => {
    if (!query.trim()) return;
    setQuerying(true); setAnswer(""); setSources([]);
    try {
      const r = await http.post("/kb/query", { query, top_k: 4 });
      setAnswer(r.data.answer);
      setSources(r.data.sources || []);
    } catch { setAnswer("Error querying knowledge base."); toast.error("Query failed"); }
    setQuerying(false);
  };

  const inputStyle = { background: "rgba(15,23,42,0.8)", border: "1px solid rgba(0,245,255,0.2)", borderRadius: 7, color: "#e2e8f0", padding: "8px 12px", fontSize: 12, fontFamily: "monospace", outline: "none" };
  const fmtSize = b => b < 1024 ? `${b}B` : b < 1048576 ? `${(b/1024).toFixed(1)}KB` : `${(b/1048576).toFixed(1)}MB`;

  const SUGGESTIONS = ["What topics are covered?", "Summarize the main points", "What are the key findings?", "List all mentioned technologies"];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div className="hud-label" style={{ marginBottom: 4 }}>KNOWLEDGE BASE</div>
          <h1 className="font-display nx-neon-cyan" style={{ fontSize: 26, fontWeight: 800 }}>RAG Knowledge Store</h1>
          <p style={{ marginTop: 3, fontSize: 11, color: "rgba(148,163,184,0.5)", fontFamily: "monospace" }}>{files.length} documents indexed</p>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, background: "rgba(0,245,255,0.12)", border: "1px solid rgba(0,245,255,0.3)", color: "#00F5FF", cursor: "pointer", fontSize: 12, fontFamily: "monospace" }}>
          {uploading ? <Loader style={{ width: 13, height: 13, animation: "nx-spin-slow 1s linear infinite" }} /> : <Upload style={{ width: 13, height: 13 }} />}
          Upload File
          <input ref={fileInputRef} type="file" onChange={onFileChange} style={{ display: "none" }} accept=".txt,.md,.py,.js,.ts,.json,.csv,.html,.xml,.yaml" />
        </label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        {/* Files + drag-drop */}
        <div className="nx-glass" style={{ borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column" }}>
          <div className="hud-label" style={{ marginBottom: 12 }}>INDEXED FILES</div>

          {/* Drag-drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? "#00F5FF" : "rgba(0,245,255,0.18)"}`,
              borderRadius: 10, padding: "16px", textAlign: "center", cursor: "pointer",
              background: dragOver ? "rgba(0,245,255,0.06)" : "transparent",
              transition: "all 0.2s", marginBottom: 12,
            }}
          >
            <Upload style={{ width: 20, height: 20, color: dragOver ? "#00F5FF" : "rgba(148,163,184,0.35)", margin: "0 auto 6px" }} />
            <div style={{ fontSize: 11, color: dragOver ? "#00F5FF" : "rgba(148,163,184,0.45)", fontFamily: "monospace" }}>
              {dragOver ? "Drop to upload" : "Drag & drop or click to upload"}
            </div>
            <div style={{ fontSize: 10, color: "rgba(148,163,184,0.3)", fontFamily: "monospace", marginTop: 3 }}>txt, md, py, js, json, csv, html…</div>
          </div>

          {files.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 0", color: "rgba(148,163,184,0.3)" }}>
              <Library style={{ width: 28, height: 28, margin: "0 auto 8px", opacity: 0.3 }} />
              <div style={{ fontSize: 11, fontFamily: "monospace" }}>No files yet</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, overflowY: "auto" }}>
              {files.map(f => (
                <div
                  key={f.id}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, background: preview?.id === f.id ? "rgba(0,245,255,0.08)" : "rgba(15,23,42,0.5)", border: `1px solid ${preview?.id === f.id ? "rgba(0,245,255,0.3)" : "rgba(255,255,255,0.07)"}`, cursor: "pointer", transition: "all 0.15s" }}
                  onClick={() => previewFile(f)}
                >
                  <FileText style={{ width: 13, height: 13, color: "#00F5FF", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11.5, color: "#e2e8f0", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</div>
                    <div style={{ fontSize: 10, color: "rgba(148,163,184,0.4)", fontFamily: "monospace" }}>{fmtSize(f.size)}</div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); del(f.id, f.name); }} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(148,163,184,0.35)", flexShrink: 0, display: "flex" }}>
                    <Trash2 style={{ width: 12, height: 12 }} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Query + preview pane */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Query */}
          <div className="nx-glass" style={{ borderRadius: 12, padding: "14px 16px" }}>
            <div className="hud-label" style={{ marginBottom: 10 }}>ASK YOUR KNOWLEDGE BASE</div>
            <div style={{ display: "flex", gap: 7, marginBottom: 10 }}>
              <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === "Enter") askKB(); }} placeholder="Ask a question…" style={{ ...inputStyle, flex: 1 }} />
              <button onClick={askKB} disabled={querying || !query.trim()} style={{ padding: "8px 12px", borderRadius: 7, background: "rgba(0,245,255,0.12)", border: "1px solid rgba(0,245,255,0.3)", color: "#00F5FF", cursor: "pointer", opacity: querying || !query.trim() ? 0.5 : 1 }}>
                {querying ? <Loader style={{ width: 14, height: 14, animation: "nx-spin-slow 1s linear infinite" }} /> : <Search style={{ width: 14, height: 14 }} />}
              </button>
            </div>
            {/* Suggestions */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => { setQuery(s); }}
                  style={{ fontSize: 10, color: "rgba(148,163,184,0.6)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "2px 8px", cursor: "pointer", fontFamily: "monospace", transition: "all 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.color = "#00F5FF"; e.currentTarget.style.borderColor = "rgba(0,245,255,0.3)"; }}
                  onMouseLeave={e => { e.currentTarget.style.color = "rgba(148,163,184,0.6)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
                >{s}</button>
              ))}
            </div>

            {sources.length > 0 && (
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 10 }}>
                {sources.map(s => <span key={s.id} style={{ fontSize: 10, color: "#00F5FF", background: "rgba(0,245,255,0.1)", padding: "2px 8px", borderRadius: 4, fontFamily: "monospace" }}>{s.name}</span>)}
              </div>
            )}

            {answer && (
              <div style={{ marginTop: 12, position: "relative" }}>
                <button onClick={() => { navigator.clipboard.writeText(answer); toast.success("Answer copied"); }} style={{ position: "absolute", top: -2, right: 0, background: "rgba(15,23,42,0.8)", border: "1px solid rgba(0,245,255,0.2)", borderRadius: 5, color: "#00F5FF", cursor: "pointer", padding: "2px 7px", fontSize: 10, fontFamily: "monospace" }}>copy</button>
                <div className="nx-md" style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.65, maxHeight: 220, overflowY: "auto", paddingRight: 4 }}>
                  <ReactMarkdown>{answer}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>

          {/* File preview */}
          {preview && (
            <div className="nx-glass nx-fadein" style={{ borderRadius: 12, padding: "14px 16px", flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <Eye style={{ width: 13, height: 13, color: "#00F5FF" }} />
                  <span className="hud-label">PREVIEW</span>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <span style={{ fontSize: 11, color: "#00F5FF", fontFamily: "monospace" }}>{preview.name}</span>
                  <button onClick={() => setPreview(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(148,163,184,0.5)", display: "flex" }}><X style={{ width: 13, height: 13 }} /></button>
                </div>
              </div>
              <pre style={{ fontSize: 11, color: "rgba(148,163,184,0.8)", lineHeight: 1.6, overflow: "auto", maxHeight: 200, fontFamily: "monospace", whiteSpace: "pre-wrap", background: "rgba(2,6,23,0.5)", borderRadius: 8, padding: "10px 12px", margin: 0 }}>
                {preview.content || "(No content preview available — content is indexed but not stored inline)"}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
