import {
  AlertCircle, Archive, Bell, CheckCheck, FileText, Filter, Loader2,
  MessageCircle, RefreshCw, Send, Tag, Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import api, { getInbox, replyToItem, tagMessage, updateInboxItem } from "../api";

// ── Inline API helpers ─────────────────────────────────────────────────────
const fetchTemplates  = ()          => api.get("/api/v1/inbox/templates");
const createTemplate  = (name, content) => api.post("/api/v1/inbox/templates", { name, content });
const deleteTemplate  = (id)        => api.delete(`/api/v1/inbox/templates/${id}`);

const fetchAlerts     = ()          => api.get("/api/v1/alerts");
const createAlert     = (keyword)   => api.post("/api/v1/alerts", { keyword, platforms: [] });
const deleteAlert     = (id)        => api.delete(`/api/v1/alerts/${id}`);

const analyzeSentiment = (content)  => api.post("/api/v1/ai/sentiment", { content });
// ──────────────────────────────────────────────────────────────────────────

const PLATFORM_COLORS = {
  instagram: "#E1306C", twitter: "#000", linkedin: "#0A66C2", facebook: "#1877F2",
};

const TAG_STYLES = {
  Question:  "bg-blue-100 text-blue-700",
  Complaint: "bg-red-100 text-red-700",
  Praise:    "bg-emerald-100 text-emerald-700",
  Spam:      "bg-slate-100 text-slate-500",
  Other:     "bg-amber-100 text-amber-700",
};

const SENTIMENT_STYLES = {
  positive: "bg-emerald-100 text-emerald-700",
  negative: "bg-red-100 text-red-700",
  neutral:  "bg-slate-100 text-slate-500",
};
const SENTIMENT_INDICATORS = { positive: "+", negative: "−", neutral: "·" };

const STATUS_LABELS = { unread: "Unread", read: "Read", done: "Done", archived: "Archived" };

function timeAgo(isoStr) {
  if (!isoStr) return "";
  const diff = (Date.now() - new Date(isoStr).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function SentimentBadge({ sentiment }) {
  if (!sentiment) return null;
  const style = SENTIMENT_STYLES[sentiment] || SENTIMENT_STYLES.neutral;
  const indicator = SENTIMENT_INDICATORS[sentiment] || "·";
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${style}`}>
      <span>{indicator}</span>
      <span className="capitalize">{sentiment}</span>
    </span>
  );
}

function Avatar({ item }) {
  if (item.sender_profile_image) {
    return <img src={item.sender_profile_image} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" onError={(e) => e.target.style.display = "none"} />;
  }
  return (
    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-sm flex-shrink-0">
      {(item.sender_name || item.sender_username || "?")[0].toUpperCase()}
    </div>
  );
}

function InboxRow({ item, selected, onClick }) {
  const isUnread = item.status === "unread";
  return (
    <button
      onClick={() => onClick(item)}
      className={`w-full text-left flex items-start gap-3 px-4 py-3.5 border-b border-slate-100 transition-colors ${selected ? "bg-violet-50" : "hover:bg-slate-50"} ${isUnread ? "bg-white" : "bg-slate-50/50"}`}
    >
      <div className="relative flex-shrink-0">
        <Avatar item={item} />
        {isUnread && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-violet-500 rounded-full border-2 border-white" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={`text-sm truncate ${isUnread ? "font-semibold text-slate-900" : "font-medium text-slate-700"}`}>
              @{item.sender_username || item.sender_name}
            </span>
            {item.matched_keywords?.length > 0 && (
              <Bell size={11} className="flex-shrink-0 text-amber-500" title={`Alert: ${item.matched_keywords.join(", ")}`} />
            )}
          </div>
          <span className="text-[11px] text-slate-400 flex-shrink-0">{timeAgo(item.received_at)}</span>
        </div>
        <p className="text-xs text-slate-500 truncate mt-0.5">{item.content}</p>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: PLATFORM_COLORS[item.platform] }}>
            {item.platform?.slice(0, 2)}
          </span>
          <span className="text-[10px] text-slate-400 capitalize">{item.type}</span>
          {item.tags?.map((tag) => (
            <span key={tag} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${TAG_STYLES[tag] || TAG_STYLES.Other}`}>{tag}</span>
          ))}
          <SentimentBadge sentiment={item.sentiment} />
        </div>
      </div>
    </button>
  );
}

