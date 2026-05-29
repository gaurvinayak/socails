import { Check, ClipboardCopy, Link2, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

const PLATFORM_PRESETS = [
  { label: "LinkedIn Carousel", source: "linkedin", medium: "social", campaign: "carousel" },
  { label: "LinkedIn Text Post", source: "linkedin", medium: "social", campaign: "text_post" },
  { label: "Twitter Thread", source: "twitter", medium: "social", campaign: "thread" },
  { label: "Twitter Single", source: "twitter", medium: "social", campaign: "tweet" },
  { label: "TikTok Video", source: "tiktok", medium: "social", campaign: "video" },
  { label: "YouTube Short", source: "youtube", medium: "social", campaign: "short" },
  { label: "YouTube Long-form", source: "youtube", medium: "social", campaign: "longform" },
  { label: "Instagram Reel", source: "instagram", medium: "social", campaign: "reel" },
  { label: "Facebook Post", source: "facebook", medium: "social", campaign: "post" },
];

function buildUTM({ baseUrl, source, medium, campaign, content, term }) {
  if (!baseUrl) return "";
  try {
    const url = new URL(baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`);
    if (source) url.searchParams.set("utm_source", source);
    if (medium) url.searchParams.set("utm_medium", medium);
    if (campaign) url.searchParams.set("utm_campaign", campaign);
    if (content) url.searchParams.set("utm_content", content);
    if (term) url.searchParams.set("utm_term", term);
    return url.toString();
  } catch {
    return "";
  }
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };
  return (
    <button onClick={handleCopy} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${copied ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
      {copied ? <Check size={12} /> : <ClipboardCopy size={12} />}
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function HistoryItem({ item, onDelete }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-100 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-700 truncate">{item.url}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {item.source && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">{item.source}</span>}
          {item.medium && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">{item.medium}</span>}
          {item.campaign && <span className="text-[10px] bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded font-mono">{item.campaign}</span>}
          {item.content && <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-mono">{item.content}</span>}
        </div>
      </div>
      <CopyButton text={item.url} />
      <button onClick={() => onDelete(item.id)} className="p-1.5 text-slate-300 hover:text-red-400 transition-colors">
        <Trash2 size={12} />
      </button>
    </div>
  );
}

export default function UTMBuilder() {
  const [form, setForm] = useState({
    baseUrl: "https://systemdesignlab.io",
    source: "linkedin",
    medium: "social",
    campaign: "",
    content: "",
    term: "",
  });
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem("utm_history") || "[]"); } catch { return []; }
  });
  const [copied, setCopied] = useState(false);

  const builtUrl = buildUTM(form);

  const saveHistory = (h) => {
    setHistory(h);
    localStorage.setItem("utm_history", JSON.stringify(h));
  };

  const handleSave = () => {
    if (!builtUrl) return;
    const item = { ...form, url: builtUrl, id: Date.now() };
    saveHistory([item, ...history.slice(0, 19)]);
  };

  const handleDelete = (id) => saveHistory(history.filter(h => h.id !== id));

  const handlePreset = (preset) => {
    setForm(f => ({ ...f, source: preset.source, medium: preset.medium, campaign: preset.campaign }));
  };

  const handleCopyAndSave = async () => {
    if (!builtUrl) return;
    try {
      await navigator.clipboard.writeText(builtUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      handleSave();
    } catch {}
  };

  const setField = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">UTM Link Builder</h1>
        <p className="text-slate-500 text-sm mt-1">
          Tag every link you share on social. Track in GA4 to see which post drives signups.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Builder */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2"><Link2 size={14} /> Build UTM URL</h2>

          {/* Quick presets */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-2">Quick presets</label>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORM_PRESETS.map(p => (
                <button key={p.label} onClick={() => handlePreset(p)} className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 text-slate-600 hover:border-violet-400 hover:text-violet-700 hover:bg-violet-50 transition-colors">
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Base URL *</label>
              <input value={form.baseUrl} onChange={setField("baseUrl")} placeholder="https://systemdesignlab.io/trial" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">utm_source *</label>
                <input value={form.source} onChange={setField("source")} placeholder="linkedin" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">utm_medium *</label>
                <input value={form.medium} onChange={setField("medium")} placeholder="social" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">utm_campaign *</label>
                <input value={form.campaign} onChange={setField("campaign")} placeholder="carousel_may_2026" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">utm_content</label>
                <input value={form.content} onChange={setField("content")} placeholder="slide_10_cta" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">utm_term <span className="text-slate-300 font-normal">(optional, for paid)</span></label>
              <input value={form.term} onChange={setField("term")} placeholder="system_design_interview" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono" />
            </div>
          </div>

          {/* Output */}
          {builtUrl && (
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
              <p className="text-xs font-medium text-slate-500 mb-2">Generated URL</p>
              <p className="text-xs font-mono text-slate-700 break-all leading-relaxed">{builtUrl}</p>
              <div className="flex items-center gap-2 mt-3">
                <button onClick={handleCopyAndSave} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${copied ? "bg-emerald-500 text-white" : "bg-violet-600 text-white hover:bg-violet-700"}`}>
                  {copied ? <Check size={12} /> : <ClipboardCopy size={12} />}
                  {copied ? "Copied & saved!" : "Copy & save"}
                </button>
                <button onClick={handleSave} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                  <Plus size={12} /> Save to history
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Info + History */}
        <div className="space-y-5">
          {/* GA4 setup guide */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-blue-800 mb-2">📊 Connect to GA4</h3>
            <ol className="text-xs text-blue-700 space-y-1.5 list-decimal list-inside">
              <li>In GA4 → Reports → Acquisition → Traffic Acquisition</li>
              <li>Filter by "Session source / medium" to see social posts</li>
              <li>Set up conversion events for <code className="bg-blue-100 px-1 rounded font-mono">/trial</code> and <code className="bg-blue-100 px-1 rounded font-mono">/signup</code></li>
              <li>After 90 days: which platform, which post drove most signups?</li>
            </ol>
            <div className="mt-3 bg-blue-100 rounded-lg px-3 py-2">
              <p className="text-[10px] text-blue-600 font-mono">utm_source=linkedin&utm_medium=social&utm_campaign=carousel_jan_2026</p>
            </div>
          </div>

          {/* Saved history */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-800">Saved links</h3>
              {history.length > 0 && (
                <button onClick={() => saveHistory([])} className="text-xs text-slate-400 hover:text-red-400 transition-colors">Clear all</button>
              )}
            </div>
            {history.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-slate-300">
                <Link2 size={24} className="mb-2" />
                <p className="text-xs">No saved links yet</p>
              </div>
            ) : (
              <div>
                {history.slice(0, 10).map(h => <HistoryItem key={h.id} item={h} onDelete={handleDelete} />)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
