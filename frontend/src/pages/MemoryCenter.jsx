import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import { http } from "../lib/api";
import { toast } from "../components/Toast";
import { Brain, Plus, Trash2, Search, Star, Edit2, Check, X, Tag } from "lucide-react";
import { useSecurity } from "../lib/SecurityContext";

const CATEGORIES = ["general", "code", "research", "project", "people", "system"];
const CAT_COLORS = { general: "#00F5FF", code: "#00FF88", research: "#6E56FF", project: "#FFC857", people: "#FF2E88", system: "#FF4D4D" };

function MemCard({ item, onDelete, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: item.title, content: item.content });
  const color = CAT_COLORS[item.category] || "#00F5FF";

  const save = () => {
    onUpdate(item.id, draft);
    setEditing(false);
    toast.success("Memory updated");
  };

  const cancel = () => { setDraft({ title: item.title, content: item.content }); setEditing(false); };

  return (
    <div className="nx-glass nx-fadein" style={{ borderRadius: 12, padding: "14px 16px", borderColor: `${color}22`, transition: "all 0.2s", position: "relative" }}
      onMouseEnter={e => e.currentTarget.style.borderColor = `${color}44`}
      onMouseLeave={e => e.currentTarget.style.borderColor = `${color}22`}
    >
      {/* Top row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10, color, background: `${color}14`, padding: "2px 7px", borderRadius: 4, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.1em" }}>{item.category}</span>
          <div style={{ display: "flex", gap: 2 }}>
            {[...Array(5)].map((_, i) => <Star key={i} style={{ width: 9, height: 9, color: i < (item.importance || 3) ? "#FFC857" : "rgba(255,255,255,0.15)", fill: i < (item.importance || 3) ? "#FFC857" : "none" }} />)}
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {editing ? (
            <>
              <button onClick={save} style={{ background: "none", border: "none", cursor: "pointer", color: "#00FF88", padding: 2 }}><Check style={{ width: 12, height: 12 }} /></button>
              <button onClick={cancel} style={{ background: "none", border: "none", cursor: "pointer", color: "#FF4D4D", padding: 2 }}><X style={{ width: 12, height: 12 }} /></button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(148,163,184,0.4)", padding: 2 }} title="Edit"><Edit2 style={{ width: 12, height: 12 }} /></button>
              <button onClick={() => onDelete(item.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(148,163,184,0.4)", padding: 2 }} title="Delete"><Trash2 style={{ width: 12, height: 12 }} /></button>
            </>
          )}
        </div>
      </div>

      {/* Title */}
      {editing ? (
        <input value={draft.title} onChange={e => setDraft(p => ({ ...p, title: e.target.value }))}
          style={{ width: "100%", background: "rgba(15,23,42,0.8)", border: `1px solid ${color}44`, borderRadius: 6, color: "#e2e8f0", padding: "5px 8px", fontSize: 13, fontFamily: "monospace", outline: "none", marginBottom: 6 }}
        />
      ) : (
        <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", marginBottom: 4, fontFamily: "'Space Grotesk',sans-serif" }}>{item.title}</div>
      )}

      {/* Content */}
      {editing ? (
        <textarea value={draft.content} onChange={e => setDraft(p => ({ ...p, content: e.target.value }))} rows={3}
          style={{ width: "100%", background: "rgba(15,23,42,0.8)", border: `1px solid ${color}44`, borderRadius: 6, color: "#e2e8f0", padding: "5px 8px", fontSize: 12, fontFamily: "monospace", outline: "none", resize: "vertical" }}
        />
      ) : (
        <p style={{ fontSize: 12, color: "rgba(148,163,184,0.7)", lineHeight: 1.55, fontFamily: "monospace" }}>
          {item.content.slice(0, 160)}{item.content.length > 160 ? "…" : ""}
        </p>
      )}

      {/* Tags */}
      {item.tags?.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
          {item.tags.map(t => (
            <span key={t} style={{ fontSize: 10, color, background: `${color}12`, padding: "1px 7px", borderRadius: 4, fontFamily: "monospace", cursor: "pointer" }}>#{t}</span>
          ))}
        </div>
      )}
      <div style={{ marginTop: 6, fontSize: 10, color: "rgba(148,163,184,0.35)", fontFamily: "monospace" }}>
        {new Date(item.timestamp).toLocaleString()}
      </div>
    </div>
  );
}

