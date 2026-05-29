import { CheckCircle2, Copy, Key, Plus, Trash2, Webhook } from "lucide-react";
import { useEffect, useState } from "react";
import {
  createApiKey, createWebhook, deleteWebhook, getApiKeys, getWebhooks, revokeApiKey,
} from "../api";

const SCOPE_LABELS = {
  read:       { label: "Read only",    color: "bg-slate-100 text-slate-600" },
  read_write: { label: "Read + Write", color: "bg-blue-100 text-blue-700" },
  full:       { label: "Full access",  color: "bg-violet-100 text-violet-700" },
};

const WEBHOOK_EVENTS = [
  "post.published",
  "post.failed",
  "inbox.new_message",
  "inbox.new_mention",
];

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
      title="Copy"
    >
      {copied ? <CheckCircle2 size={14} className="text-emerald-500" /> : <Copy size={14} />}
    </button>
  );
}

function ApiKeysSection() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", scope: "read_write" });
  const [newKey, setNewKey] = useState(null);
  const [error, setError] = useState(null);

  const loadKeys = async () => {
    try { const { data } = await getApiKeys(); setKeys(data); }
    catch {} finally { setLoading(false); }
  };

  useEffect(() => { loadKeys(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const { data } = await createApiKey(form.name.trim(), form.scope);
      setNewKey(data.key);
      setForm({ name: "", scope: "read_write" });
      loadKeys();
    } catch (err) {
      setError(err.response?.data?.detail ?? "Failed to create key");
    } finally { setCreating(false); }
  };

  const handleRevoke = async (keyId) => {
    try { await revokeApiKey(keyId); setKeys((prev) => prev.filter((k) => k.key_id !== keyId)); }
    catch {}
  };

  return (
    <>
      {newKey && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
          <p className="text-sm font-semibold text-emerald-800 mb-2 flex items-center gap-2">
            <CheckCircle2 size={15} /> Key created — copy it now. It won't be shown again.
          </p>
          <div className="flex items-center gap-2 bg-white border border-emerald-200 rounded-lg px-3 py-2">
            <code className="text-sm text-slate-800 flex-1 break-all font-mono">{newKey}</code>
            <CopyButton text={newKey} />
          </div>
          <button onClick={() => setNewKey(null)} className="mt-2 text-xs text-emerald-700 hover:underline">Dismiss</button>
        </div>
      )}

      <section className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
        <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Plus size={16} /> Generate new API key
        </h2>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Key name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Zapier integration"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Scope</label>
            <select
              value={form.scope}
              onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
            >
              <option value="read">Read only</option>
              <option value="read_write">Read + Write</option>
              <option value="full">Full access</option>
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={creating || !form.name.trim()}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            {creating ? "Creating…" : "Generate key"}
          </button>
        </form>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-8">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2"><Key size={16} /> Active API keys</h2>
        </div>
        {loading ? (
          <div className="px-5 py-8 text-center text-sm text-slate-400">Loading…</div>
        ) : keys.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-400">No keys yet. Generate one above.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {keys.map((key) => (
              <li key={key.key_id} className="flex items-center gap-4 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">{key.name}</p>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{key.prefix}…</p>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${SCOPE_LABELS[key.scope]?.color ?? "bg-slate-100 text-slate-600"}`}>
                  {SCOPE_LABELS[key.scope]?.label ?? key.scope}
                </span>
                <span className="text-xs text-slate-400 hidden sm:block">
                  {new Date(key.created_at).toLocaleDateString()}
                </span>
                <button onClick={() => handleRevoke(key.key_id)} title="Revoke key" className="text-slate-400 hover:text-red-500 transition-colors">
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function WebhooksSection() {
  const [hooks, setHooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ url: "", events: [] });
  const [error, setError] = useState(null);

  const loadHooks = async () => {
    try { const { data } = await getWebhooks(); setHooks(data); }
    catch {} finally { setLoading(false); }
  };

  useEffect(() => { loadHooks(); }, []);

  const toggleEvent = (ev) => {
    setForm((f) => ({
      ...f,
      events: f.events.includes(ev) ? f.events.filter((e) => e !== ev) : [...f.events, ev],
    }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.url.trim() || form.events.length === 0) return;
    setCreating(true);
    setError(null);
    try {
      const { data } = await createWebhook({ url: form.url.trim(), events: form.events });
      setHooks((prev) => [data, ...prev]);
      setForm({ url: "", events: [] });
    } catch (err) {
      setError(err.response?.data?.detail ?? "Failed to register webhook");
    } finally { setCreating(false); }
  };

  const handleDelete = async (id) => {
    try { await deleteWebhook(id); setHooks((prev) => prev.filter((h) => h.webhook_id !== id)); }
    catch {}
  };

  return (
    <>
      <section className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
        <h2 className="font-semibold text-slate-800 mb-1 flex items-center gap-2">
          <Plus size={16} /> Register webhook
        </h2>
        <p className="text-xs text-slate-400 mb-4">Socails will POST a JSON payload to your URL when each event fires.</p>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Endpoint URL</label>
            <input
              type="url"
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              placeholder="https://your-server.com/webhook"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Events to subscribe</label>
            <div className="flex flex-wrap gap-2">
              {WEBHOOK_EVENTS.map((ev) => (
                <button
                  key={ev}
                  type="button"
                  onClick={() => toggleEvent(ev)}
                  className={`px-3 py-1.5 text-xs rounded-lg border font-mono transition-colors ${form.events.includes(ev) ? "bg-violet-600 border-violet-600 text-white" : "border-slate-200 text-slate-600 hover:border-violet-300"}`}
                >
                  {ev}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={creating || !form.url.trim() || form.events.length === 0}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            {creating ? "Registering…" : "Register webhook"}
          </button>
        </form>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-8">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2"><Webhook size={16} /> Active webhooks</h2>
        </div>
        {loading ? (
          <div className="px-5 py-8 text-center text-sm text-slate-400">Loading…</div>
        ) : hooks.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-400">No webhooks registered yet.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {hooks.map((hook) => (
              <li key={hook.webhook_id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-mono text-slate-700 truncate">{hook.url}</p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {hook.events?.map((ev) => (
                        <span key={ev} className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-slate-100 text-slate-500">{ev}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-slate-400">{new Date(hook.created_at).toLocaleDateString()}</span>
                    <button onClick={() => handleDelete(hook.webhook_id)} title="Delete" className="text-slate-400 hover:text-red-500 transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

export default function Settings() {
  const [tab, setTab] = useState("keys");

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Settings</h1>
      <p className="text-slate-500 text-sm mb-6">
        API keys, webhooks, and developer integrations.
      </p>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {[["keys", "API Keys"], ["webhooks", "Webhooks"]].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${tab === id ? "border-violet-600 text-violet-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "keys" && <ApiKeysSection />}
      {tab === "webhooks" && <WebhooksSection />}

      <p className="text-sm text-slate-500">
        View the full API reference at{" "}
        <a href="http://localhost:8002/api/docs" target="_blank" rel="noreferrer" className="text-violet-600 hover:underline font-medium">
          localhost:8002/api/docs
        </a>.
      </p>
    </div>
  );
}
