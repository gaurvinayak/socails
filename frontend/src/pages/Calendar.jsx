import {
  Calendar as CalIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Edit2,
  Image as ImageIcon,
  List,
  Loader2,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { deletePost, getPosts, updatePost } from "../api";

// ── Platform / status metadata ─────────────────────────────────────────────

const PLATFORM_COLORS = {
  instagram: "#E1306C",
  twitter:   "#000000",
  linkedin:  "#0A66C2",
  facebook:  "#1877F2",
  tiktok:    "#010101",
  youtube:   "#FF0000",
};

const PLATFORM_LABELS = {
  instagram: "IG", twitter: "X",  linkedin: "LI",
  facebook:  "FB", tiktok:  "TT", youtube:  "YT",
};

const STATUS_PILL = {
  scheduled: "text-violet-700 bg-violet-100 border border-violet-200",
  published: "text-emerald-700 bg-emerald-100 border border-emerald-200",
  draft:     "text-slate-600 bg-slate-100 border border-slate-200",
  failed:    "text-red-700 bg-red-100 border border-red-200",
};

const STATUS_DOT = {
  scheduled: "bg-violet-500",
  published: "bg-emerald-500",
  draft:     "bg-slate-400",
  failed:    "bg-red-500",
};

const DAYS   = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

// ── Helpers ────────────────────────────────────────────────────────────────

function getCalendarDays(month) {
  const y = month.getFullYear(), m = month.getMonth();
  const firstDow    = new Date(y, m, 1).getDay();
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

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function fmtShortDate(dateStr) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric",
  });
}

// ── Image / Carousel Viewer ────────────────────────────────────────────────

