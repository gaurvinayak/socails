import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useState } from "react";
import { deletePost, getPosts } from "../api";

const PLATFORM_COLORS = {
  instagram: "#E1306C",
  twitter:   "#000000",
  linkedin:  "#0A66C2",
  facebook:  "#1877F2",
};

const PLATFORM_LABELS = {
  instagram: "IG", twitter: "X", linkedin: "LI", facebook: "FB",
};

const STATUS_COLORS = {
  scheduled: "bg-violet-500",
  published: "bg-emerald-500",
  draft:     "bg-slate-400",
  failed:    "bg-red-500",
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function getCalendarDays(month) {
  const y = month.getFullYear();
  const m = month.getMonth();
  const firstDow = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const days = [];
  for (let i = 0; i < firstDow; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(new Date(y, m, d));
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

function postDate(post) {
  const raw = post.scheduled_at || post.published_at || post.created_at;
  return raw ? raw.split("T")[0] : null;
}

function PostChip({ post, onClick }) {
  const label = PLATFORM_LABELS[post.platform] || post.platform.slice(0, 2).toUpperCase();
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(post); }}
      title={post.content?.slice(0, 80)}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-white text-[10px] font-bold truncate max-w-full ${STATUS_COLORS[post.status] || "bg-slate-400"}`}
      style={{ backgroundColor: PLATFORM_COLORS[post.platform] }}
    >
      {label}
      <span className="opacity-80 font-normal truncate max-w-[60px]">{post.content?.slice(0, 12)}</span>
    </button>
  );
}

function PostDetail({ post, onClose, onDelete }) {
  const [deleting, setDeleting] = useState(false);
  const handleDelete = async () => {
    setDeleting(true);
    try { await deletePost(post.post_id); onDelete(post.post_id); onClose(); }
    catch { setDeleting(false); }
  };
  const dateStr = post.scheduled_at || post.published_at || post.created_at;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: PLATFORM_COLORS[post.platform] }}>
                {post.platform}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full text-white font-medium ${STATUS_COLORS[post.status]}`}>{post.status}</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">{dateStr ? new Date(dateStr).toLocaleString() : "—"}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>
        <p className="text-sm text-slate-800 whitespace-pre-wrap break-words mb-4 max-h-48 overflow-y-auto">{post.content}</p>
        {post.media_urls?.length > 0 && (
          <div className="flex gap-2 mb-4">
            {post.media_urls.map((url, i) => (
              <img key={i} src={url} alt="" className="h-16 w-16 object-cover rounded-lg" onError={(e) => e.target.style.display = "none"} />
            ))}
          </div>
        )}
        {post.error_message && (
          <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2 mb-3">{post.error_message}</p>
        )}
        {["draft", "scheduled"].includes(post.status) && (
          <button onClick={handleDelete} disabled={deleting} className="text-xs text-red-500 hover:underline">
            {deleting ? "Deleting…" : "Delete post"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function Calendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [posts, setPosts] = useState([]);
  const [selectedPost, setSelectedPost] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPosts({ limit: 500 })
      .then(({ data }) => setPosts(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const calDays = getCalendarDays(currentMonth);

  const postsByDate = {};
  for (const post of posts) {
    const d = postDate(post);
    if (d) { if (!postsByDate[d]) postsByDate[d] = []; postsByDate[d].push(post); }
  }

  const today = new Date().toISOString().split("T")[0];

  const prevMonth = () => setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));

  const totalScheduled = posts.filter((p) => p.status === "scheduled").length;
  const totalPublished = posts.filter((p) => p.status === "published").length;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Calendar</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {totalScheduled} scheduled · {totalPublished} published
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold text-slate-800 w-36 text-center">
            {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </span>
          <button onClick={nextMonth} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4">
        {Object.entries(PLATFORM_COLORS).map(([p, c]) => (
          <div key={p} className="flex items-center gap-1.5 text-xs text-slate-500">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: c }} />
            {p}
          </div>
        ))}
        <div className="ml-auto flex items-center gap-3">
          {Object.entries({ scheduled: "Scheduled", published: "Published", draft: "Draft", failed: "Failed" }).map(([s, l]) => (
            <div key={s} className="flex items-center gap-1 text-xs text-slate-500">
              <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[s]}`} />
              {l}
            </div>
          ))}
        </div>
      </div>

      {/* Calendar grid */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-slate-200">
          {DAYS.map((d) => (
            <div key={d} className="py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        {loading ? (
          <div className="py-24 text-center text-slate-400 text-sm">Loading posts…</div>
        ) : (
          <div className="grid grid-cols-7">
            {calDays.map((day, idx) => {
              const dateStr = day ? day.toISOString().split("T")[0] : null;
              const dayPosts = dateStr ? (postsByDate[dateStr] || []) : [];
              const isToday = dateStr === today;
              const shown = dayPosts.slice(0, 3);
              const extra = dayPosts.length - shown.length;

              return (
                <div
                  key={idx}
                  className={`min-h-[90px] p-2 border-b border-r border-slate-100 ${!day ? "bg-slate-50/50" : "bg-white hover:bg-slate-50/50"} transition-colors`}
                >
                  {day && (
                    <>
                      <span className={`inline-flex items-center justify-center w-6 h-6 text-xs font-medium rounded-full ${isToday ? "bg-violet-600 text-white" : "text-slate-700"}`}>
                        {day.getDate()}
                      </span>
                      <div className="mt-1 space-y-0.5">
                        {shown.map((post) => (
                          <PostChip key={post.post_id} post={post} onClick={setSelectedPost} />
                        ))}
                        {extra > 0 && (
                          <span className="text-[10px] text-slate-400 font-medium">+{extra} more</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedPost && (
        <PostDetail
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          onDelete={(id) => setPosts((prev) => prev.filter((p) => p.post_id !== id))}
        />
      )}
    </div>
  );
}
