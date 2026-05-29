import {
  AlertCircle, ArrowRightLeft, CheckCircle2, ChevronDown, ClipboardCopy, Clock, Image,
  Loader2, Plus, Sparkles, Trash2, X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import api, {
  createPost, generateCaption, getAccounts, getBestTimes, publishPost, repurposePost,
} from "../api";

// ── Repurpose Panel ──────────────────────────────────────────────────────────

const REPURPOSE_PLATFORMS = [
  { id: "twitter", label: "X / Twitter", color: "#000" },
  { id: "linkedin", label: "LinkedIn", color: "#0A66C2" },
  { id: "instagram", label: "Instagram", color: "#E1306C" },
  { id: "tiktok", label: "TikTok", color: "#ff0050" },
  { id: "youtube", label: "YouTube Desc", color: "#FF0000" },
  { id: "facebook", label: "Facebook", color: "#1877F2" },
];

function RepurposePanel({ content, sourcePlatform, onClose, onUse }) {
  const [targets, setTargets] = useState(["twitter", "linkedin"]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState({});
  const [copied, setCopied] = useState(null);

  const toggleTarget = (id) => {
    setTargets(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  };

  const handleGenerate = async () => {
    if (!content.trim() || targets.length === 0) return;
    setLoading(true);
    setResults({});
    try {
      const { data } = await repurposePost(content, sourcePlatform, targets);
      setResults(data.repurposed || {});
    } catch {
      setResults({ error: "Repurpose failed — check ANTHROPIC_API_KEY" });
    } finally { setLoading(false); }
  };

  const handleCopy = async (plat) => {
    try {
      await navigator.clipboard.writeText(results[plat]);
      setCopied(plat);
      setTimeout(() => setCopied(null), 2000);
    } catch {}
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <ArrowRightLeft size={16} className="text-violet-600" />
            <h2 className="font-semibold text-slate-800">Repurpose this post</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          <div>
            <p className="text-xs font-medium text-slate-500 mb-2">Repurpose for</p>
            <div className="flex flex-wrap gap-2">
              {REPURPOSE_PLATFORMS.filter(p => p.id !== sourcePlatform).map(p => (
                <button
                  key={p.id}
                  onClick={() => toggleTarget(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${targets.includes(p.id) ? "text-white border-transparent" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"}`}
                  style={targets.includes(p.id) ? { backgroundColor: p.color, borderColor: p.color } : {}}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {Object.keys(results).length === 0 && !loading && (
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs text-slate-500 font-medium mb-1">Original post ({sourcePlatform})</p>
              <p className="text-sm text-slate-700 line-clamp-4">{content}</p>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
              <Loader2 size={18} className="animate-spin text-violet-500" />
              <span className="text-sm">Repurposing with AI…</span>
            </div>
          )}

          {Object.entries(results).map(([plat, text]) => {
            if (plat === "error") return <div key="error" className="text-xs text-red-500 bg-red-50 rounded-xl p-3">{text}</div>;
            const meta = REPURPOSE_PLATFORMS.find(p => p.id === plat);
            return (
              <div key={plat} className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
                  <span className="text-xs font-bold px-2 py-0.5 rounded text-white" style={{ backgroundColor: meta?.color || "#64748b" }}>{meta?.label || plat}</span>
                  <div className="flex gap-2">
                    <button onClick={() => handleCopy(plat)} className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors ${copied === plat ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                      <ClipboardCopy size={11} /> {copied === plat ? "Copied!" : "Copy"}
                    </button>
                    <button onClick={() => { onUse(text); onClose(); }} className="text-xs px-2 py-1 rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors">
                      Use in Composer
                    </button>
                  </div>
                </div>
                <div className="px-4 py-3 max-h-40 overflow-y-auto">
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{text}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-5 py-4 border-t border-slate-100">
          <button
            onClick={handleGenerate}
            disabled={loading || targets.length === 0 || !content.trim()}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 disabled:opacity-40 transition-colors"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowRightLeft size={14} />}
            {loading ? "Repurposing…" : `Repurpose for ${targets.length} platform${targets.length !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Constants ────────────────────────────────────────────────────────────────

const CHAR_LIMITS = { instagram: 2200, twitter: 280, linkedin: 3000, facebook: 63206, tiktok: 2200, youtube: 5000 };

const PLATFORM_META = {
  instagram: { label: "Instagram", color: "#E1306C", bg: "bg-pink-500" },
  twitter:   { label: "X (Twitter)", color: "#000", bg: "bg-black" },
  linkedin:  { label: "LinkedIn", color: "#0A66C2", bg: "bg-blue-700" },
  facebook:  { label: "Facebook", color: "#1877F2", bg: "bg-blue-600" },
  tiktok:    { label: "TikTok", color: "#ff0050", bg: "bg-red-500" },
  youtube:   { label: "YouTube", color: "#FF0000", bg: "bg-red-600" },
};

// ── Thread helper ─────────────────────────────────────────────────────────────

function splitIntoTweets(text, limit = 280) {
  const words = text.split(" ");
  const tweets = [];
  let current = "";
  for (const word of words) {
    if ((current + (current ? " " : "") + word).length <= limit) {
      current += (current ? " " : "") + word;
    } else {
      if (current) tweets.push(current);
      current = word;
    }
  }
  if (current) tweets.push(current);
  return tweets.length ? tweets : [""];
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function CharBar({ text, platform }) {
  const limit = CHAR_LIMITS[platform] || 63206;
  const pct = Math.min((text.length / limit) * 100, 100);
  const over = text.length > limit;
  const color = over ? "bg-red-500" : pct > 85 ? "bg-amber-400" : "bg-emerald-400";
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs tabular-nums ${over ? "text-red-500 font-semibold" : "text-slate-400"}`}>
        {text.length}/{limit}
      </span>
    </div>
  );
}

function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);
  if (!toast) return null;
  const isErr = toast.type === "error";
  return (
    <div className={`fixed bottom-6 right-6 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium z-50 ${isErr ? "bg-red-600" : "bg-emerald-600"} text-white`}>
      {isErr ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
      {toast.message}
    </div>
  );
}

// ── Platform preview cards ────────────────────────────────────────────────────

function TwitterPreview({ account, content, mediaUrls, threadMode, tweetCards }) {
  if (threadMode && tweetCards && tweetCards.length > 0) {
    return (
      <div className="border border-slate-200 rounded-xl bg-white divide-y divide-slate-100">
        {tweetCards.map((card, idx) => (
          <div key={idx} className="p-4 flex items-start gap-3">
            <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden">
                {account.profile_image_url && <img src={account.profile_image_url} alt="" className="w-full h-full object-cover" />}
              </div>
              {idx < tweetCards.length - 1 && <div className="w-0.5 flex-1 min-h-4 bg-slate-200 mt-1" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="font-bold text-sm text-slate-900">{account.display_name}</span>
                <span className="text-slate-400 text-sm">@{account.username}</span>
              </div>
              <p className="text-sm text-slate-800 mt-1 whitespace-pre-wrap break-words">
                {card || <span className="text-slate-300 italic">Tweet {idx + 1}…</span>}
              </p>
              {idx === 0 && mediaUrls[0] && <img src={mediaUrls[0]} alt="" className="mt-2 rounded-xl max-h-48 w-full object-cover" onError={(e) => e.target.style.display = "none"} />}
              <p className="text-xs text-slate-400 mt-2">{idx + 1}/{tweetCards.length} · Just now</p>
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="border border-slate-200 rounded-xl p-4 bg-white">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-slate-200 flex-shrink-0 overflow-hidden">
          {account.profile_image_url && <img src={account.profile_image_url} alt="" className="w-full h-full object-cover" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="font-bold text-sm text-slate-900">{account.display_name}</span>
            <span className="text-slate-400 text-sm">@{account.username}</span>
          </div>
          <p className="text-sm text-slate-800 mt-1 whitespace-pre-wrap break-words">{content || <span className="text-slate-300 italic">Start typing your post…</span>}</p>
          {mediaUrls[0] && <img src={mediaUrls[0]} alt="" className="mt-2 rounded-xl max-h-48 w-full object-cover" onError={(e) => e.target.style.display = "none"} />}
          <p className="text-xs text-slate-400 mt-2">Just now · X for Web</p>
        </div>
      </div>
    </div>
  );
}

function InstagramPreview({ account, content, mediaUrls, contentFormat }) {
  const isVertical = contentFormat === "story" || contentFormat === "reel";
  const mediaClass = isVertical ? "w-full aspect-[9/16] object-cover" : "w-full h-48 object-cover";
  const placeholderClass = isVertical ? "aspect-[9/16] bg-slate-100 flex items-center justify-center" : "h-32 bg-slate-100 flex items-center justify-center";
  const formatLabel = contentFormat === "story" ? "Story" : contentFormat === "reel" ? "Reel" : null;
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 p-0.5">
          <div className="w-full h-full rounded-full bg-white overflow-hidden">
            {account.profile_image_url && <img src={account.profile_image_url} alt="" className="w-full h-full object-cover" />}
          </div>
        </div>
        <span className="font-semibold text-sm text-slate-900">{account.username}</span>
        {formatLabel && <span className="ml-auto text-xs text-pink-500 font-semibold">{formatLabel}</span>}
      </div>
      {mediaUrls[0]
        ? <img src={mediaUrls[0]} alt="" className={mediaClass} onError={(e) => e.target.style.display = "none"} />
        : <div className={placeholderClass}><Image size={28} className="text-slate-300" /></div>
      }
      <div className="px-3 py-2">
        {isVertical
          ? <p className="text-xs text-slate-400 italic">Stories/Reels: caption optional</p>
          : <p className="text-sm text-slate-800 whitespace-pre-wrap break-words line-clamp-3">{content || <span className="text-slate-300 italic">Your caption here…</span>}</p>
        }
        <p className="text-xs text-slate-400 mt-1">2 minutes ago</p>
      </div>
    </div>
  );
}

function LinkedInPreview({ account, content }) {
  return (
    <div className="border border-slate-200 rounded-xl p-4 bg-white">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-10 h-10 rounded-full bg-blue-100 overflow-hidden flex-shrink-0">
          {account.profile_image_url && <img src={account.profile_image_url} alt="" className="w-full h-full object-cover" />}
        </div>
        <div>
          <p className="font-semibold text-sm text-slate-900">{account.display_name}</p>
          <p className="text-xs text-slate-400">Just now · 🌐</p>
        </div>
      </div>
      <p className="text-sm text-slate-800 whitespace-pre-wrap break-words line-clamp-4">{content || <span className="text-slate-300 italic">Your post…</span>}</p>
    </div>
  );
}

function FacebookPreview({ account, content, mediaUrls }) {
  return (
    <div className="border border-slate-200 rounded-xl p-4 bg-white">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-10 h-10 rounded-full bg-blue-100 overflow-hidden flex-shrink-0">
          {account.profile_image_url && <img src={account.profile_image_url} alt="" className="w-full h-full object-cover" />}
        </div>
        <div>
          <p className="font-semibold text-sm text-slate-900">{account.display_name}</p>
          <p className="text-xs text-slate-400">Just now · 🌐</p>
        </div>
      </div>
      <p className="text-sm text-slate-800 whitespace-pre-wrap break-words">{content || <span className="text-slate-300 italic">What's on your mind?</span>}</p>
      {mediaUrls[0] && <img src={mediaUrls[0]} alt="" className="mt-2 rounded-lg max-h-48 w-full object-cover" onError={(e) => e.target.style.display = "none"} />}
    </div>
  );
}

const PREVIEW_MAP = { twitter: TwitterPreview, instagram: InstagramPreview, linkedin: LinkedInPreview, facebook: FacebookPreview };

function PostPreview({ account, content, mediaUrls, threadMode, tweetCards, contentFormat }) {
  const Preview = PREVIEW_MAP[account.platform];
  if (!Preview) return null;
  const meta = PLATFORM_META[account.platform];
  return (
    <div>
      <div className={`text-white text-xs font-semibold px-2 py-1 rounded-t-lg inline-block ${meta.bg}`}>{meta.label}</div>
      <Preview
        account={account}
        content={content}
        mediaUrls={mediaUrls}
        threadMode={threadMode}
        tweetCards={tweetCards}
        contentFormat={contentFormat}
      />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Composer() {
  const [accounts, setAccounts] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [content, setContent] = useState("");
  const [perPlatform, setPerPlatform] = useState(false);
  const [overrides, setOverrides] = useState({});
  const [mediaUrls, setMediaUrls] = useState([]);
  const [altTexts, setAltTexts] = useState([]);
  const [urlInput, setUrlInput] = useState("");
  const [scheduleMode, setScheduleMode] = useState("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiCaptions, setAiCaptions] = useState([]);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [bestTimes, setBestTimes] = useState([]);
  // Feature: Thread Mode (Twitter)
  const [threadMode, setThreadMode] = useState(false);
  const [tweetCards, setTweetCards] = useState([""]);
  // Feature: Content Format (Instagram)
  const [contentFormat, setContentFormat] = useState("feed");
  // Feature: Poll
  const [showPoll, setShowPoll] = useState(false);
  const [poll, setPoll] = useState({ options: ["", ""], duration_days: 1 });
  // Feature: First Comment (Instagram)
  const [firstComment, setFirstComment] = useState("");
  // Feature: Repurpose
  const [showRepurpose, setShowRepurpose] = useState(false);

  useEffect(() => {
    getAccounts().then(({ data }) => setAccounts(data)).catch(() => {});
  }, []);

  const selectedAccounts = accounts.filter((a) => selectedIds.has(a.account_id));
  const hasTwitter = selectedAccounts.some((a) => a.platform === "twitter");
  const twitterAccount = selectedAccounts.find((a) => a.platform === "twitter");
  const hasInstagram = selectedAccounts.some((a) => a.platform === "instagram");
  const hasPollPlatform = selectedAccounts.some((a) =>
    ["twitter", "linkedin", "facebook"].includes(a.platform)
  );
  const hasInstagramOrTikTok = selectedAccounts.some(a => ["instagram", "tiktok"].includes(a.platform));

  const contentFor = useCallback(
    (account) => (perPlatform && overrides[account.account_id]) || content,
    [perPlatform, overrides, content]
  );

  const isValid = () => {
    if (selectedIds.size === 0) return false;
    if (!content.trim() && !Object.values(overrides).some((v) => v?.trim())) return false;
    for (const acc of selectedAccounts) {
      const txt = contentFor(acc);
      const limit = CHAR_LIMITS[acc.platform] || 63206;
      if (txt.length > limit) return false;
    }
    if (scheduleMode === "schedule" && !scheduledAt) return false;
    return true;
  };

  const handleSubmit = async (action) => {
    setBusy(true);
    try {
      // Thread mode: submit as a thread for Twitter
      if (threadMode && hasTwitter && twitterAccount) {
        const scheduledIso = scheduleMode === "schedule" && scheduledAt ? new Date(scheduledAt).toISOString() : null;
        await api.post("/api/v1/posts/thread", {
          posts: tweetCards.map((cardContent) => ({
            content: cardContent,
            platform: "twitter",
            account_id: twitterAccount.account_id,
            media_urls: [],
            scheduled_at: scheduledIso,
          })),
          scheduled_at: scheduledIso,
        });
        setToast({ type: "success", message: `Thread (${tweetCards.length} tweets) submitted` });
        setContent(""); setTweetCards([""]); setOverrides({}); setMediaUrls([]); setAltTexts([]);
        setScheduledAt(""); setSelectedIds(new Set()); setAiCaptions([]);
        setShowPoll(false); setPoll({ options: ["", ""], duration_days: 1 }); setFirstComment("");
        return;
      }

      let count = 0;
      for (const acc of selectedAccounts) {
        const body = {
          account_id: acc.account_id,
          content: contentFor(acc),
          media_urls: mediaUrls,
          alt_texts: altTexts,
          scheduled_at: scheduleMode === "schedule" && scheduledAt ? new Date(scheduledAt).toISOString() : null,
          content_format: acc.platform === "instagram" ? contentFormat : undefined,
          ...(showPoll && poll.options.some((o) => o.trim()) ? {
            poll: {
              options: poll.options.filter((o) => o.trim()),
              duration_minutes: poll.duration_days * 24 * 60,
            },
          } : {}),
          ...(acc.platform === "instagram" && firstComment.trim() ? { first_comment: firstComment } : {}),
        };
        const { data: post } = await createPost(body);
        if (action === "publish") await publishPost(post.post_id);
        count++;
      }
      const verb = action === "publish" ? "published" : action === "schedule" ? "scheduled" : "saved as draft";
      setToast({ type: "success", message: `${count} post${count > 1 ? "s" : ""} ${verb}` });
      setContent(""); setOverrides({}); setMediaUrls([]); setAltTexts([]); setScheduledAt("");
      setSelectedIds(new Set()); setAiCaptions([]); setShowPoll(false);
      setPoll({ options: ["", ""], duration_days: 1 }); setFirstComment(""); setTweetCards([""]);
    } catch (err) {
      setToast({ type: "error", message: err.response?.data?.detail || "Failed to post" });
    } finally {
      setBusy(false);
    }
  };

  const handleGenerateCaption = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const platform = selectedAccounts[0]?.platform;
      const { data } = await generateCaption(aiPrompt, platform, "engaging");
      setAiCaptions(data.captions);
    } catch {
      setToast({ type: "error", message: "AI caption generation failed — check ANTHROPIC_API_KEY" });
    } finally {
      setAiLoading(false);
    }
  };

  const loadBestTimes = async () => {
    const platform = selectedAccounts[0]?.platform;
    if (!platform) return;
    try {
      const { data } = await getBestTimes(platform);
      setBestTimes(data.suggestions);
    } catch {}
  };

  const minDatetime = new Date(Date.now() + 5 * 60000).toISOString().slice(0, 16);

  return (
    <div className="p-8 flex gap-6 min-h-screen">
      {/* ── Left panel ── */}
      <div className="flex-1 max-w-xl space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Composer</h1>
            <p className="text-slate-500 text-sm mt-1">Write once, post to multiple platforms.</p>
          </div>
          {content.trim() && (
            <button
              onClick={() => setShowRepurpose(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              <ArrowRightLeft size={14} /> Repurpose
            </button>
          )}
        </div>

        {/* Account selector */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Post to</h2>
          {accounts.length === 0 ? (
            <p className="text-sm text-slate-400">No accounts connected. <a href="/accounts" className="text-violet-600 hover:underline">Connect one →</a></p>
          ) : (
            <div className="space-y-2">
              {accounts.map((acc) => {
                const meta = PLATFORM_META[acc.platform];
                const checked = selectedIds.has(acc.account_id);
                return (
                  <label key={acc.account_id} className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer border transition-colors ${checked ? "border-violet-300 bg-violet-50" : "border-transparent hover:bg-slate-50"}`}>
                    <input type="checkbox" checked={checked} onChange={() => {
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        checked ? next.delete(acc.account_id) : next.add(acc.account_id);
                        return next;
                      });
                    }} className="accent-violet-600" />
                    <div className={`w-2 h-2 rounded-full flex-shrink-0`} style={{ backgroundColor: meta?.color }} />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-slate-800 truncate">{acc.display_name || acc.username}</span>
                      <span className="text-xs text-slate-400 ml-1">@{acc.username} · {meta?.label}</span>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
          {selectedAccounts.length > 1 && (
            <label className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 text-sm text-slate-600 cursor-pointer">
              <input type="checkbox" checked={perPlatform} onChange={(e) => setPerPlatform(e.target.checked)} className="accent-violet-600" />
              Write different content per platform
            </label>
          )}
        </section>

        {/* Content */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-slate-700">Content</h2>
            <div className="flex items-center gap-2">
              {/* Content Format — Instagram only */}
              {hasInstagram && (
                <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5">
                  {["feed", "story", "reel"].map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => setContentFormat(fmt)}
                      className={`px-2 py-0.5 rounded-md text-xs font-medium transition-colors capitalize ${contentFormat === fmt ? "bg-white text-violet-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                    >
                      {fmt.charAt(0).toUpperCase() + fmt.slice(1)}
                    </button>
                  ))}
                </div>
              )}
              <button onClick={() => setShowAiPanel((v) => !v)} className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 font-medium">
                <Sparkles size={13} /> AI caption
              </button>
            </div>
          </div>

          {showAiPanel && (
            <div className="mb-4 p-3 bg-violet-50 rounded-xl border border-violet-200">
              <p className="text-xs text-violet-700 font-medium mb-2">Describe your post idea</p>
              <div className="flex gap-2">
                <input value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="e.g. Launch our new product feature…" className="flex-1 text-sm border border-violet-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400" onKeyDown={(e) => e.key === "Enter" && handleGenerateCaption()} />
                <button onClick={handleGenerateCaption} disabled={aiLoading || !aiPrompt.trim()} className="px-3 py-1.5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 flex items-center gap-1.5">
                  {aiLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Generate
                </button>
              </div>
              {aiCaptions.length > 0 && (
                <div className="mt-3 space-y-2">
                  {aiCaptions.map((cap, i) => (
                    <button key={i} onClick={() => { setContent(cap); setShowAiPanel(false); }} className="w-full text-left text-xs p-2.5 bg-white rounded-lg border border-violet-200 hover:border-violet-400 hover:bg-violet-50 transition-colors text-slate-700 line-clamp-2">
                      {cap}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {!perPlatform ? (
            <>
              {/* Thread Mode toggle — only when Twitter is selected */}
              {hasTwitter && (
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={() => {
                      const next = !threadMode;
                      setThreadMode(next);
                      if (next) setTweetCards(splitIntoTweets(content));
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${threadMode ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"}`}
                  >
                    Thread {threadMode ? "ON" : "OFF"}
                  </button>
                  {threadMode && (
                    <span className="text-xs text-slate-400">{tweetCards.length} tweet{tweetCards.length !== 1 ? "s" : ""}</span>
                  )}
                </div>
              )}

              {threadMode && hasTwitter ? (
                /* Thread cards editor */
                <div className="space-y-3">
                  {tweetCards.map((card, idx) => (
                    <div key={idx} className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-slate-500">Tweet {idx + 1} of {tweetCards.length}</span>
                        <span className={`text-xs tabular-nums ${card.length > 280 ? "text-red-500 font-semibold" : "text-slate-400"}`}>{card.length}/280</span>
                      </div>
                      <textarea
                        value={card}
                        onChange={(e) => {
                          const updated = [...tweetCards];
                          updated[idx] = e.target.value;
                          setTweetCards(updated);
                          setContent(updated.join("\n\n---\n\n"));
                        }}
                        rows={3}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
                      />
                    </div>
                  ))}
                  <button
                    onClick={() => setTweetCards((prev) => [...prev, ""])}
                    className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 font-medium"
                  >
                    <Plus size={13} /> Add tweet
                  </button>
                </div>
              ) : (
                <>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="What's happening?"
                    rows={5}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                  {hasInstagram && (contentFormat === "story" || contentFormat === "reel") && (
                    <p className="text-xs text-slate-400 mt-1 italic">Stories/Reels: caption optional</p>
                  )}
                  {selectedAccounts.map((acc) => (
                    <CharBar key={acc.account_id} text={content} platform={acc.platform} />
                  ))}
                </>
              )}
            </>
          ) : (
            <div className="space-y-3">
              {selectedAccounts.map((acc) => {
                const meta = PLATFORM_META[acc.platform];
                return (
                  <div key={acc.account_id}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: meta?.color }} />
                      <span className="text-xs font-medium text-slate-600">{meta?.label} — @{acc.username}</span>
                    </div>
                    <textarea
                      value={overrides[acc.account_id] ?? content}
                      onChange={(e) => setOverrides((prev) => ({ ...prev, [acc.account_id]: e.target.value }))}
                      rows={3}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                    <CharBar text={overrides[acc.account_id] ?? content} platform={acc.platform} />
                  </div>
                );
              })}
            </div>
          )}

          {/* First Comment — Instagram only */}
          {hasInstagram && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">First comment (post hashtags here)</label>
              <textarea
                value={firstComment}
                onChange={(e) => setFirstComment(e.target.value)}
                placeholder="#hashtag1 #hashtag2 — posted as first comment after publish"
                rows={2}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-400 bg-slate-50"
              />
            </div>
          )}

          {/* Poll Creator — Twitter, LinkedIn, Facebook */}
          {hasPollPlatform && (
            <div className="mt-3">
              {!showPoll ? (
                <button
                  onClick={() => setShowPoll(true)}
                  className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 font-medium"
                >
                  <Plus size={13} /> Add Poll
                </button>
              ) : (
                <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-700">Poll</span>
                    <button onClick={() => setShowPoll(false)} className="text-slate-400 hover:text-slate-600"><X size={13} /></button>
                  </div>
                  <div className="space-y-1.5 mb-2">
                    {poll.options.map((opt, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          value={opt}
                          onChange={(e) => setPoll((prev) => {
                            const opts = [...prev.options];
                            opts[idx] = e.target.value;
                            return { ...prev, options: opts };
                          })}
                          placeholder={`Option ${idx + 1}`}
                          className="flex-1 text-sm border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-400"
                        />
                        {poll.options.length > 2 && (
                          <button
                            onClick={() => setPoll((prev) => ({ ...prev, options: prev.options.filter((_, i) => i !== idx) }))}
                            className="text-slate-400 hover:text-red-500"
                          ><X size={13} /></button>
                        )}
                      </div>
                    ))}
                  </div>
                  {poll.options.length < 4 && (
                    <button
                      onClick={() => setPoll((prev) => ({ ...prev, options: [...prev.options, ""] }))}
                      className="text-xs text-violet-600 hover:text-violet-700 font-medium flex items-center gap-1 mb-2"
                    >
                      <Plus size={12} /> Add option
                    </button>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-slate-500 font-medium">Duration:</span>
                    {[1, 3, 7].map((d) => (
                      <label key={d} className="flex items-center gap-1 text-xs cursor-pointer">
                        <input
                          type="radio"
                          className="accent-violet-600"
                          checked={poll.duration_days === d}
                          onChange={() => setPoll((prev) => ({ ...prev, duration_days: d }))}
                        />
                        {d} day{d > 1 ? "s" : ""}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Media */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Media URLs</h2>
          <div className="space-y-3">
            {mediaUrls.map((url, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center gap-2">
                  <input value={url} readOnly className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50 text-slate-600" />
                  <button
                    onClick={() => {
                      setMediaUrls((prev) => prev.filter((_, j) => j !== i));
                      setAltTexts((prev) => prev.filter((_, j) => j !== i));
                    }}
                    className="text-slate-400 hover:text-red-500"
                  ><Trash2 size={14} /></button>
                </div>
                <input
                  value={altTexts[i] || ""}
                  onChange={(e) => setAltTexts((prev) => {
                    const next = [...prev];
                    next[i] = e.target.value;
                    return next;
                  })}
                  placeholder="Alt text (accessibility)"
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-400 text-slate-600 bg-slate-50"
                />
              </div>
            ))}
            <div className="flex gap-2">
              <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="Paste an image or video URL" className="flex-1 text-sm border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500" onKeyDown={(e) => {
                if (e.key === "Enter" && urlInput.trim()) {
                  setMediaUrls((prev) => [...prev, urlInput.trim()]);
                  setAltTexts((prev) => [...prev, ""]);
                  setUrlInput("");
                }
              }} />
              <button
                onClick={() => {
                  if (urlInput.trim()) {
                    setMediaUrls((p) => [...p, urlInput.trim()]);
                    setAltTexts((p) => [...p, ""]);
                    setUrlInput("");
                  }
                }}
                className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200 flex items-center gap-1"
              >
                <Plus size={13} /> Add
              </button>
            </div>
          </div>
        </section>

        {/* Schedule */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">When to post</h2>
          <div className="flex gap-3 mb-3">
            {[["now", "Publish now"], ["schedule", "Schedule"]].map(([val, label]) => (
              <label key={val} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border cursor-pointer text-sm font-medium transition-colors ${scheduleMode === val ? "border-violet-500 bg-violet-50 text-violet-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                <input type="radio" className="sr-only" checked={scheduleMode === val} onChange={() => setScheduleMode(val)} />
                {val === "now" ? <CheckCircle2 size={14} /> : <Clock size={14} />} {label}
              </label>
            ))}
          </div>
          {scheduleMode === "schedule" && (
            <div className="space-y-2">
              <input type="datetime-local" value={scheduledAt} min={minDatetime} onChange={(e) => setScheduledAt(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              <button onClick={loadBestTimes} className="text-xs text-violet-600 hover:underline flex items-center gap-1">
                <Clock size={12} /> Suggest best times for {selectedAccounts[0] ? PLATFORM_META[selectedAccounts[0].platform]?.label : "platform"}
              </button>
              {bestTimes.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-1">
                  {bestTimes.map((bt, i) => (
                    <button key={i} onClick={() => {
                      const d = new Date(); d.setHours(parseInt(bt.time.split(":")[0])); d.setMinutes(0);
                      setScheduledAt(d.toISOString().slice(0, 16));
                    }} className="text-xs px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full hover:bg-violet-100 hover:text-violet-700 transition-colors">
                      {bt.day} {bt.time}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button onClick={() => handleSubmit("draft")} disabled={busy || selectedIds.size === 0 || !content.trim()} className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 disabled:opacity-40 transition-colors">
            Save draft
          </button>
          <button onClick={() => handleSubmit(scheduleMode === "schedule" ? "schedule" : "publish")} disabled={busy || !isValid()} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-700 disabled:opacity-40 transition-colors">
            {busy ? <Loader2 size={15} className="animate-spin" /> : null}
            {scheduleMode === "schedule" ? "Schedule" : "Publish now"}
            {selectedIds.size > 1 && ` (${selectedIds.size})`}
          </button>
        </div>
      </div>

      {/* ── Right panel — preview ── */}
      <div className="w-80 flex-shrink-0">
        <h2 className="text-sm font-semibold text-slate-700 mb-3 mt-10">Preview</h2>
        {selectedAccounts.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-8 text-center text-slate-400 text-sm">
            Select accounts to preview your post
          </div>
        ) : (
          <div className="space-y-4">
            {selectedAccounts.map((acc) => (
              <PostPreview
                key={acc.account_id}
                account={acc}
                content={contentFor(acc)}
                mediaUrls={mediaUrls}
                threadMode={threadMode && acc.platform === "twitter"}
                tweetCards={threadMode && acc.platform === "twitter" ? tweetCards : undefined}
                contentFormat={acc.platform === "instagram" ? contentFormat : undefined}
              />
            ))}
          </div>
        )}
      </div>

      <Toast toast={toast} onDismiss={() => setToast(null)} />

      {showRepurpose && (
        <RepurposePanel
          content={content}
          sourcePlatform={selectedAccounts[0]?.platform || "linkedin"}
          onClose={() => setShowRepurpose(false)}
          onUse={(text) => setContent(text)}
        />
      )}
    </div>
  );
}
