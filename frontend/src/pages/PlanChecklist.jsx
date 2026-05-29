import { CheckCircle2, ChevronRight, Circle, Play, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import api from "../api";

const PHASE_COLORS = {
  "Days 1–14":  { bg: "bg-blue-50",    border: "border-blue-200",   text: "text-blue-700",   dot: "bg-blue-500"   },
  "Days 15–30": { bg: "bg-violet-50",  border: "border-violet-200", text: "text-violet-700", dot: "bg-violet-500" },
  "Days 31–60": { bg: "bg-amber-50",   border: "border-amber-200",  text: "text-amber-700",  dot: "bg-amber-500"  },
  "Days 61–90": { bg: "bg-emerald-50", border: "border-emerald-200",text: "text-emerald-700",dot: "bg-emerald-500"},
};

function formatDate(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch { return null; }
}

function PhaseCard({ phase, items, onToggle }) {
  const colors = PHASE_COLORS[phase] || PHASE_COLORS["Days 1–14"];
  const done  = items.filter(i => i.completed).length;
  const total = items.length;
  const pct   = total > 0 ? (done / total) * 100 : 0;

  return (
    <div className={`rounded-2xl border ${colors.border} ${colors.bg} overflow-hidden`}>
      <div className={`px-5 py-4 border-b ${colors.border}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
            <h3 className={`font-semibold text-sm ${colors.text}`}>{phase}</h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">{done}/{total}</span>
            <div className="w-20 h-1.5 bg-white/60 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${colors.dot} transition-all`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
      </div>
      <ul className="divide-y divide-white/40">
        {items.map(item => (
          <li
            key={item.item_id}
            className="flex items-start gap-3 px-5 py-3 hover:bg-white/30 transition-colors cursor-pointer"
            onClick={() => onToggle(item.item_id, !item.completed)}
          >
            <div className="mt-0.5 flex-shrink-0">
              {item.completed
                ? <CheckCircle2 size={16} className="text-emerald-500" />
                : <Circle size={16} className="text-slate-300" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm leading-snug ${item.completed ? "line-through text-slate-400" : "text-slate-700"}`}>
                {item.text}
              </p>
              {item.note && (
                <p className="text-xs text-slate-400 mt-0.5">{item.note}</p>
              )}
              {item.completed && item.completed_at && (
                <p className="text-xs text-emerald-500 mt-0.5">
                  ✓ Done {formatDate(item.completed_at)}
                </p>
              )}
            </div>
            {item.link && (
              <a
                href={item.link}
                className="flex-shrink-0 text-slate-300 hover:text-violet-500 transition-colors"
                onClick={e => e.stopPropagation()}
              >
                <ChevronRight size={14} />
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function PlanChecklist() {
  const [items,     setItems]     = useState([]);
  const [meta,      setMeta]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [resetting, setResetting] = useState(false);
  const [starting,  setStarting]  = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [checkRes, metaRes] = await Promise.all([
        api.get("/api/v1/plan/checklist"),
        api.get("/api/v1/plan/meta"),
      ]);
      setItems(Array.isArray(checkRes.data) ? checkRes.data : []);
      setMeta(metaRes.data);
    } catch { setItems([]); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleToggle = async (id, completed) => {
    // Optimistic update
    setItems(prev => prev.map(i =>
      i.item_id === id
        ? { ...i, completed, completed_at: completed ? new Date().toISOString() : null }
        : i
    ));
    try {
      const { data } = await api.patch(`/api/v1/plan/checklist/${id}`, { completed });
      // Sync completed_at from server response
      setItems(prev => prev.map(i =>
        i.item_id === id ? { ...i, completed_at: data.completed_at } : i
      ));
      // Refresh meta so day counter updates if this was the first completion
      if (completed && !meta?.started_at) {
        const { data: newMeta } = await api.get("/api/v1/plan/meta");
        setMeta(newMeta);
      }
    } catch {
      // Rollback
      setItems(prev => prev.map(i => i.item_id === id ? { ...i, completed: !completed, completed_at: null } : i));
    }
  };

  const handleStart = async () => {
    setStarting(true);
    try {
      await api.post("/api/v1/plan/start", {});
      const { data } = await api.get("/api/v1/plan/meta");
      setMeta(data);
    } catch {} finally { setStarting(false); }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      await api.post("/api/v1/plan/checklist/reset");
      await load();
    } catch {} finally { setResetting(false); }
  };

  // Group by phase
  const phases = {};
  for (const item of items) {
    if (!phases[item.phase]) phases[item.phase] = [];
    phases[item.phase].push(item);
  }

  const totalDone = items.filter(i => i.completed).length;
  const total     = items.length;
  const overallPct = total > 0 ? (totalDone / total) * 100 : 0;

  const currentDay     = meta?.current_day ?? null;
  const daysRemaining  = meta?.days_remaining ?? null;
  const onTrack        = meta?.on_track;
  const startedAt      = meta?.started_at ? formatDate(meta.started_at) : null;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">90-Day Launch Plan</h1>
          <p className="text-slate-500 text-sm mt-1">
            Buffer's research-backed plan for taking SDL from 0 to 2,000 followers in 90 days.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!meta?.started_at && (
            <button
              onClick={handleStart}
              disabled={starting}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50"
            >
              <Play size={11} className="fill-white" />
              {starting ? "Starting…" : "Start clock"}
            </button>
          )}
          <button
            onClick={handleReset}
            disabled={resetting}
            className="flex items-center gap-1.5 px-3 py-2 text-xs text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={resetting ? "animate-spin" : ""} />
            Reset
          </button>
        </div>
      </div>

      {/* Progress + Day counter */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
        <div className="flex items-start justify-between mb-3 gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-slate-700">Overall progress</p>
              <p className="text-sm font-bold text-slate-900">{totalDone} / {total} tasks</p>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-500 transition-all duration-500"
                style={{ width: `${overallPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-slate-400">{overallPct.toFixed(0)}% complete</span>
              {overallPct >= 100 && (
                <span className="text-xs text-emerald-600 font-semibold">🎉 90-day plan complete!</span>
              )}
            </div>
          </div>

          {/* Day counter */}
          {currentDay !== null ? (
            <div className="flex-shrink-0 text-center bg-slate-50 rounded-xl px-5 py-3 border border-slate-100">
              <p className="text-3xl font-bold text-slate-900 leading-none">{currentDay}</p>
              <p className="text-xs text-slate-400 mt-0.5">of 90 days</p>
              {daysRemaining !== null && daysRemaining > 0 && (
                <p className="text-xs text-violet-600 font-medium mt-1">{daysRemaining}d left</p>
              )}
              {onTrack !== null && (
                <span className={`inline-block mt-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${onTrack ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                  {onTrack ? "On track" : "Behind pace"}
                </span>
              )}
              {startedAt && (
                <p className="text-[10px] text-slate-400 mt-1">Started {startedAt}</p>
              )}
            </div>
          ) : (
            <div className="flex-shrink-0 text-center bg-slate-50 rounded-xl px-5 py-3 border border-dashed border-slate-200">
              <p className="text-2xl font-bold text-slate-300">—</p>
              <p className="text-xs text-slate-400 mt-0.5">clock not started</p>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-slate-400 text-sm">Loading plan…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {Object.entries(phases).map(([phase, phaseItems]) => (
            <PhaseCard key={phase} phase={phase} items={phaseItems} onToggle={handleToggle} />
          ))}
        </div>
      )}
    </div>
  );
}