function ConversationPanel({ item, onUpdate }) {
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [tagging, setTagging] = useState(false);
  const textRef = useRef(null);

  // Templates state
  const [templates, setTemplates] = useState([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const templatesRef = useRef(null);

  useEffect(() => { textRef.current?.focus(); }, [item?.item_id]);

  // Load templates on mount
  useEffect(() => {
    fetchTemplates().then(({ data }) => setTemplates(data || [])).catch(() => {});
  }, []);

  // Close templates popover on outside click
  useEffect(() => {
    if (!showTemplates) return;
    const handler = (e) => {
      if (templatesRef.current && !templatesRef.current.contains(e.target)) {
        setShowTemplates(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showTemplates]);

  if (!item) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
        <div className="text-center">
          <MessageCircle size={32} className="mx-auto mb-3 opacity-30" />
          Select a message to reply
        </div>
      </div>
    );
  }

  const handleReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      await replyToItem(item.item_id, reply.trim());
      setReply("");
      onUpdate(item.item_id, { status: "done" });
    } catch { } finally { setSending(false); }
  };

  const handleStatus = async (status) => {
    await updateInboxItem(item.item_id, { status });
    onUpdate(item.item_id, { status });
  };

  const handleAutoTag = async () => {
    setTagging(true);
    try {
      const [tagRes, sentimentRes] = await Promise.all([
        tagMessage(item.content),
        analyzeSentiment(item.content),
      ]);
      const newTags = Array.from(new Set([...(item.tags || []), tagRes.data.tag]));
      const sentiment = sentimentRes.data.sentiment;
      await updateInboxItem(item.item_id, { tags: newTags });
      onUpdate(item.item_id, { tags: newTags, sentiment });
    } catch { } finally { setTagging(false); }
  };

  const handleUseTemplate = (tpl) => {
    setReply(tpl.content);
    setShowTemplates(false);
    textRef.current?.focus();
  };

  const handleDeleteTemplate = async (e, id) => {
    e.stopPropagation();
    try {
      await deleteTemplate(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch { }
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim() || !reply.trim()) return;
    setSavingTemplate(true);
    try {
      const { data } = await createTemplate(templateName.trim(), reply.trim());
      setTemplates((prev) => [...prev, data]);
      setTemplateName("");
      setShowSaveForm(false);
    } catch { } finally { setSavingTemplate(false); }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Avatar item={item} />
          <div>
            <p className="font-semibold text-slate-900 text-sm">@{item.sender_username || item.sender_name}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wide text-white px-1.5 py-0.5 rounded" style={{ backgroundColor: PLATFORM_COLORS[item.platform] }}>
                {item.platform}
              </span>
              <span className="text-xs text-slate-500 capitalize">{item.type} · {timeAgo(item.received_at)}</span>
              <SentimentBadge sentiment={item.sentiment} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {item.tags?.map((tag) => (
            <span key={tag} className={`text-xs px-2 py-1 rounded-full font-medium ${TAG_STYLES[tag] || TAG_STYLES.Other}`}>{tag}</span>
          ))}
          <button onClick={handleAutoTag} disabled={tagging} title="Auto-tag with AI" className="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors">
            {tagging ? <Loader2 size={14} className="animate-spin" /> : <Tag size={14} />}
          </button>
          <button onClick={() => handleStatus("done")} title="Mark done" className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors">
            <CheckCheck size={14} />
          </button>
          <button onClick={() => handleStatus("archived")} title="Archive" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <Archive size={14} />
          </button>
        </div>
      </div>

      {/* Message body */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="bg-slate-50 rounded-2xl p-4 max-w-lg">
          <p className="text-sm text-slate-800 whitespace-pre-wrap">{item.content}</p>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${item.status === "unread" ? "bg-violet-100 text-violet-700" : item.status === "done" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
            {STATUS_LABELS[item.status] || item.status}
          </span>
        </div>
      </div>

      {/* Reply area */}
      <div className="px-6 py-4 border-t border-slate-200">
        {/* Save-as-template inline form */}
        {showSaveForm && (
          <div className="flex items-center gap-2 mb-2">
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSaveTemplate(); if (e.key === "Escape") setShowSaveForm(false); }}
              placeholder="Template name…"
              autoFocus
              className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <button
              onClick={handleSaveTemplate}
              disabled={savingTemplate || !templateName.trim()}
              className="text-xs px-3 py-1.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-40 transition-colors"
            >
              {savingTemplate ? "Saving…" : "Save"}
            </button>
            <button onClick={() => setShowSaveForm(false)} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <textarea
            ref={textRef}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Write a reply…"
            rows={2}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleReply(); }}
            className="flex-1 border border-slate-300 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
          />

          {/* Templates button + popover */}
          <div className="relative flex-shrink-0" ref={templatesRef}>
            <button
              onClick={() => setShowTemplates((v) => !v)}
              title="Reply templates"
              className={`p-2.5 rounded-xl border transition-colors ${showTemplates ? "bg-violet-50 border-violet-300 text-violet-600" : "border-slate-200 text-slate-400 hover:text-violet-600 hover:bg-violet-50 hover:border-violet-300"}`}
            >
              <FileText size={16} />
            </button>

            {showTemplates && (
              <div className="absolute bottom-full right-0 mb-2 w-72 bg-white rounded-xl shadow-lg border border-slate-200 z-20 overflow-hidden">
                <div className="px-3 py-2 border-b border-slate-100">
                  <p className="text-xs font-semibold text-slate-600">Templates</p>
                </div>
                {templates.length === 0 ? (
                  <p className="text-xs text-slate-400 px-3 py-3">No saved templates yet.</p>
                ) : (
                  <ul className="max-h-48 overflow-y-auto">
                    {templates.map((tpl) => (
                      <li key={tpl.id} className="group flex items-start justify-between gap-2 px-3 py-2.5 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0"
                        onClick={() => handleUseTemplate(tpl)}>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate">{tpl.name}</p>
                          <p className="text-[11px] text-slate-400 truncate">{tpl.content?.slice(0, 60)}{tpl.content?.length > 60 ? "…" : ""}</p>
                        </div>
                        <button
                          onClick={(e) => handleDeleteTemplate(e, tpl.id)}
                          className="flex-shrink-0 p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={12} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Send button */}
          <button
            onClick={handleReply}
            disabled={sending || !reply.trim()}
            className="p-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-700 disabled:opacity-40 transition-colors flex-shrink-0"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>

        <div className="flex items-center justify-between mt-1.5">
          <p className="text-[11px] text-slate-400">Ctrl+Enter to send</p>
          {reply.trim().length > 0 && !showSaveForm && (
            <button
              onClick={() => setShowSaveForm(true)}
              className="text-[11px] text-violet-500 hover:text-violet-700 font-medium transition-colors"
            >
              Save as template
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Inbox() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState(null);
  const [filters, setFilters] = useState({ platform: "", status: "", type: "" });

  // Alerts state
  const [alerts, setAlerts] = useState([]);
  const [showAlertsPanel, setShowAlertsPanel] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");
  const [addingAlert, setAddingAlert] = useState(false);

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const params = {};
      if (filters.platform) params.platform = filters.platform;
      if (filters.status)   params.status = filters.status;
      if (filters.type)     params.type = filters.type;
      const { data } = await getInbox({ limit: 100, ...params });
      setItems(data);
    } catch {} finally {
      setLoading(false); setRefreshing(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  // Load alerts on mount
  useEffect(() => {
    fetchAlerts().then(({ data }) => setAlerts(data || [])).catch(() => {});
  }, []);

  // Auto-mark as read when selected
  const handleSelect = (item) => {
    setSelected(item);
    if (item.status === "unread") {
      updateInboxItem(item.item_id, { status: "read" }).catch(() => {});
      setItems((prev) => prev.map((i) => i.item_id === item.item_id ? { ...i, status: "read" } : i));
    }
  };

  const handleUpdate = (itemId, patch) => {
    setItems((prev) => prev.map((i) => i.item_id === itemId ? { ...i, ...patch } : i));
    setSelected((prev) => prev?.item_id === itemId ? { ...prev, ...patch } : prev);
  };

  const handleAddAlert = async () => {
    if (!newKeyword.trim()) return;
    setAddingAlert(true);
    try {
      const { data } = await createAlert(newKeyword.trim());
      setAlerts((prev) => [...prev, data]);
      setNewKeyword("");
    } catch { } finally { setAddingAlert(false); }
  };

  const handleDeleteAlert = async (id) => {
    try {
      await deleteAlert(id);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch { }
  };

  const unreadCount = items.filter((i) => i.status === "unread").length;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── Left column ── */}
      <div className="w-80 flex-shrink-0 border-r border-slate-200 flex flex-col bg-white">
        {/* Header */}
        <div className="px-4 py-4 border-b border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-lg font-bold text-slate-900">Inbox</h1>
              {unreadCount > 0 && (
                <span className="text-xs text-violet-600 font-medium">{unreadCount} unread</span>
              )}
            </div>
            <button onClick={() => load(true)} disabled={refreshing} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            </button>
          </div>

          {/* Filters */}
          <div className="space-y-2">
            <select value={filters.platform} onChange={(e) => setFilters((f) => ({ ...f, platform: e.target.value }))} className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500">
              <option value="">All platforms</option>
              {["instagram","twitter","linkedin","facebook"].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <div className="flex gap-2">
              <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500">
                <option value="">All status</option>
                {["unread","read","done","archived"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))} className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500">
                <option value="">All types</option>
                {["comment","dm","mention"].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Alerts panel toggle */}
          <button
            onClick={() => setShowAlertsPanel((v) => !v)}
            className={`mt-2 w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${showAlertsPanel ? "bg-amber-50 text-amber-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"}`}
          >
            <span className="flex items-center gap-1.5">
              <Bell size={12} />
              Alerts
              {alerts.length > 0 && (
                <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-semibold">{alerts.length}</span>
              )}
            </span>
            <span className="text-[10px] text-slate-400">{showAlertsPanel ? "▲" : "▼"}</span>
          </button>

          {/* Alerts panel */}
          {showAlertsPanel && (
            <div className="mt-1.5 border border-amber-100 rounded-xl bg-amber-50/40 p-2.5">
              {/* Keyword list */}
              {alerts.length > 0 && (
                <ul className="max-h-[200px] overflow-y-auto space-y-1 mb-2">
                  {alerts.map((alert) => (
                    <li key={alert.id} className="flex items-center justify-between gap-2 bg-white rounded-lg px-2.5 py-1.5 border border-amber-100">
                      <span className="text-xs text-slate-700 truncate">{alert.keyword}</span>
                      <button
                        onClick={() => handleDeleteAlert(alert.id)}
                        className="flex-shrink-0 p-0.5 text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={11} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {/* Add keyword */}
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddAlert(); }}
                  placeholder="Add keyword…"
                  className="flex-1 border border-slate-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <button
                  onClick={handleAddAlert}
                  disabled={addingAlert || !newKeyword.trim()}
                  className="text-xs px-2.5 py-1 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-40 transition-colors"
                >
                  {addingAlert ? "…" : "Add"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Message list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-400 text-sm gap-2">
              <Loader2 size={16} className="animate-spin" /> Loading…
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-center px-4">
              <MessageCircle size={28} className="mb-2 opacity-40" />
              <p className="text-sm font-medium">No messages yet</p>
              <p className="text-xs mt-1">Inbox is polled every 5 minutes once accounts are connected.</p>
            </div>
          ) : (
            items.map((item) => (
              <InboxRow
                key={item.item_id}
                item={item}
                selected={selected?.item_id === item.item_id}
                onClick={handleSelect}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Right column ── */}
      <ConversationPanel
        item={selected}
        onUpdate={handleUpdate}
      />
    </div>
  );
}
