import { Download, Link2, RefreshCw, TrendingUp, Users } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import api, { getAnalyticsSummary, getFollowerGrowth, getTopPosts, refreshPostMetrics, snapshotFollowers } from "../api";

const PLATFORM_COLORS = {
  instagram: "#E1306C",
  twitter: "#000000",
  linkedin: "#0A66C2",
  facebook: "#1877F2",
};

const STATUS_COLORS = {
  scheduled: "#8b5cf6",
  published: "#10b981",
  draft: "#94a3b8",
  failed: "#ef4444",
};

const DAYS_OPTIONS = [7, 14, 30, 90];

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => i);
const SHOWN_HOURS = new Set([0, 6, 12, 18, 23]);

const getHeatmap = (days) => api.get("/api/v1/analytics/heatmap", { params: { days } });

function StatCard({ label, value, sub, color = "violet" }) {
  const ring = {
    violet: "border-violet-200 bg-violet-50",
    emerald: "border-emerald-200 bg-emerald-50",
    blue: "border-blue-200 bg-blue-50",
    rose: "border-rose-200 bg-rose-50",
  }[color];
  const text = {
    violet: "text-violet-700",
    emerald: "text-emerald-700",
    blue: "text-blue-700",
    rose: "text-rose-700",
  }[color];
  return (
    <div className={`rounded-2xl border p-5 ${ring}`}>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-3xl font-bold ${text}`}>{value ?? "—"}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

function BestTimeHeatmap({ heatmap, heatmapLoading }) {
  if (heatmapLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-8">
        <h2 className="text-sm font-semibold text-slate-800 mb-4">Best time to post</h2>
        <div className="h-40 flex items-center justify-center text-slate-400 text-xs">Loading…</div>
      </div>
    );
  }

  const matrix = heatmap?.data;
  const allZero = !matrix || matrix.every((row) => row.every((v) => v === 0));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-8">
      <h2 className="text-sm font-semibold text-slate-800 mb-4">Best time to post</h2>
      {allZero ? (
        <p className="text-xs text-slate-400">Not enough published posts to show patterns.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="border-separate border-spacing-0.5 text-[10px]">
              <thead>
                <tr>
                  {/* empty corner cell */}
                  <th className="w-10" />
                  {HOUR_LABELS.map((h) => (
                    <th key={h} className="w-5 text-center font-normal text-slate-400">
                      {SHOWN_HOURS.has(h) ? h : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const maxValue = Math.max(1, ...matrix.flat());
                  return DAY_LABELS.map((day, rowIdx) => (
                    <tr key={day}>
                      <td className="pr-2 text-right text-slate-500 font-medium whitespace-nowrap">{day}</td>
                      {HOUR_LABELS.map((h) => {
                        const value = matrix[rowIdx]?.[h] ?? 0;
                        const opacity = value === 0 ? 0 : Math.min(1, value / maxValue);
                        const bg = value === 0
                          ? "#f8fafc"
                          : `rgba(139, 92, 246, ${opacity})`;
                        return (
                          <td
                            key={h}
                            title={`${day} ${h}:00 — ${value} post${value !== 1 ? "s" : ""}`}
                            style={{ backgroundColor: bg }}
                            className="w-5 h-5 rounded-sm"
                          />
                        );
                      })}
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
          {/* Legend */}
          <div className="flex items-center gap-2 mt-3">
            <span className="text-[10px] text-slate-400">Fewer posts</span>
            <div
              className="h-2.5 w-24 rounded"
              style={{ background: "linear-gradient(to right, #f8fafc, rgba(139, 92, 246, 1))" }}
            />
            <span className="text-[10px] text-slate-400">More posts</span>
          </div>
        </>
      )}
    </div>
  );
}

const PLATFORM_COLORS_MAP = {
  instagram: "#E1306C", twitter: "#000000", linkedin: "#0A66C2",
  facebook: "#1877F2", tiktok: "#ff0050", youtube: "#FF0000",
};

function FollowerGrowthChart({ growth }) {
  if (!growth || !growth.series || Object.keys(growth.series).length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-8">
        <h2 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2"><Users size={15} /> Follower Growth</h2>
        <div className="h-40 flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
          <Users size={24} className="opacity-30" />
          <p>No follower snapshots yet.</p>
          <button onClick={() => snapshotFollowers().then(() => window.location.reload())} className="text-violet-600 hover:underline text-xs">Take first snapshot →</button>
        </div>
      </div>
    );
  }

  // Build unified time-series combining all platforms
  const allDates = [...new Set(Object.values(growth.series).flatMap(s => s.map(p => p.date)))].sort();
  const chartData = allDates.map(date => {
    const point = { date };
    for (const [plat, series] of Object.entries(growth.series)) {
      const match = series.find(s => s.date === date);
      point[plat] = match?.followers ?? null;
    }
    return point;
  });

  const platforms = Object.keys(growth.series);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2"><Users size={15} /> Follower Growth</h2>
        <div className="flex items-center gap-4">
          {Object.entries(growth.current_totals || {}).map(([plat, count]) => (
            <div key={plat} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PLATFORM_COLORS_MAP[plat] || "#94a3b8" }} />
              <span className="text-xs font-semibold text-slate-700">{count?.toLocaleString()}</span>
              <span className="text-xs text-slate-400">{plat}</span>
            </div>
          ))}
          <button onClick={() => snapshotFollowers()} className="text-xs text-violet-600 hover:underline">Snapshot now</button>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip content={<CustomTooltip />} />
          {platforms.map(plat => (
            <Line key={plat} type="monotone" dataKey={plat} stroke={PLATFORM_COLORS_MAP[plat] || "#94a3b8"} strokeWidth={2} dot={false} name={plat} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function Analytics() {
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState(null);
  const [topPosts, setTopPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [heatmap, setHeatmap] = useState(null);
  const [heatmapLoading, setHeatmapLoading] = useState(true);
  const [growth, setGrowth] = useState(null);
  const [refreshingMetrics, setRefreshingMetrics] = useState(null);

  const load = async (spin = false) => {
    if (spin) setRefreshing(true);
    setHeatmapLoading(true);
    try {
      const [{ data: s }, { data: t }, { data: h }, { data: g }] = await Promise.all([
        getAnalyticsSummary(days),
        getTopPosts({ days, limit: 10 }),
        getHeatmap(days),
        getFollowerGrowth(days),
      ]);
      setSummary(s);
      setTopPosts(t);
      setHeatmap(h);
      setGrowth(g);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
      setHeatmapLoading(false);
    }
  };

  const handleRefreshMetrics = async (postId) => {
    setRefreshingMetrics(postId);
    try {
      const { data } = await refreshPostMetrics(postId);
      if (data.metrics) {
        setTopPosts(prev => prev.map(p => p.post_id === postId ? { ...p, metrics: data.metrics } : p));
      }
    } catch {} finally { setRefreshingMetrics(null); }
  };

  useEffect(() => { load(); }, [days]);

  // Inject print styles once
  useEffect(() => {
    const id = "print-styles";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `@media print { nav, aside, .no-print { display: none !important; } }`;
    document.head.appendChild(style);
    return () => { document.getElementById(id)?.remove(); };
  }, []);

  const handleExportCsv = () => {
    window.open(`/api/v1/analytics/export?days=${days}`, "_blank");
  };

  const handleExportPdf = () => {
    window.print();
  };

  const byPlatformData = summary
    ? Object.entries(summary.posts_by_platform || {}).map(([platform, count]) => ({ platform, count }))
    : [];

  const byStatusData = summary
    ? Object.entries(summary.posts_by_status || {}).map(([status, value]) => ({ name: status, value }))
    : [];

  const overTimeData = summary?.posts_over_time ?? [];

  return (
    <div className="p-8">
      <style>{`@media print { nav, aside, .no-print { display: none !important; } }`}</style>

      {/* Header */}
      <div className="flex items-center justify-between mb-6 no-print">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
          <p className="text-slate-500 text-sm mt-0.5">Post performance across all connected platforms</p>
        </div>
        <div className="flex items-center gap-2">
          {DAYS_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${days === d ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
            >
              {d}d
            </button>
          ))}
          <button onClick={() => load(true)} disabled={refreshing} className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 transition-colors">
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          </button>
          <button onClick={handleExportCsv} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
            <Download size={13} /> Export CSV
          </button>
          <button onClick={handleExportPdf} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
            <Download size={13} /> Export PDF
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Loading analytics…</div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard label="Total posts" value={summary?.total_posts} sub={`Last ${days} days`} color="violet" />
            <StatCard label="Published" value={summary?.posts_by_status?.published ?? 0} sub="Successfully sent" color="emerald" />
            <StatCard label="Scheduled" value={summary?.posts_by_status?.scheduled ?? 0} sub="Queued to publish" color="blue" />
            <StatCard label="Failed" value={summary?.posts_by_status?.failed ?? 0} sub="Needs attention" color="rose" />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Posts over time */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5">
              <h2 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <TrendingUp size={15} /> Posts over time
              </h2>
              {overTimeData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-slate-400 text-xs">No data for this period</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={overTimeData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Posts" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* By status pie */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h2 className="text-sm font-semibold text-slate-800 mb-4">By status</h2>
              {byStatusData.every((d) => d.value === 0) ? (
                <div className="h-48 flex items-center justify-center text-slate-400 text-xs">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={byStatusData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                      {byStatusData.map((entry) => (
                        <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || "#94a3b8"} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* By platform bar chart */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-8">
            <h2 className="text-sm font-semibold text-slate-800 mb-4">Posts by platform</h2>
            {byPlatformData.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-slate-400 text-xs">No data for this period</div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={byPlatformData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="platform" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} name="Posts">
                    {byPlatformData.map((entry) => (
                      <Cell key={entry.platform} fill={PLATFORM_COLORS[entry.platform] || "#8b5cf6"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Best time heatmap */}
          <BestTimeHeatmap heatmap={heatmap} heatmapLoading={heatmapLoading} />

          {/* Follower Growth */}
          <FollowerGrowthChart growth={growth} />

          {/* UTM Auto-Tracking info */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <Link2 size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-blue-800">UTM Auto-Tracking</p>
                <p className="text-xs text-blue-600 mt-1">
                  Links in your posts are automatically tagged with UTM parameters:
                  <code className="bg-blue-100 px-1 rounded ml-1 font-mono text-[10px]">utm_source={"{platform}"}&utm_medium=social&utm_campaign=socails</code>
                </p>
                <p className="text-xs text-blue-500 mt-1">Connect Google Analytics to see traffic attribution in your GA4 dashboard.</p>
              </div>
            </div>
          </div>

          {/* Top posts table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-800">Top posts</h2>
            </div>
            {topPosts.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-slate-400">No published posts in this period</div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 uppercase tracking-wide">
                    <th className="text-left px-5 py-3 font-semibold">Content</th>
                    <th className="text-left px-4 py-3 font-semibold">Platform</th>
                    <th className="text-right px-4 py-3 font-semibold">Likes</th>
                    <th className="text-right px-4 py-3 font-semibold">Comments</th>
                    <th className="text-right px-5 py-3 font-semibold">Reach</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {topPosts.map((post) => (
                    <tr key={post.post_id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 max-w-xs">
                        <p className="truncate text-slate-700">{post.content}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: PLATFORM_COLORS[post.platform] }}>
                          {post.platform?.slice(0, 2).toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">{post.metrics?.likes ?? "—"}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{post.metrics?.comments ?? "—"}</td>
                      <td className="px-5 py-3 text-right text-slate-600">{post.metrics?.reach ?? "—"}</td>
                      <td className="px-3 py-3 text-right">
                        <button
                          onClick={() => handleRefreshMetrics(post.post_id)}
                          disabled={refreshingMetrics === post.post_id}
                          title="Refresh metrics from platform"
                          className="p-1 text-slate-300 hover:text-violet-500 transition-colors disabled:opacity-40"
                        >
                          <RefreshCw size={11} className={refreshingMetrics === post.post_id ? "animate-spin" : ""} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
