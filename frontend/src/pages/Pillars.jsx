import { BarChart3, BookOpen, Briefcase, Heart, Lightbulb, Plus, Trash2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import api from "../api";

const DEFAULT_PILLARS = [
  {
    name: "System Design Education",
    description: "Teach the thing we help people practice — design breakdowns, caching, sharding, concurrency.",
    color: "#8b5cf6",
    icon: "BookOpen",
    example: "How would you design Uber's location tracking?",
  },
  {
    name: "Interview Prep Tactics",
    description: "Help them ace the process — how to structure a 45-min round, what interviewers look for.",
    color: "#0A66C2",
    icon: "Briefcase",
    example: "Red flags that tank good system design candidates",
  },
  {
    name: "Career & Leveling Up",
    description: "Talk to the ambition behind why they prep — L5→L6 stories, salary negotiation, FAANG levels.",
    color: "#10b981",
    icon: "TrendingUp",
    example: "How I got my L6 at Amazon — what I changed",
  },
  {
    name: "Behind the Product",
    description: "Build trust by being transparent — how AI feedback works, new features, founder updates.",
    color: "#f59e0b",
    icon: "Lightbulb",
    example: "How our AI evaluates your system design answer",
  },
  {
    name: "Social Proof & Community",
    description: "Let users sell for us — win posts, AI feedback screenshots, leaderboard, polls.",
    color: "#ef4444",
    icon: "Heart",
    example: "Just got an offer at Google — SystemDesignLab helped me",
  },
];

const ICON_MAP = { BookOpen, Briefcase, Lightbulb, Heart, Users, BarChart3 };

const PILLAR_COLORS = [
  "#8b5cf6", "#0A66C2", "#10b981", "#f59e0b", "#ef4444",
  "#3b82f6", "#ec4899", "#14b8a6", "#f97316", "#6366f1",
];

function PillarCard({ pillar, postCount, onDelete }) {
  const Icon = ICON_MAP[pillar.icon] || BookOpen;
  const pct = Math.min(100, ((postCount || 0) / 10) * 100);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${pillar.color}20` }}>
            <Icon size={18} style={{ color: pillar.color }} />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 text-sm">{pillar.name}</h3>
            <p className="text-xs text-slate-400">{postCount ?? 0} posts tagged</p>
          </div>
        </div>
        {!pillar.is_default && (
          <button onClick={() => onDelete(pillar.pillar_id)} className="p-1.5 text-slate-300 hover:text-red-400 transition-colors rounded-lg hover:bg-red-50">
            <Trash2 size={13} />
          </button>
        )}
      </div>

      <p className="text-xs text-slate-500 leading-relaxed">{pillar.description}</p>

      {pillar.example && (
        <div className="bg-slate-50 rounded-lg px-3 py-2">
          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mb-1">Example post</p>
          <p className="text-xs text-slate-600 italic">"{pillar.example}"</p>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-slate-400 font-medium">Post balance</span>
          <span className="text-[10px] text-slate-400">{postCount ?? 0}/10 ideal</span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: pillar.color }} />
        </div>
      </div>

      <div className="pt-1">
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold text-white" style={{ backgroundColor: pillar.color }}>
          {pillar.name.split(" ")[0]}
        </span>
      </div>
    </div>
  );
}

export default function Pillars() {
  const [pillars, setPillars] = useState([]);
  const [postCounts, setPostCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", color: "#8b5cf6", example: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/api/v1/pillars");
      setPillars(data.pillars || []);
      setPostCounts(data.post_counts || {});
    } catch {
      setPillars([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await api.post("/api/v1/pillars", form);
      setShowForm(false);
      setForm({ name: "", description: "", color: "#8b5cf6", example: "" });
      await load();
    } catch {} finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/v1/pillars/${id}`);
      await load();
    } catch {}
  };

  const total = Object.values(postCounts).reduce((s, v) => s + (v || 0), 0);

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Content Pillars</h1>
          <p className="text-slate-500 text-sm mt-1">
            Every post maps to one of these 5 topics. The algorithm rewards topical focus.
          </p>
        </div>
        <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700 transition-colors">
          <Plus size={15} /> Add pillar
        </button>
      </div>

      {/* Balance overview */}
      {total > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Pillar balance — {total} posts total</h2>
          <div className="space-y-2">
            {pillars.map(p => {
              const count = postCounts[p.pillar_id] || 0;
              const pct = total > 0 ? (count / total) * 100 : 0;
              return (
                <div key={p.pillar_id} className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-40 truncate">{p.name}</span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: p.color }} />
                  </div>
                  <span className="text-xs text-slate-400 w-10 text-right">{pct.toFixed(0)}%</span>
                </div>
              );
            })}
          </div>
          {pillars.length > 0 && (() => {
            const maxPillar = pillars.reduce((a, b) => (postCounts[a.pillar_id] || 0) > (postCounts[b.pillar_id] || 0) ? a : b);
            const minPillar = pillars.reduce((a, b) => (postCounts[a.pillar_id] || 0) < (postCounts[b.pillar_id] || 0) ? a : b);
            const maxPct = total > 0 ? ((postCounts[maxPillar.pillar_id] || 0) / total) * 100 : 0;
            if (maxPct > 50) {
              return (
                <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700">
                  ⚠️ <strong>{maxPillar.name}</strong> is {maxPct.toFixed(0)}% of your content. Consider more <strong>{minPillar.name}</strong> posts.
                </div>
              );
            }
            return null;
          })()}
        </div>
      )}

      {/* New pillar form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-2xl border border-slate-200 p-5 mb-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-800">New Pillar</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Name *</label>
              <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Customer Stories" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Color</label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {PILLAR_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))} className={`w-6 h-6 rounded-full border-2 transition-transform ${form.color === c ? "border-slate-800 scale-110" : "border-transparent"}`} style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What type of content goes here?" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Example post idea</label>
            <input value={form.example} onChange={e => setForm(f => ({ ...f, example: e.target.value }))} placeholder="e.g. How we built X" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50">
              {saving ? "Saving…" : "Create pillar"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48 text-slate-400 text-sm">Loading pillars…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {pillars.map(p => (
            <PillarCard key={p.pillar_id} pillar={p} postCount={postCounts[p.pillar_id] || 0} onDelete={handleDelete} />
          ))}
        </div>
      )}

      <div className="mt-8 bg-violet-50 border border-violet-200 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-violet-800 mb-2">Why content pillars matter</h3>
        <p className="text-xs text-violet-700 leading-relaxed">
          LinkedIn's algorithm rewards accounts with <strong>topical authority</strong> — posting consistently about 4–5 core topics signals to the algorithm that you're an expert. Accounts that map every post to a pillar see <strong>30–40% higher organic reach</strong> compared to those that post randomly.
        </p>
        <p className="text-xs text-violet-600 mt-2">
          📌 Tip: After tagging posts, aim for no single pillar to exceed 40% of your total posts. Balance builds authority across all topics.
        </p>
      </div>
    </div>
  );
}