export default function MemoryCenter() {
  const { verifyAction } = useSecurity();
  const loc = useLocation();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", category: "general", tags: "", importance: 3 });

  const allTags = [...new Set(items.flatMap(i => i.tags || []))];

  const load = useCallback(async () => {
    try {
      const params = {};
      if (q) params.q = q;
      if (cat) params.category = cat;
      const r = await http.get("/memory", { params });
      setItems(r.data);
    } catch {}
  }, [q, cat]);

  useEffect(() => { load(); }, [load]);

  // ?new=1 URL param
  useEffect(() => { if (loc.search.includes("new=1")) setAdding(true); }, []);

  // Keyboard: N to add
  useEffect(() => {
    const h = (e) => {
      if (e.key === "n" && !e.ctrlKey && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
        e.preventDefault(); setAdding(true);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const save = async () => {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    try {
      await http.post("/memory", { ...form, tags: form.tags.split(",").map(t => t.trim()).filter(Boolean), importance: Number(form.importance) });
      setAdding(false);
      setForm({ title: "", content: "", category: "general", tags: "", importance: 3 });
      load();
      toast.success("Memory saved!");
    } catch { toast.error("Failed to save memory"); }
  };

  const del = async (id) => {
    verifyAction(async () => {
      try {
        await http.delete(`/memory/${id}`);
        setItems(prev => prev.filter(i => i.id !== id));
        toast.success("Memory deleted");
      } catch { toast.error("Delete failed"); }
    }, "database");
  };

  const update = async (id, patch) => {
    try {
      // Local optimistic update
      setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));
    } catch {}
  };

  const filtered = tagFilter ? items.filter(i => i.tags?.includes(tagFilter)) : items;

  const inputStyle = { width: "100%", background: "rgba(15,23,42,0.8)", border: "1px solid rgba(0,245,255,0.2)", borderRadius: 7, color: "#e2e8f0", padding: "8px 12px", fontSize: 12, fontFamily: "monospace", outline: "none" };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div className="hud-label" style={{ marginBottom: 4 }}>MEMORY VAULT</div>
          <h1 className="font-display nx-neon-cyan" style={{ fontSize: 26, fontWeight: 800 }}>Memory Center</h1>
          <p style={{ marginTop: 3, fontSize: 11, color: "rgba(148,163,184,0.5)", fontFamily: "monospace" }}>{filtered.length} memories · Press <kbd style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 3, padding: "1px 4px" }}>N</kbd> to add</p>
        </div>
        <button
          onClick={() => setAdding(p => !p)}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, background: adding ? "rgba(255,77,77,0.1)" : "rgba(0,245,255,0.12)", border: `1px solid ${adding ? "rgba(255,77,77,0.3)" : "rgba(0,245,255,0.3)"}`, color: adding ? "#FF4D4D" : "#00F5FF", cursor: "pointer", fontSize: 12, fontFamily: "monospace" }}
        >
          {adding ? <><X style={{ width: 13, height: 13 }} /> Cancel</> : <><Plus style={{ width: 13, height: 13 }} /> New Memory</>}
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 160 }}>
          <Search style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 12, height: 12, color: "rgba(148,163,184,0.5)" }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search memories…" style={{ ...inputStyle, paddingLeft: 28 }} />
        </div>
        <select value={cat} onChange={e => setCat(e.target.value)} style={{ ...inputStyle, width: "auto", minWidth: 130 }}>
          <option value="">All categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Tag pills */}
      {allTags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 16 }}>
          <span style={{ fontSize: 10, color: "rgba(148,163,184,0.4)", fontFamily: "monospace", alignSelf: "center" }}>Tags:</span>
          {allTags.map(t => (
            <button key={t} onClick={() => setTagFilter(tagFilter === t ? "" : t)}
              style={{ fontSize: 10, color: tagFilter === t ? "#00F5FF" : "rgba(148,163,184,0.6)", background: tagFilter === t ? "rgba(0,245,255,0.14)" : "rgba(255,255,255,0.05)", border: `1px solid ${tagFilter === t ? "rgba(0,245,255,0.35)" : "rgba(255,255,255,0.1)"}`, padding: "2px 9px", borderRadius: 20, cursor: "pointer", fontFamily: "monospace", transition: "all 0.14s" }}
            >#{t}</button>
          ))}
          {tagFilter && <button onClick={() => setTagFilter("")} style={{ fontSize: 10, color: "#FF4D4D", background: "none", border: "none", cursor: "pointer", fontFamily: "monospace" }}>✕ clear</button>}
        </div>
      )}

      {/* Add form */}
      {adding && (
        <div className="nx-glass nx-fadein" style={{ borderRadius: 12, padding: "16px 20px", marginBottom: 18 }}>
          <div className="hud-label" style={{ marginBottom: 12 }}>NEW MEMORY</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Title *" style={inputStyle} autoFocus />
            <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} style={inputStyle}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} placeholder="Content…" rows={3} style={{ ...inputStyle, resize: "vertical", marginBottom: 10 }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, marginBottom: 12, alignItems: "center" }}>
            <input value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} placeholder="Tags (comma-separated)" style={inputStyle} />
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, color: "rgba(148,163,184,0.5)", fontFamily: "monospace", whiteSpace: "nowrap" }}>Importance:</span>
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => setForm(p => ({ ...p, importance: n }))}
                  style={{ background: "none", border: "none", cursor: "pointer", color: n <= form.importance ? "#FFC857" : "rgba(255,255,255,0.2)", padding: 0, fontSize: 17, lineHeight: 1, transition: "color 0.1s" }}
                >★</button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={save} style={{ padding: "7px 20px", borderRadius: 7, background: "rgba(0,245,255,0.15)", border: "1px solid rgba(0,245,255,0.35)", color: "#00F5FF", cursor: "pointer", fontSize: 12, fontFamily: "monospace" }}>Save Memory</button>
            <button onClick={() => setAdding(false)} style={{ padding: "7px 14px", borderRadius: 7, background: "none", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(148,163,184,0.6)", cursor: "pointer", fontSize: 12, fontFamily: "monospace" }}>Cancel</button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "rgba(148,163,184,0.3)" }}>
          <Brain style={{ width: 40, height: 40, margin: "0 auto 12px", opacity: 0.3 }} />
          <div style={{ fontSize: 13, fontFamily: "monospace" }}>{q || tagFilter ? "No memories match your filter" : "No memories yet. Press N or click + to add."}</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
          {filtered.map(item => <MemCard key={item.id} item={item} onDelete={del} onUpdate={update} />)}
        </div>
      )}
    </div>
  );
}
