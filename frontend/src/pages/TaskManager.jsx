import { useState, useCallback, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { http } from "../lib/api";
import { toast } from "../components/Toast";
import { Plus, Trash2, CheckCircle2, Circle, Clock, AlertTriangle, Edit2, Check, X, GripVertical } from "lucide-react";
import { useSecurity } from "../lib/SecurityContext";

const PRIORITIES = { low: "#6E56FF", medium: "#FFC857", high: "#FF2E88", critical: "#FF4D4D" };
const STATUSES   = ["pending", "running", "completed", "failed"];
const S_COLORS   = { pending: "#6E56FF", running: "#FFC857", completed: "#00FF88", failed: "#FF4D4D" };
const S_ICONS    = { pending: Circle, running: Clock, completed: CheckCircle2, failed: AlertTriangle };

function TaskCard({ task, onUpdate, onDelete, onDragStart }) {
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(task.title);
  const [progress, setProgress] = useState(task.progress || 0);
  const pColor = PRIORITIES[task.priority] || "#FFC857";

  const save = () => {
    onUpdate(task.id, { title: draftTitle, progress });
    setEditing(false);
    toast.success("Task updated");
  };

  return (
    <div
      draggable
      onDragStart={() => onDragStart(task)}
      className="nx-glass nx-fadein"
      style={{ borderRadius: 10, padding: "11px 13px", borderColor: `${pColor}22`, cursor: "grab", transition: "all 0.2s", userSelect: "none" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = `${pColor}44`; e.currentTarget.style.transform = "translateY(-1px)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = `${pColor}22`; e.currentTarget.style.transform = "none"; }}
    >
      {/* Priority + controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: pColor, flexShrink: 0 }} />
        <span style={{ fontSize: 9.5, color: pColor, background: `${pColor}15`, padding: "1px 6px", borderRadius: 4, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.08em" }}>{task.priority}</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 3 }}>
          {editing ? (
            <>
              <button onClick={save} style={{ background: "none", border: "none", cursor: "pointer", color: "#00FF88", padding: 2 }}><Check style={{ width: 11, height: 11 }} /></button>
              <button onClick={() => { setEditing(false); setDraftTitle(task.title); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#FF4D4D", padding: 2 }}><X style={{ width: 11, height: 11 }} /></button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(148,163,184,0.4)", padding: 2 }}><Edit2 style={{ width: 11, height: 11 }} /></button>
              <button onClick={() => onDelete(task.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(148,163,184,0.4)", padding: 2 }}><Trash2 style={{ width: 11, height: 11 }} /></button>
            </>
          )}
        </div>
      </div>

      {/* Title */}
      {editing ? (
        <input value={draftTitle} onChange={e => setDraftTitle(e.target.value)} onKeyDown={e => { if (e.key === "Enter") save(); }}
          style={{ width: "100%", background: "rgba(15,23,42,0.8)", border: `1px solid ${pColor}44`, borderRadius: 5, color: "#e2e8f0", padding: "4px 7px", fontSize: 12, fontFamily: "monospace", outline: "none", marginBottom: 8 }}
          autoFocus
        />
      ) : (
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "#e2e8f0", fontFamily: "'Space Grotesk',sans-serif", marginBottom: 6, lineHeight: 1.35 }}>{task.title}</div>
      )}

      {task.description && !editing && (
        <p style={{ fontSize: 11, color: "rgba(148,163,184,0.6)", fontFamily: "monospace", marginBottom: 7, lineHeight: 1.4 }}>{task.description.slice(0, 70)}{task.description.length > 70 ? "…" : ""}</p>
      )}

      {/* Progress bar — draggable */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
          <span style={{ fontSize: 9, color: "rgba(148,163,184,0.4)", fontFamily: "monospace" }}>PROGRESS</span>
          <span style={{ fontSize: 9.5, color: pColor, fontFamily: "monospace" }}>{progress}%</span>
        </div>
        <input type="range" min={0} max={100} value={progress}
          onChange={e => setProgress(Number(e.target.value))}
          onMouseUp={() => onUpdate(task.id, { progress })}
          style={{ width: "100%", accentColor: pColor, cursor: "pointer", height: 4 }}
        />
      </div>

      {/* Status move buttons */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {STATUSES.filter(s => s !== task.status).map(s => (
          <button key={s} onClick={() => onUpdate(task.id, { status: s })}
            style={{ fontSize: 9.5, padding: "2px 7px", borderRadius: 4, border: `1px solid rgba(255,255,255,0.1)`, background: "transparent", color: "rgba(148,163,184,0.55)", cursor: "pointer", fontFamily: "monospace", transition: "all 0.12s" }}
            onMouseEnter={e => { e.currentTarget.style.color = S_COLORS[s]; e.currentTarget.style.borderColor = `${S_COLORS[s]}44`; }}
            onMouseLeave={e => { e.currentTarget.style.color = "rgba(148,163,184,0.55)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
          >→ {s}</button>
        ))}
      </div>
    </div>
  );
}

export default function TaskManager() {
  const { verifyAction } = useSecurity();
  const loc = useLocation();
  const [tasks, setTasks] = useState([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", priority: "medium", agent: "planner" });
  const [dragging, setDragging] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  const load = useCallback(async () => {
    try { const r = await http.get("/tasks"); setTasks(r.data); } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  // ?new=1
  useEffect(() => { if (loc.search.includes("new=1")) setAdding(true); }, []);

  const save = async () => {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    try {
      await http.post("/tasks", form);
      setAdding(false);
      setForm({ title: "", description: "", priority: "medium", agent: "planner" });
      load();
      toast.success("Task created!");
    } catch { toast.error("Failed to create task"); }
  };

  const update = async (id, patch) => {
    try {
      await http.patch(`/tasks/${id}`, patch);
      setTasks(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
    } catch { toast.error("Update failed"); }
  };

  const del = async (id) => {
    verifyAction(async () => {
      try {
        await http.delete(`/tasks/${id}`);
        setTasks(prev => prev.filter(t => t.id !== id));
        toast.success("Task deleted");
      } catch { toast.error("Delete failed"); }
    }, "database");
  };

  // Drag-and-drop between columns
  const onDrop = async (targetStatus) => {
    if (!dragging || dragging.status === targetStatus) { setDragging(null); setDragOver(null); return; }
    await update(dragging.id, { status: targetStatus });
    toast.info(`Moved to ${targetStatus}`);
    setDragging(null);
    setDragOver(null);
  };

  const grouped = STATUSES.reduce((acc, s) => { acc[s] = tasks.filter(t => t.status === s); return acc; }, {});

  const inputStyle = { width: "100%", background: "rgba(15,23,42,0.8)", border: "1px solid rgba(0,245,255,0.2)", borderRadius: 7, color: "#e2e8f0", padding: "8px 12px", fontSize: 12, fontFamily: "monospace", outline: "none" };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div className="hud-label" style={{ marginBottom: 4 }}>TASK ORCHESTRATION</div>
          <h1 className="font-display nx-neon-cyan" style={{ fontSize: 26, fontWeight: 800 }}>Task Manager</h1>
          <p style={{ marginTop: 3, fontSize: 11, color: "rgba(148,163,184,0.5)", fontFamily: "monospace" }}>
            {tasks.length} tasks · drag cards to move between columns
          </p>
        </div>
        <button onClick={() => setAdding(p => !p)}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, background: adding ? "rgba(255,77,77,0.1)" : "rgba(0,245,255,0.12)", border: `1px solid ${adding ? "rgba(255,77,77,0.3)" : "rgba(0,245,255,0.3)"}`, color: adding ? "#FF4D4D" : "#00F5FF", cursor: "pointer", fontSize: 12, fontFamily: "monospace" }}
        >
          {adding ? <><X style={{ width: 13, height: 13 }} /> Cancel</> : <><Plus style={{ width: 13, height: 13 }} /> New Task</>}
        </button>
      </div>

      {adding && (
        <div className="nx-glass nx-fadein" style={{ borderRadius: 12, padding: "16px 20px", marginBottom: 18 }}>
          <div className="hud-label" style={{ marginBottom: 10 }}>NEW TASK</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} onKeyDown={e => { if (e.key === "Enter") save(); }} placeholder="Task title *" style={inputStyle} autoFocus />
            <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))} style={inputStyle}>
              {Object.keys(PRIORITIES).map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Description (optional)" rows={2} style={{ ...inputStyle, resize: "vertical", marginBottom: 10 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={save} style={{ padding: "7px 20px", borderRadius: 7, background: "rgba(0,245,255,0.15)", border: "1px solid rgba(0,245,255,0.35)", color: "#00F5FF", cursor: "pointer", fontSize: 12, fontFamily: "monospace" }}>Create Task</button>
            <button onClick={() => setAdding(false)} style={{ padding: "7px 14px", borderRadius: 7, background: "none", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(148,163,184,0.6)", cursor: "pointer", fontSize: 12, fontFamily: "monospace" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Kanban board */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        {STATUSES.map(status => {
          const Icon = S_ICONS[status];
          const color = S_COLORS[status];
          const isOver = dragOver === status;
          return (
            <div
              key={status}
              onDragOver={e => { e.preventDefault(); setDragOver(status); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => onDrop(status)}
              style={{ transition: "all 0.18s" }}
            >
              {/* Column header */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, padding: "6px 8px", borderRadius: 8, background: isOver ? `${color}12` : "transparent", border: `1px solid ${isOver ? `${color}44` : "transparent"}`, transition: "all 0.15s" }}>
                <Icon style={{ width: 12, height: 12, color }} />
                <span style={{ fontFamily: "monospace", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", color, fontWeight: 600 }}>{status}</span>
                <span style={{ marginLeft: "auto", fontSize: 10, color: "rgba(148,163,184,0.5)", fontFamily: "monospace", background: "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: 4 }}>{grouped[status].length}</span>
              </div>

              {/* Cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 80, borderRadius: 10, padding: isOver ? "6px" : "0", border: `2px dashed ${isOver ? `${color}55` : "transparent"}`, transition: "all 0.15s", background: isOver ? `${color}06` : "transparent" }}>
                {grouped[status].map(t => (
                  <TaskCard key={t.id} task={t} onUpdate={update} onDelete={del} onDragStart={setDragging} />
                ))}
                {grouped[status].length === 0 && (
                  <div style={{ padding: "16px 0", textAlign: "center", color: "rgba(148,163,184,0.22)", fontSize: 11, fontFamily: "monospace", borderRadius: 9 }}>
                    {isOver ? "Drop here" : "empty"}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
