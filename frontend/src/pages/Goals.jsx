import { CheckCircle2, Plus, Target, Trash2, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import api from "../api";

const METRIC_OPTIONS = [
  { value: "followers", label: "Followers", unit: "", description: "Total followers on a platform" },
  { value: "engagement_rate", label: "Engagement Rate", unit: "%", description: "Avg (likes+comments+shares)/impressions" },
  { value: "posts_per_week", label: "Posts per Week", unit: "/wk", description: "Posting frequency" },
  { value: "trial_signups", label: "Trial Signups", unit: "/mo", description: "Monthly signups attributed to social" },
  { value: "website_sessions", label: "Website Sessions", unit: "/mo", description: "Sessions from social media" },
];

const PLATFORM_OPTIONS = [
  { value: "linkedin", label: "LinkedIn", color: "#0A66C2" },
  { value: "twitter", label: "X (Twitter)", color: "#000" },
  { value: "instagram", label: "Instagram", color: "#E1306C" },
  { value: "facebook", label: "Facebook", color: "#1877F2" },
  { value: "tiktok", label: "TikTok", color: "#000000" },
  { value: "youtube", label: "YouTube", color: "#FF0000" },
  { value: "all", label: "All Platforms", color: "#8b5cf6" },
];

const SUGGESTED_GOALS = [
  { metric: "followers", platform: "linkedin", start: 0, target: 2000, deadline_days: 90, label: "LinkedIn: 0 → 2,000 in 90 days" },
  { metric: "followers", platform: "twitter", start: 0, target: 1000, deadline_days: 90, label: "Twitter: 0 → 1,000 in 90 days" },
  { metric: "engagement_rate", platform: "linkedin", start: 0, target: 5, deadline_days: 90, label: "LinkedIn engagement rate: 5%" },
  { metric: "website_sessions", platform: "all", start: 50, target: 300, deadline_days: 90, label: "Social → 300 site sessions/mo" },
  { metric: "trial_signups", platform: "all", start: 5, target: 30, deadline_days: 90, label: "Social → 30 trial signups/mo" },
];

function GoalCard({ goal, onDelete, onUpdateCurrent }) {
  const metric = METRIC_OPTIONS.find(m => m.value === goal.metric) || { label: goal.metric, unit: "" };
  const platform = PLATFORM_OPTIONS.find(p => p.value === goal.platform);
  const pct = goal.target > 0 ? Math.min(100, ((goal.current_value || 0) / goal.target) * 100) : 0;
  const daysLeft = goal.deadline
    ? Math.max(0, Math.ceil((new Date(goal.deadline) - new Date()) / (1000 * 60 * 60 * 24)))
    : null;
  const done = (goal.current_value || 0) >= goal.target;

  const statusColor = done ? "bg-emerald-500" : pct >= 75 ? "bg-violet-500" : pct >= 40 ? "bg-amber-400" : "bg-slate-300";

  return (
    <div className={`bg-white rounded-2xl border p-5 flex flex-col gap-3 ${done ? "border-emerald-200 bg-emerald-50/30" : "border-slate-200"}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          {done
            ? <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
            : <Target size={16} className="text-violet-500 shrink-0" />
          }
          <div>
            <p className="text-sm font-semibold text-slate-800">{metric.label}</p>
            {platform && (
              <span className="text-xs font-bold px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: platform.color }}>
                {platform.label}
              </span>
            )}
          </div>
        </div>
        <button onClick={() => onDelete(goal.goal_id)} className="p-1.5 text-slate-300 hover:text-red-400 transition-colors rounded-lg hover:bg-red-50">
          <Trash2 size={13} />
        </button>
      </div>

      {/* Progress */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-2xl font-bold text-slate-900">
            {goal.current_value ?? 0}{metric.unit}
          </span>
          <span className="text-sm text-slate-500">of {goal.target}{metric.unit}</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${statusColor}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-slate-400">{pct.toFixed(0)}% complete</span>
          {daysLeft !== null && (
            <span className={`text-xs font-medium ${daysLeft <= 7 ? "text-red-500" : "text-slate-400"}`}>
              {daysLeft === 0 ? "Due today!" : `${daysLeft} days left`}
            </span>
          )}
        </div>
      </div>

      {done && (
        <div className="bg-emerald-100 text-emerald-700 text-xs font-semibold px-3 py-1.5 rounded-lg text-center">
          🎉 Goal achieved!
        </div>
      )}

      {/* Update current value */}
      <div className="pt-2 border-t border-slate-100">
        <label className="block text-xs text-slate-400 mb-1">Update current value</label>
        <div className="flex gap-2">
          <input
            type="number"
            min={0}
            defaultValue={goal.current_value ?? 0}
            onBlur={e => onUpdateCurrent(goal.goal_id, Number(e.target.value))}
            className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
          <span className="text-xs text-slate-400 self-center">{metric.unit || "units"}</span>
        </div>
      </div>
    </div>
  );
}

export default function Goals() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ metric: "followers", platform: "linkedin", target: 1000, current_value: 0, deadline: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/api/v1/goals");
      setGoals(Array.isArray(data) ? data : []);
    } catch { setGoals([]); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/api/v1/goals", {
        ...form,
        deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
      });
      setShowForm(false);
      setForm({ metric: "followers", platform: "linkedin", target: 1000, current_value: 0, deadline: "" });
      await load();
    } catch {} finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/v1/goals/${id}`);
      setGoals(prev => prev.filter(g => g.goal_id !== id));
    } catch {}
  };

  const handleUpdateCurrent = async (id, value) => {
    try {
      await api.patch(`/api/v1/goals/${id}`, { current_value: value });
      setGoals(prev => prev.map(g => g.goal_id === id ? { ...g, current_value: value } : g));
    } catch {}
  };

  const handleAddSuggested = async (s) => {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + (s.deadline_days || 90));
    try {
      await api.post("/api/v1/goals", {
        metric: s.metric,
        platform: s.platform,
        target: s.target,
        current_value: s.start,
        deadline: deadline.toISOString(),
      });
      await load();
    } catch {}
  };

  const activeGoals = goals.filter(g => (g.current_value || 0) < g.target);
  const doneGoals = goals.filter(g => (g.current_value || 0) >= g.target);

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">SMART Goals</h1>
          <p className="text-slate-500 text-sm mt-1">Set measurable targets. Track progress weekly. Double down on what's working.</p>
        </div>
        <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700 transition-colors">
          <Plus size={15} /> Add goal
        </button>
      </div>

      {/* Suggested goals from strategy */}
      {goals.length === 0 && !showForm && (
        <div className="bg-violet-50 border border-violet-200 rounded-2xl p-5 mb-6">
          <p className="text-sm font-semibold text-violet-800 mb-3 flex items-center gap-2">
            <TrendingUp size={15} /> 90-Day goals from the marketing strategy
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {SUGGESTED_GOALS.map((s, i) => (
              <button key={i} onClick={() => handleAddSuggested(s)} className="text-left p-3 bg-white rounded-xl border border-violet-200 hover:border-violet-400 transition-colors group">
                <p className="text-xs font-medium text-slate-700 group-hover:text-violet-700">{s.label}</p>
                <p className="text-[10px] text-slate-400 mt-1">Click to add →</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-2xl border border-slate-200 p-5 mb-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-800">New Goal</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Metric</label>
              <select value={form.metric} onChange={e => setForm(f => ({ ...f, metric: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                {METRIC_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Platform</label>
              <select value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                {PLATFORM_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Current value</label>
              <input type="number" min={0} value={form.current_value} onChange={e => setForm(f => ({ ...f, current_value: Number(e.target.value) }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Target value</label>
              <input type="number" min={1} value={form.target} onChange={e => setForm(f => ({ ...f, target: Number(e.target.value) }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Deadline</label>
              <input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50">
              {saving ? "Saving…" : "Create goal"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48 text-slate-400 text-sm">Loading goals…</div>
      ) : goals.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-slate-400">
          <Target size={36} className="mb-3 opacity-30" />
          <p className="text-sm">No goals yet. Add one to start tracking.</p>
        </div>
      ) : (
        <>
          {activeGoals.length > 0 && (
            <section className="mb-8">
              <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <TrendingUp size={14} /> In progress <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">{activeGoals.length}</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {activeGoals.map(g => <GoalCard key={g.goal_id} goal={g} onDelete={handleDelete} onUpdateCurrent={handleUpdateCurrent} />)}
              </div>
            </section>
          )}
          {doneGoals.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-500" /> Achieved <span className="text-xs bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full font-medium">{doneGoals.length}</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {doneGoals.map(g => <GoalCard key={g.goal_id} goal={g} onDelete={handleDelete} onUpdateCurrent={handleUpdateCurrent} />)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