function MediaViewer({ urls, postType }) {
  const [idx, setIdx] = useState(0);
  if (!urls?.length) return null;

  const isVideo = (url) => /\.(mp4|mov|webm|avi)(\?|$)/i.test(url);
  const current = urls[idx];
  const isCarousel = postType === "carousel" || urls.length > 1;

  return (
    <div className="relative rounded-xl overflow-hidden bg-slate-100 mb-4">
      {/* Main media */}
      {isVideo(current) ? (
        <video src={current} controls className="w-full max-h-72 object-contain" />
      ) : (
        <img
          src={current}
          alt={`Slide ${idx + 1}`}
          className="w-full max-h-72 object-contain"
          onError={(e) => {
            e.target.style.display = "none";
            e.target.parentNode.insertAdjacentHTML(
              "beforeend",
              '<div class="flex items-center justify-center h-24 text-slate-400 text-xs">Image unavailable</div>'
            );
          }}
        />
      )}

      {/* Carousel controls — only when multiple */}
      {isCarousel && (
        <>
          <button
            onClick={() => setIdx((i) => (i - 1 + urls.length) % urls.length)}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition-colors"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            onClick={() => setIdx((i) => (i + 1) % urls.length)}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition-colors"
          >
            <ChevronRight size={15} />
          </button>
          {/* Counter badge */}
          <div className="absolute top-2 right-2 text-xs bg-black/50 text-white px-2 py-0.5 rounded-full">
            {idx + 1} / {urls.length}
          </div>
          {/* Dot indicators */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {urls.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${i === idx ? "bg-white" : "bg-white/50"}`}
              />
            ))}
          </div>
        </>
      )}

      {/* Thumbnail strip for carousels */}
      {isCarousel && urls.length > 1 && (
        <div className="flex gap-1.5 p-2 bg-black/10">
          {urls.map((url, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`w-10 h-10 rounded-md overflow-hidden flex-shrink-0 border-2 transition-colors ${
                i === idx ? "border-white" : "border-transparent opacity-60"
              }`}
            >
              {isVideo(url) ? (
                <div className="w-full h-full bg-slate-700 flex items-center justify-center text-white text-[8px]">▶</div>
              ) : (
                <img src={url} alt="" className="w-full h-full object-cover" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Post Detail Modal ──────────────────────────────────────────────────────

function PostDetail({ post, onClose, onDelete, onUpdate }) {
  const [deleting, setDeleting]       = useState(false);
  const [copied, setCopied]           = useState(false);
  const [editing, setEditing]         = useState(false);
  const [saving, setSaving]           = useState(false);
  const [saveErr, setSaveErr]         = useState("");
  const [editContent, setEditContent] = useState(post.content || "");
  const [editSchedule, setEditSchedule] = useState(
    post.scheduled_at ? new Date(post.scheduled_at).toISOString().slice(0, 16) : ""
  );

  const canEdit = ["draft", "scheduled"].includes(post.status);
  const isPoll  = post.post_type === "poll" || post.poll_options?.length > 0;
  const hasMedia   = post.media_urls?.length > 0;
  const isCarousel = (post.post_type === "carousel" || post.media_urls?.length > 1) && !isPoll;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deletePost(post.post_id);
      onDelete(post.post_id);
      onClose();
    } catch {
      setDeleting(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(post.content || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveErr("");
    try {
      const body = {};
      if (editContent.trim() !== (post.content || "").trim()) body.content = editContent.trim();
      if (editSchedule) {
        const iso = new Date(editSchedule).toISOString();
        if (iso !== post.scheduled_at) body.scheduled_at = iso;
      }
      if (Object.keys(body).length === 0) { setEditing(false); setSaving(false); return; }
      await updatePost(post.post_id, body);
      const updated = {
        ...post,
        ...body,
        scheduled_at: editSchedule ? new Date(editSchedule).toISOString() : post.scheduled_at,
      };
      onUpdate(updated);
      setEditing(false);
    } catch (err) {
      setSaveErr(err.response?.data?.detail || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-xs font-bold px-2.5 py-1 rounded-full text-white capitalize"
              style={{ backgroundColor: PLATFORM_COLORS[post.platform] || "#64748b" }}
            >
              {post.platform}
            </span>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_PILL[post.status] || "text-slate-600 bg-slate-100 border border-slate-200"}`}>
              {post.status}
            </span>
            {isPoll && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 border border-violet-200 font-medium">
                Poll
              </span>
            )}
            {isCarousel && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 font-medium flex items-center gap-1">
                <ImageIcon size={10} />
                {post.media_urls.length} slides
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 ml-2 flex-shrink-0">
            {/* Edit button — only for draft/scheduled non-editing state */}
            {canEdit && !editing && (
              <button
                onClick={() => { setEditing(true); setSaveErr(""); }}
                title="Edit post"
                className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
              >
                <Edit2 size={14} />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">

          {editing ? (
            /* ── Edit form ── */
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1.5 block">
                  {isPoll ? "Poll question" : "Caption"}
                </label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={5}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1.5 block flex items-center gap-1.5">
                  <Clock size={11} /> Scheduled time
                </label>
                <input
                  type="datetime-local"
                  value={editSchedule}
                  min={new Date(Date.now() + 5 * 60000).toISOString().slice(0, 16)}
                  onChange={(e) => setEditSchedule(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              {saveErr && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  ⚠️ {saveErr}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSave}
                  disabled={saving || !editContent.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 disabled:opacity-40 transition-colors"
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  {saving ? "Saving…" : "Save changes"}
                </button>
                <button
                  onClick={() => { setEditing(false); setEditContent(post.content || ""); setEditSchedule(post.scheduled_at ? new Date(post.scheduled_at).toISOString().slice(0, 16) : ""); setSaveErr(""); }}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            /* ── View mode ── */
            <>
              {/* Timestamp */}
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Clock size={12} />
                {fmtDate(post.scheduled_at || post.published_at || post.created_at)}
              </div>

              {/* Media viewer */}
              {hasMedia && <MediaViewer urls={post.media_urls} postType={post.post_type} />}

              {/* Caption */}
              {post.content && (
                <div className="relative group">
                  <p className="text-sm text-slate-800 whitespace-pre-wrap break-words leading-relaxed pr-7">
                    {post.content}
                  </p>
                  <button
                    onClick={handleCopy}
                    title="Copy caption"
                    className="absolute top-0 right-0 text-slate-300 hover:text-slate-600 transition-colors"
                  >
                    {copied
                      ? <Check size={14} className="text-emerald-500" />
                      : <Copy size={14} />
                    }
                  </button>
                </div>
              )}

              {/* Poll options */}
              {isPoll && post.poll_options?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Poll options</p>
                  {post.poll_options.map((opt, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-violet-200 transition-colors"
                    >
                      <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className="text-sm text-slate-700">{opt}</span>
                    </div>
                  ))}
                  {post.poll_duration_minutes && (
                    <p className="text-xs text-slate-400 flex items-center gap-1 pt-0.5">
                      <Clock size={11} />
                      Duration:{" "}
                      {post.poll_duration_minutes % 1440 === 0
                        ? `${post.poll_duration_minutes / 1440} day${post.poll_duration_minutes / 1440 > 1 ? "s" : ""}`
                        : `${post.poll_duration_minutes / 60} hours`}
                    </p>
                  )}
                </div>
              )}

              {/* Tags / pillar / category */}
              {(post.pillar_id || post.category_id || post.tags?.length > 0) && (
                <div className="flex flex-wrap gap-1.5">
                  {post.pillar_id && (
                    <span className="text-xs px-2 py-0.5 rounded-md bg-purple-50 text-purple-600 border border-purple-200">
                      Pillar: {post.pillar_id}
                    </span>
                  )}
                  {post.category_id && (
                    <span className="text-xs px-2 py-0.5 rounded-md bg-orange-50 text-orange-600 border border-orange-200">
                      Category: {post.category_id}
                    </span>
                  )}
                  {post.tags?.map((tag) => (
                    <span key={tag} className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Metrics — published posts */}
              {post.status === "published" && post.metrics && Object.keys(post.metrics).length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {[
                    ["❤️", "Likes",    post.metrics.likes],
                    ["💬", "Comments", post.metrics.comments],
                    ["🔁", "Shares",   post.metrics.shares],
                    ["👁️", "Reach",    post.metrics.reach],
                  ].map(([icon, label, val]) => (
                    <div key={label} className="text-center p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="text-base">{icon}</div>
                      <div className="text-xs font-semibold text-slate-800">{val ?? "—"}</div>
                      <div className="text-[10px] text-slate-400">{label}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Error message */}
              {post.error_message && (
                <p className="text-xs text-red-600 bg-red-50 rounded-lg p-3 border border-red-200">
                  ⚠️ {post.error_message}
                </p>
              )}

              {/* Delete action */}
              {canEdit && (
                <div className="pt-1 border-t border-slate-100">
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={12} />
                    {deleting ? "Deleting…" : "Delete post"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Day overflow popup ─────────────────────────────────────────────────────

function DayPopup({ date, posts, onClose, onSelect }) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-slate-800">{fmtShortDate(date)}</span>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={15} />
          </button>
        </div>
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {posts.map((post) => (
            <button
              key={post.post_id}
              onClick={() => { onClose(); onSelect(post); }}
              className="w-full flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-slate-50 text-left transition-colors"
            >
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[post.status]}`} />
              <span
                className="text-[10px] font-bold text-white px-1.5 py-0.5 rounded flex-shrink-0"
                style={{ backgroundColor: PLATFORM_COLORS[post.platform] || "#64748b" }}
              >
                {PLATFORM_LABELS[post.platform] || "??"}
              </span>
              <span className="text-xs text-slate-700 truncate flex-1">
                {post.content?.slice(0, 45) || "No caption"}
              </span>
              {post.media_urls?.length > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] text-slate-400 flex-shrink-0">
                  <ImageIcon size={10} />
                  {post.media_urls.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Post chip (calendar cell) ──────────────────────────────────────────────

function PostChip({ post, onClick }) {
  const label = PLATFORM_LABELS[post.platform] || post.platform?.slice(0, 2).toUpperCase();
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(post); }}
      title={post.content?.slice(0, 80)}
      className="w-full flex items-center gap-1 px-1.5 py-0.5 rounded text-white text-[10px] font-bold truncate hover:opacity-80 transition-opacity"
      style={{ backgroundColor: PLATFORM_COLORS[post.platform] || "#64748b" }}
    >
      <span className="flex-shrink-0">{label}</span>
      {post.media_urls?.length > 0 && <ImageIcon size={8} className="flex-shrink-0 opacity-80" />}
      <span className="opacity-80 font-normal truncate">
        {post.content?.slice(0, 14) || "No caption"}
      </span>
    </button>
  );
}

// ── Scheduled sidebar ──────────────────────────────────────────────────────

function ScheduledSidebar({ posts, onSelect }) {
  const scheduled = posts
    .filter((p) => p.status === "scheduled" && p.scheduled_at)
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));

  // Group by date string
  const groups = {};
  for (const p of scheduled) {
    const d = p.scheduled_at.split("T")[0];
    if (!groups[d]) groups[d] = [];
    groups[d].push(p);
  }

  return (
    <div className="w-64 flex-shrink-0 flex flex-col" style={{ maxHeight: "calc(100vh - 200px)" }}>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-semibold text-slate-800">Scheduled</h2>
        {scheduled.length > 0 && (
          <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">
            {scheduled.length}
          </span>
        )}
      </div>

      {scheduled.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-10 text-slate-400 bg-white rounded-2xl border border-slate-200">
          <Clock size={28} className="mb-2 opacity-40" />
          <p className="text-xs font-medium">No scheduled posts</p>
          <p className="text-[11px] mt-0.5 text-slate-300">Create posts in the Composer</p>
        </div>
      ) : (
        <div className="space-y-4 overflow-y-auto flex-1 pr-0.5">
          {Object.entries(groups).map(([date, dayPosts]) => (
            <div key={date}>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 sticky top-0 bg-transparent">
                {fmtShortDate(date)}
              </p>
              <div className="space-y-1.5">
                {dayPosts.map((post) => (
                  <button
                    key={post.post_id}
                    onClick={() => onSelect(post)}
                    className="w-full flex items-start gap-2 p-2.5 rounded-xl border border-slate-100 bg-white hover:border-violet-200 hover:bg-violet-50/30 text-left transition-colors group"
                  >
                    {/* Platform color dot */}
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5"
                      style={{ backgroundColor: PLATFORM_COLORS[post.platform] || "#64748b" }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-slate-400 mb-0.5">
                        {fmtTime(post.scheduled_at)}
                        {" · "}
                        <span className="font-medium text-slate-500 uppercase">
                          {PLATFORM_LABELS[post.platform] || post.platform}
                        </span>
                      </p>
                      <p className="text-xs text-slate-700 truncate leading-snug group-hover:text-slate-900">
                        {post.content?.trim() || <span className="italic text-slate-400">No caption</span>}
                      </p>
                      {post.media_urls?.length > 0 && (
                        <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                          <ImageIcon size={9} />
                          {post.post_type === "carousel"
                            ? `${post.media_urls.length} slides`
                            : `${post.media_urls.length} image${post.media_urls.length > 1 ? "s" : ""}`}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── List view ──────────────────────────────────────────────────────────────

function ListView({ posts, onSelect }) {
  const sorted = [...posts].sort((a, b) => {
    const da = a.scheduled_at || a.published_at || a.created_at || "";
    const db = b.scheduled_at || b.published_at || b.created_at || "";
    return da > db ? -1 : 1; // newest first
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {sorted.length === 0 ? (
        <div className="py-16 text-center text-slate-400 text-sm">No posts yet</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {["Platform", "Caption", "Media", "Status", "Date"].map((h) => (
                <th
                  key={h}
                  className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((post) => (
              <tr
                key={post.post_id}
                onClick={() => onSelect(post)}
                className="hover:bg-slate-50 cursor-pointer transition-colors"
              >
                {/* Platform */}
                <td className="px-4 py-3">
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: PLATFORM_COLORS[post.platform] || "#64748b" }}
                  >
                    {PLATFORM_LABELS[post.platform] || post.platform}
                  </span>
                </td>
                {/* Caption */}
                <td className="px-4 py-3 max-w-xs">
                  <p className="text-xs text-slate-700 truncate">
                    {post.content || <span className="italic text-slate-400">No caption</span>}
                  </p>
                </td>
                {/* Media thumbnail */}
                <td className="px-4 py-3">
                  {post.media_urls?.length > 0 ? (
                    <div className="flex items-center gap-1.5">
                      <img
                        src={post.media_urls[0]}
                        alt=""
                        className="w-9 h-9 rounded-lg object-cover border border-slate-200"
                        onError={(e) => { e.target.style.display = "none"; }}
                      />
                      {post.media_urls.length > 1 && (
                        <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">
                          +{post.media_urls.length - 1}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-300">—</span>
                  )}
                </td>
                {/* Status */}
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_PILL[post.status] || "text-slate-600 bg-slate-100 border border-slate-200"}`}>
                    {post.status}
                  </span>
                </td>
                {/* Date */}
                <td className="px-4 py-3">
                  <span className="text-xs text-slate-500">
                    {fmtDate(post.scheduled_at || post.published_at || post.created_at)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function Calendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [posts, setPosts]               = useState([]);
  const [selectedPost, setSelectedPost] = useState(null);
  const [dayPopup, setDayPopup]         = useState(null); // { date, posts }
  const [loading, setLoading]           = useState(true);
  const [view, setView]                 = useState("calendar"); // "calendar" | "list"

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
    if (d) {
      if (!postsByDate[d]) postsByDate[d] = [];
      postsByDate[d].push(post);
    }
  }

  const today          = new Date().toISOString().split("T")[0];
  const totalScheduled = posts.filter((p) => p.status === "scheduled").length;
  const totalPublished = posts.filter((p) => p.status === "published").length;

  const prevMonth = () =>
    setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const nextMonth = () =>
    setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));

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

        <div className="flex items-center gap-3">
          {/* Calendar / List toggle */}
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            <button
              onClick={() => setView("calendar")}
              className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${
                view === "calendar"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <CalIcon size={13} />
              Calendar
            </button>
            <button
              onClick={() => setView("list")}
              className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${
                view === "list"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <List size={13} />
              List
            </button>
          </div>

          {/* Month nav — calendar view only */}
          {view === "calendar" && (
            <div className="flex items-center gap-1">
              <button
                onClick={prevMonth}
                className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="text-sm font-semibold text-slate-800 w-36 text-center">
                {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </span>
              <button
                onClick={nextMonth}
                className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 py-24 text-center text-slate-400 text-sm">
          Loading posts…
        </div>
      ) : view === "list" ? (
        <ListView posts={posts} onSelect={setSelectedPost} />
      ) : (
        <div className="flex gap-5 items-start">
          {/* Calendar grid */}
          <div className="flex-1 min-w-0">
            {/* Platform legend */}
            <div className="flex items-center gap-4 mb-3 flex-wrap">
              {Object.entries(PLATFORM_COLORS).map(([p, c]) => (
                <div key={p} className="flex items-center gap-1.5 text-xs text-slate-500 capitalize">
                  <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: c }} />
                  {p}
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              {/* Day-of-week headers */}
              <div className="grid grid-cols-7 border-b border-slate-200">
                {DAYS.map((d) => (
                  <div
                    key={d}
                    className="py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide"
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7">
                {calDays.map((day, idx) => {
                  const dateStr  = day ? day.toISOString().split("T")[0] : null;
                  const dayPosts = dateStr ? (postsByDate[dateStr] || []) : [];
                  const isToday  = dateStr === today;
                  const shown    = dayPosts.slice(0, 3);
                  const extra    = dayPosts.length - shown.length;

                  return (
                    <div
                      key={idx}
                      className={`min-h-[90px] p-2 border-b border-r border-slate-100 transition-colors ${
                        !day ? "bg-slate-50/50" : "bg-white hover:bg-slate-50/30"
                      }`}
                    >
                      {day && (
                        <>
                          <span
                            className={`inline-flex items-center justify-center w-6 h-6 text-xs font-medium rounded-full ${
                              isToday ? "bg-violet-600 text-white" : "text-slate-700"
                            }`}
                          >
                            {day.getDate()}
                          </span>
                          <div className="mt-1 space-y-0.5">
                            {shown.map((post) => (
                              <PostChip key={post.post_id} post={post} onClick={setSelectedPost} />
                            ))}
                            {extra > 0 && (
                              <button
                                onClick={() => setDayPopup({ date: dateStr, posts: dayPosts })}
                                className="text-[10px] text-violet-500 hover:text-violet-700 font-medium transition-colors pl-1"
                              >
                                +{extra} more
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Upcoming scheduled sidebar */}
          <ScheduledSidebar posts={posts} onSelect={setSelectedPost} />
        </div>
      )}

      {/* Post detail modal */}
      {selectedPost && (
        <PostDetail
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          onDelete={(id) => {
            setPosts((prev) => prev.filter((p) => p.post_id !== id));
          }}
          onUpdate={(updated) => {
            setPosts((prev) => prev.map((p) => p.post_id === updated.post_id ? updated : p));
            setSelectedPost(updated);
          }}
        />
      )}

      {/* Day overflow popup */}
      {dayPopup && (
        <DayPopup
          date={dayPopup.date}
          posts={dayPopup.posts}
          onClose={() => setDayPopup(null)}
          onSelect={setSelectedPost}
        />
      )}
    </div>
  );
}
