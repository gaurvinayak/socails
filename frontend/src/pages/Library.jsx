import {
  Copy, Download, Edit2, Hash, ImagePlus, Loader2, Palette, Pencil,
  Plus, RotateCcw, Search, Tag, Trash2, Upload, X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import api, {
  createHashtagGroup, deleteHashtagGroup, deleteMedia, getHashtagGroups,
  getMedia, uploadMedia,
} from "../api";

// ── Inline API helpers ────────────────────────────────────────────────────────
const getBrandKit    = ()       => api.get("/api/v1/brand-kit");
const updateBrandKit = (body)   => api.put("/api/v1/brand-kit", body);
const searchUnsplash = (query, page) =>
  api.get("/api/v1/media/unsplash", { params: { query, page, per_page: 20 } });

// ── Constants ─────────────────────────────────────────────────────────────────
const TYPE_FILTERS   = ["all", "image", "video", "document"];
const ASPECT_RATIOS  = ["Free", "1:1", "4:5", "16:9", "9:16"];

// ── ImageEditorModal ──────────────────────────────────────────────────────────
function ImageEditorModal({ item, onClose }) {
  const [brightness, setBrightness] = useState(100);
  const [contrast,   setContrast]   = useState(100);
  const [aspect,     setAspect]     = useState("Free");
  const [copied,     setCopied]     = useState(false);

  const aspectStyle = () => {
    const map = { "1:1": "1/1", "4:5": "4/5", "16:9": "16/9", "9:16": "9/16" };
    return map[aspect] ? { aspectRatio: map[aspect] } : {};
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(item.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <Pencil size={15} className="text-violet-500" /> Edit Image
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Image area */}
        <div className="flex items-center justify-center bg-slate-100 rounded-xl overflow-hidden" style={{ minHeight: "160px" }}>
          <div style={{ ...aspectStyle(), maxHeight: "256px", position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            {aspect !== "Free" && (
              <div
                className="absolute inset-0 border-2 border-dashed border-violet-400 pointer-events-none z-10 rounded"
                style={{ boxSizing: "border-box" }}
              />
            )}
            <img
              src={item.url}
              alt={item.filename}
              style={{
                filter: `brightness(${brightness}%) contrast(${contrast}%)`,
                maxHeight: "256px",
                maxWidth: "100%",
                objectFit: "contain",
                display: "block",
              }}
            />
          </div>
        </div>

        {/* Aspect ratio buttons */}
        <div className="flex gap-2 flex-wrap">
          {ASPECT_RATIOS.map((r) => (
            <button
              key={r}
              onClick={() => setAspect(r)}
              className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                aspect === r
                  ? "bg-violet-600 text-white border-violet-600"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Sliders */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-600 w-20 flex-shrink-0">Brightness</span>
            <input
              type="range" min={0} max={200} value={brightness}
              onChange={(e) => setBrightness(Number(e.target.value))}
              className="flex-1 accent-violet-600"
            />
            <span className="text-xs text-slate-500 w-10 text-right">{brightness}%</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-600 w-20 flex-shrink-0">Contrast</span>
            <input
              type="range" min={0} max={200} value={contrast}
              onChange={(e) => setContrast(Number(e.target.value))}
              className="flex-1 accent-violet-600"
            />
            <span className="text-xs text-slate-500 w-10 text-right">{contrast}%</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => { setBrightness(100); setContrast(100); setAspect("Free"); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <RotateCcw size={12} /> Reset
          </button>
          <button
            onClick={handleCopyUrl}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Copy size={12} /> {copied ? "Copied!" : "Copy URL"}
          </button>
          <button
            onClick={() => window.open(item.url, "_blank")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-700 transition-colors ml-auto"
          >
            <Download size={12} /> Download
          </button>
        </div>
      </div>
    </div>
  );
}

// ── MediaCard ─────────────────────────────────────────────────────────────────
function MediaCard({ item, onDelete, onEdit }) {
  const [deleting, setDeleting] = useState(false);
  const isImage = item.mime_type?.startsWith("image/");
  const isVideo = item.mime_type?.startsWith("video/");

  const handleDelete = async () => {
    setDeleting(true);
    try { await deleteMedia(item.media_id); onDelete(item.media_id); }
    catch { setDeleting(false); }
  };

  return (
    <div className="group relative bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
      <div className="aspect-square bg-slate-100 flex items-center justify-center overflow-hidden">
        {isImage ? (
          <img src={item.url} alt={item.filename} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = "none"; }} />
        ) : isVideo ? (
          <video src={item.url} className="w-full h-full object-cover" muted />
        ) : (
          <div className="text-slate-400 text-xs text-center px-2">
            <Tag size={24} className="mx-auto mb-1 opacity-40" />
            {item.filename}
          </div>
        )}
      </div>
      <div className="p-2.5">
        <p className="text-xs text-slate-700 truncate font-medium">{item.filename}</p>
        <p className="text-[10px] text-slate-400 mt-0.5">{item.mime_type} · {(item.size / 1024).toFixed(0)} KB</p>
        {item.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {item.tags.map((t) => (
              <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-600 font-medium">{t}</span>
            ))}
          </div>
        )}
      </div>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        {isImage && (
          <button
            onClick={() => onEdit(item)}
            title="Edit"
            className="p-1.5 bg-white rounded-lg shadow text-slate-500 hover:text-violet-600 transition-colors"
          >
            <Pencil size={11} />
          </button>
        )}
        <button
          onClick={() => navigator.clipboard.writeText(item.url)}
          title="Copy URL"
          className="p-1.5 bg-white rounded-lg shadow text-slate-500 hover:text-violet-600 transition-colors"
        >
          <Copy size={11} />
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          title="Delete"
          className="p-1.5 bg-white rounded-lg shadow text-slate-500 hover:text-red-500 transition-colors"
        >
          {deleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
        </button>
      </div>
    </div>
  );
}

// ── UploadZone ────────────────────────────────────────────────────────────────
function UploadZone({ onUploaded }) {
  const [dragging,  setDragging]  = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress,  setProgress]  = useState([]);
  const inputRef = useRef(null);

  const handleFiles = async (files) => {
    if (!files?.length) return;
    setUploading(true);
    const results = [];
    for (const file of Array.from(files)) {
      setProgress((p) => [...p, file.name]);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const { data } = await uploadMedia(fd);
        results.push(data);
      } catch {}
      setProgress((p) => p.filter((n) => n !== file.name));
    }
    setUploading(false);
    if (results.length) onUploaded(results);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors ${dragging ? "border-violet-400 bg-violet-50" : "border-slate-200 hover:border-violet-300 hover:bg-slate-50"}`}
    >
      <input ref={inputRef} type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
      {uploading ? (
        <>
          <Loader2 size={24} className="animate-spin text-violet-500 mb-2" />
          <p className="text-sm text-slate-500">Uploading {progress.join(", ")}…</p>
        </>
      ) : (
        <>
          <Upload size={24} className="text-slate-400 mb-2" />
          <p className="text-sm font-medium text-slate-700">Drop files here or click to upload</p>
          <p className="text-xs text-slate-400 mt-1">Images, videos, documents up to 50 MB</p>
        </>
      )}
    </div>
  );
}

// ── HashtagGroupCard ──────────────────────────────────────────────────────────
function HashtagGroupCard({ group, onDelete }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(group.hashtags.join(" "));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">{group.name}</p>
          <p className="text-xs text-slate-400 mt-0.5">{group.hashtags.length} tags</p>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={copy} title="Copy all" className="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors">
            {copied ? <span className="text-[9px] text-emerald-500 font-medium">Copied!</span> : <Copy size={13} />}
          </button>
          <button onClick={() => onDelete(group.group_id)} title="Delete" className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {group.hashtags.map((h) => (
          <span key={h} className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">{h}</span>
        ))}
      </div>
    </div>
  );
}

// ── NewGroupForm ──────────────────────────────────────────────────────────────
function NewGroupForm({ onCreated, onCancel }) {
  const [name,   setName]   = useState("");
  const [raw,    setRaw]    = useState("");
  const [saving, setSaving] = useState(false);

  const hashtags = raw
    .split(/[\s,]+/)
    .map((h) => (h.startsWith("#") ? h : `#${h}`))
    .filter((h) => h.length > 1);

  const handleSave = async () => {
    if (!name.trim() || hashtags.length === 0) return;
    setSaving(true);
    try {
      const { data } = await createHashtagGroup({ name: name.trim(), hashtags });
      onCreated(data);
    } catch {} finally { setSaving(false); }
  };

  return (
    <div className="bg-white rounded-xl border border-violet-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-slate-800">New hashtag group</p>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
      </div>
      <div className="space-y-2">
        <input
          type="text" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Group name (e.g. Travel)"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        <textarea
          value={raw} onChange={(e) => setRaw(e.target.value)}
          placeholder="#travel #wanderlust #photography"
          rows={2}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        {hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {hashtags.map((h) => <span key={h} className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-600">{h}</span>)}
          </div>
        )}
        <button
          onClick={handleSave}
          disabled={saving || !name.trim() || hashtags.length === 0}
          className="w-full py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving…" : "Save group"}
        </button>
      </div>
    </div>
  );
}

// ── BrandKitSection ───────────────────────────────────────────────────────────
function BrandKitSection() {
  const [brandKit,        setBrandKit]        = useState(null);
  const [editing,         setEditing]         = useState(false);
  const [saving,          setSaving]          = useState(false);
  const [draft,           setDraft]           = useState({});

  useEffect(() => {
    getBrandKit()
      .then(({ data }) => { setBrandKit(data); setDraft(data); })
      .catch(() => { setBrandKit({}); setDraft({}); });
  }, []);

  const startEdit = () => { setDraft({ ...(brandKit || {}) }); setEditing(true); };
  const cancelEdit = () => setEditing(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await updateBrandKit(draft);
      setBrandKit(data);
      setEditing(false);
    } catch {} finally { setSaving(false); }
  };

  const updateDraft = (key, val) => setDraft((d) => ({ ...d, [key]: val }));

  const addColor = () => setDraft((d) => ({ ...d, colors: [...(d.colors || []), "#6d28d9"] }));
  const removeColor = (i) => setDraft((d) => ({ ...d, colors: d.colors.filter((_, idx) => idx !== i) }));
  const setColor = (i, val) => setDraft((d) => {
    const colors = [...(d.colors || [])];
    colors[i] = val;
    return { ...d, colors };
  });

  const addFont = () => setDraft((d) => ({ ...d, fonts: [...(d.fonts || []), ""] }));
  const removeFont = (i) => setDraft((d) => ({ ...d, fonts: d.fonts.filter((_, idx) => idx !== i) }));
  const setFont = (i, val) => setDraft((d) => {
    const fonts = [...(d.fonts || [])];
    fonts[i] = val;
    return { ...d, fonts };
  });

  const isEmpty = !brandKit?.brand_name;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-800 flex items-center gap-2">
          <Palette size={15} className="text-violet-500" /> Brand Kit
        </h2>
        {!editing && (
          <button
            onClick={startEdit}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
          >
            <Edit2 size={11} /> {isEmpty ? "Set up" : "Edit"}
          </button>
        )}
      </div>

      {/* View mode */}
      {!editing && isEmpty && (
        <div className="flex flex-col items-center justify-center h-32 text-slate-400 text-center border border-dashed border-slate-200 rounded-xl">
          <Palette size={24} className="mb-2 opacity-40" />
          <p className="text-sm">No brand kit yet</p>
          <p className="text-xs mt-1">Add your brand colors, fonts, and logo</p>
        </div>
      )}

      {!editing && !isEmpty && (
        <div className="space-y-3">
          {brandKit.logo_url && (
            <img src={brandKit.logo_url} alt="Logo" className="h-10 object-contain" />
          )}
          <div>
            <p className="text-lg font-bold text-slate-900">{brandKit.brand_name}</p>
            {brandKit.tagline && <p className="text-sm italic text-slate-500 mt-0.5">{brandKit.tagline}</p>}
          </div>
          {brandKit.colors?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {brandKit.colors.map((c, i) => (
                <div key={i} title={c} className="w-6 h-6 rounded-full border border-slate-200 shadow-sm flex-shrink-0" style={{ background: c }} />
              ))}
            </div>
          )}
          {brandKit.fonts?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {brandKit.fonts.filter(Boolean).map((f, i) => (
                <span key={i} className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700 font-medium">{f}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit mode */}
      {editing && (
        <div className="space-y-3">
          <input
            type="text" value={draft.brand_name || ""} onChange={(e) => updateDraft("brand_name", e.target.value)}
            placeholder="Brand name"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <input
            type="text" value={draft.tagline || ""} onChange={(e) => updateDraft("tagline", e.target.value)}
            placeholder="Tagline (optional)"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <input
            type="text" value={draft.logo_url || ""} onChange={(e) => updateDraft("logo_url", e.target.value)}
            placeholder="Logo URL (optional)"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />

          {/* Colors */}
          <div>
            <p className="text-xs font-medium text-slate-600 mb-1.5">Brand colors</p>
            <div className="flex flex-wrap gap-2 items-center">
              {(draft.colors || []).map((c, i) => (
                <div key={i} className="flex items-center gap-1">
                  <input type="color" value={c} onChange={(e) => setColor(i, e.target.value)} className="w-7 h-7 rounded-lg border border-slate-200 cursor-pointer p-0.5" />
                  <button onClick={() => removeColor(i)} className="text-slate-400 hover:text-red-500 transition-colors"><X size={11} /></button>
                </div>
              ))}
              <button onClick={addColor} className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 transition-colors font-medium">
                <Plus size={12} /> Add
              </button>
            </div>
          </div>

          {/* Fonts */}
          <div>
            <p className="text-xs font-medium text-slate-600 mb-1.5">Fonts</p>
            <div className="space-y-1.5">
              {(draft.fonts || []).map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text" value={f} onChange={(e) => setFont(i, e.target.value)}
                    placeholder="e.g. Inter"
                    className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                  <button onClick={() => removeFont(i)} className="text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"><X size={11} /></button>
                </div>
              ))}
              <button onClick={addFont} className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 transition-colors font-medium">
                <Plus size={12} /> Add font
              </button>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={cancelEdit}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── UnsplashGrid ──────────────────────────────────────────────────────────────
function UnsplashGrid() {
  const [query,    setQuery]    = useState("");
  const [results,  setResults]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [page,     setPage]     = useState(1);
  const [hasMore,  setHasMore]  = useState(false);
  const [error,    setError]    = useState("");
  const [copiedId, setCopiedId] = useState(null);

  const doSearch = async (q, p, append = false) => {
    if (!q.trim()) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await searchUnsplash(q, p);
      if (data.error) { setError(data.error); setResults([]); setHasMore(false); return; }
      const newResults = data.results || [];
      setResults((prev) => append ? [...prev, ...newResults] : newResults);
      setHasMore(newResults.length === 20);
    } catch (e) {
      setError("Failed to search Unsplash. Please try again.");
    } finally { setLoading(false); }
  };

  const handleSearch = () => { setPage(1); doSearch(query, 1, false); };

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    doSearch(query, next, true);
  };

  const handleCopy = (photo) => {
    navigator.clipboard.writeText(photo.url_regular);
    setCopiedId(photo.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text" value={query} onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search free photos…"
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors"
        >
          {loading && results.length === 0 ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          Search
        </button>
      </div>

      {/* Error / empty state */}
      {error && (
        <div className="text-sm text-slate-500 bg-amber-50 border border-amber-100 rounded-xl p-4">
          {error.includes("UNSPLASH_ACCESS_KEY") || error.toLowerCase().includes("configure")
            ? "Configure UNSPLASH_ACCESS_KEY in backend .env to enable Unsplash search."
            : error}
        </div>
      )}

      {!error && results.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center h-40 text-slate-400 text-center">
          <Search size={28} className="mb-2 opacity-40" />
          <p className="text-sm">Search for photos to get started</p>
        </div>
      )}

      {/* Photo grid */}
      {results.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {results.map((photo) => (
            <div key={photo.id} className="group relative bg-slate-100 rounded-xl overflow-hidden aspect-square">
              <img
                src={photo.url_thumb}
                alt={photo.alt_description || "Unsplash photo"}
                className="w-full h-full object-cover"
              />
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                <button
                  onClick={() => handleCopy(photo)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg text-xs font-medium text-slate-800 hover:bg-slate-100 transition-colors w-full justify-center"
                >
                  <Copy size={11} />
                  {copiedId === photo.id ? "Copied!" : "Copy URL"}
                </button>
              </div>
              {/* Photographer credit */}
              {photo.author && (
                <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-[10px] text-white/80 truncate">by {photo.author}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && (
        <button
          onClick={handleLoadMore}
          disabled={loading}
          className="w-full py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : null}
          Load more
        </button>
      )}

      {/* Attribution */}
      {results.length > 0 && (
        <p className="text-[10px] text-slate-400 text-center">
          Photos by{" "}
          <a href="https://unsplash.com" target="_blank" rel="noreferrer" className="underline hover:text-slate-600">
            Unsplash
          </a>
        </p>
      )}
    </div>
  );
}

// ── Library (page) ────────────────────────────────────────────────────────────
export default function Library() {
  const [media,        setMedia]        = useState([]);
  const [groups,       setGroups]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [typeFilter,   setTypeFilter]   = useState("all");
  const [tagFilter,    setTagFilter]    = useState("");
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [editingMedia, setEditingMedia] = useState(null);
  const [libraryTab,   setLibraryTab]   = useState("mine"); // "mine" | "unsplash"

  useEffect(() => {
    Promise.all([getMedia({ limit: 200 }), getHashtagGroups()])
      .then(([{ data: m }, { data: g }]) => { setMedia(m); setGroups(g); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = media.filter((item) => {
    if (typeFilter !== "all") {
      const t = item.mime_type || "";
      if (typeFilter === "image"    && !t.startsWith("image/"))  return false;
      if (typeFilter === "video"    && !t.startsWith("video/"))  return false;
      if (typeFilter === "document" && (t.startsWith("image/") || t.startsWith("video/"))) return false;
    }
    if (tagFilter && !item.tags?.some((tag) => tag.toLowerCase().includes(tagFilter.toLowerCase()))) return false;
    return true;
  });

  const handleUploaded    = (newItems) => setMedia((prev) => [...newItems, ...prev]);
  const handleDeleteMedia = (id)       => setMedia((prev) => prev.filter((m) => m.media_id !== id));
  const handleDeleteGroup = async (id) => {
    try { await deleteHashtagGroup(id); setGroups((prev) => prev.filter((g) => g.group_id !== id)); } catch {}
  };

  return (
    <div className="p-8">
      {/* Image editor modal */}
      {editingMedia && (
        <ImageEditorModal item={editingMedia} onClose={() => setEditingMedia(null)} />
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Content Library</h1>
          <p className="text-slate-500 text-sm mt-0.5">{media.length} assets · {groups.length} hashtag groups</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* ── Media section ── */}
        <div className="xl:col-span-2 space-y-4">
          {/* Upload zone always visible */}
          <UploadZone onUploaded={handleUploaded} />

          {/* My Files / Unsplash tab switcher */}
          <div className="flex gap-1 border-b border-slate-100 pb-0">
            {[{ key: "mine", label: "My Files" }, { key: "unsplash", label: "Unsplash" }].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setLibraryTab(key)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
                  libraryTab === key
                    ? "border-violet-600 text-violet-700 bg-violet-50"
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ── My Files tab ── */}
          {libraryTab === "mine" && (
            <>
              {/* Type + tag filters */}
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  {TYPE_FILTERS.map((f) => (
                    <button
                      key={f}
                      onClick={() => setTypeFilter(f)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${typeFilter === f ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <div className="relative flex-1 max-w-xs">
                  <Tag size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={tagFilter}
                    onChange={(e) => setTagFilter(e.target.value)}
                    placeholder="Filter by tag…"
                    className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center h-40 text-slate-400 text-sm gap-2">
                  <Loader2 size={16} className="animate-spin" /> Loading…
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-slate-400 text-center">
                  <ImagePlus size={28} className="mb-2 opacity-40" />
                  <p className="text-sm">{media.length === 0 ? "No media yet — upload your first file above" : "No files match this filter"}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {filtered.map((item) => (
                    <MediaCard
                      key={item.media_id}
                      item={item}
                      onDelete={handleDeleteMedia}
                      onEdit={setEditingMedia}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── Unsplash tab ── */}
          {libraryTab === "unsplash" && <UnsplashGrid />}
        </div>

        {/* ── Right column ── */}
        <div className="space-y-6">
          {/* Brand Kit */}
          <BrandKitSection />

          {/* Hashtag groups */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                <Hash size={15} className="text-violet-500" /> Hashtag groups
              </h2>
              {!showNewGroup && (
                <button
                  onClick={() => setShowNewGroup(true)}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
                >
                  <Plus size={12} /> New group
                </button>
              )}
            </div>

            {showNewGroup && (
              <NewGroupForm
                onCreated={(g) => { setGroups((prev) => [g, ...prev]); setShowNewGroup(false); }}
                onCancel={() => setShowNewGroup(false)}
              />
            )}

            {groups.length === 0 && !showNewGroup ? (
              <div className="flex flex-col items-center justify-center h-40 text-slate-400 text-center border border-dashed border-slate-200 rounded-2xl">
                <Hash size={24} className="mb-2 opacity-40" />
                <p className="text-sm">No groups yet</p>
                <p className="text-xs mt-1">Create groups to reuse hashtags quickly</p>
              </div>
            ) : (
              <div className="space-y-3">
                {groups.map((g) => (
                  <HashtagGroupCard key={g.group_id} group={g} onDelete={handleDeleteGroup} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
