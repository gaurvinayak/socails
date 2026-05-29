import { AlertCircle, CheckCircle2, Clock, RefreshCw, Unplug, Wifi } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { connectPlatform, disconnectAccount, getAccounts, refreshAccountToken } from "../api";

// ── Platform metadata ────────────────────────────────────────────────────────

const PLATFORMS = [
  {
    id: "instagram",
    label: "Instagram",
    color: "#E1306C",
    bg: "from-purple-500 via-pink-500 to-orange-400",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
      </svg>
    ),
  },
  {
    id: "twitter",
    label: "X (Twitter)",
    color: "#000000",
    bg: "from-slate-800 to-slate-900",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    color: "#0A66C2",
    bg: "from-blue-600 to-blue-700",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
  {
    id: "facebook",
    label: "Facebook",
    color: "#1877F2",
    bg: "from-blue-500 to-blue-600",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  {
    id: "tiktok",
    label: "TikTok",
    color: "#010101",
    bg: "from-slate-900 to-slate-800",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.74a4.85 4.85 0 0 1-1.01-.05z" />
      </svg>
    ),
  },
  {
    id: "youtube",
    label: "YouTube",
    color: "#FF0000",
    bg: "from-red-600 to-red-700",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatFollowers(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function Toast({ toast, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);

  if (!toast) return null;
  const isError = toast.type === "error";
  return (
    <div
      className={`fixed bottom-6 right-6 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium z-50 ${
        isError ? "bg-red-600 text-white" : "bg-emerald-600 text-white"
      }`}
    >
      {isError ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
      {toast.message}
    </div>
  );
}

// ── Platform Card ─────────────────────────────────────────────────────────────

function PlatformCard({ platform, accounts, onConnect, onDisconnect, onRefresh, connecting }) {
  const connected = accounts.filter((a) => a.platform === platform.id);
  const isConnecting = connecting === platform.id;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
      {/* Header stripe */}
      <div className={`bg-gradient-to-r ${platform.bg} px-5 py-4 flex items-center gap-3`}>
        <div className="text-white">{platform.icon}</div>
        <span className="text-white font-semibold text-base">{platform.label}</span>
        <div className="ml-auto">
          {connected.length > 0 ? (
            <span className="flex items-center gap-1.5 bg-white/20 text-white text-xs font-medium px-2.5 py-1 rounded-full">
              <Wifi size={11} />
              {connected.length} connected
            </span>
          ) : (
            <span className="flex items-center gap-1.5 bg-black/20 text-white/80 text-xs font-medium px-2.5 py-1 rounded-full">
              Not connected
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 px-5 py-4 space-y-3">
        {connected.length === 0 ? (
          <div className="py-2 space-y-3">
            <p className="text-sm text-slate-400">
              No {platform.label} account connected. Reconnect to resume posting and insights.
            </p>
            <button
              onClick={() => onConnect(platform.id)}
              disabled={isConnecting}
              className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900 disabled:opacity-60 transition-colors"
            >
              <RefreshCw size={13} className={isConnecting ? "animate-spin" : ""} />
              {isConnecting ? "Redirecting…" : `Reconnect ${platform.label}`}
            </button>
          </div>
        ) : (
          connected.map((account) => (
            <AccountRow
              key={account.account_id}
              account={account}
              onDisconnect={onDisconnect}
              onRefresh={onRefresh}
            />
          ))
        )}
      </div>

      {/* Footer — only shown when at least one account is connected */}
      {connected.length > 0 && (
        <div className="px-5 py-4 border-t border-slate-100">
          <button
            onClick={() => onConnect(platform.id)}
            disabled={isConnecting}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-60
              bg-slate-900 text-white hover:bg-slate-700"
          >
            {isConnecting ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                Redirecting…
              </>
            ) : (
              "Connect another account"
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function AccountRow({ account, onDisconnect, onRefresh }) {
  const [confirming, setConfirming] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh(account.account_id);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
      {/* Avatar */}
      {account.profile_image_url ? (
        <img
          src={account.profile_image_url}
          alt={account.display_name}
          className="w-9 h-9 rounded-full object-cover flex-shrink-0"
          onError={(e) => {
            e.target.style.display = "none";
          }}
        />
      ) : (
        <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 text-slate-500 text-sm font-bold">
          {(account.display_name || account.username || "?")[0].toUpperCase()}
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">
          {account.display_name || account.username}
        </p>
        <p className="text-xs text-slate-500 truncate">
          @{account.username}
          {account.followers_count > 0 && (
            <span className="ml-2 text-slate-400">
              · {formatFollowers(account.followers_count)} followers
            </span>
          )}
        </p>
      </div>

      {/* Token health */}
      <TokenHealth account={account} />

      {/* Refresh token — Twitter only */}
      {account.platform === "twitter" && (
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          title="Refresh token"
          className="text-slate-400 hover:text-blue-500 transition-colors flex-shrink-0 disabled:opacity-40"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
        </button>
      )}

      {/* Disconnect */}
      {confirming ? (
        <div className="flex gap-1.5 flex-shrink-0">
          <button
            onClick={() => onDisconnect(account.account_id)}
            className="text-xs px-2 py-1 bg-red-600 text-white rounded-md font-medium hover:bg-red-700"
          >
            Yes
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="text-xs px-2 py-1 bg-slate-200 text-slate-700 rounded-md font-medium hover:bg-slate-300"
          >
            No
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          title="Disconnect"
          className="text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
        >
          <Unplug size={15} />
        </button>
      )}
    </div>
  );
}

function TokenHealth({ account }) {
  if (!account.token_expires_at) {
    return (
      <span title="Token valid" className="text-emerald-500 flex-shrink-0">
        <CheckCircle2 size={14} />
      </span>
    );
  }
  const daysLeft = Math.ceil(
    (new Date(account.token_expires_at) - Date.now()) / 86_400_000
  );
  if (daysLeft <= 0) {
    return (
      <span title="Token expired" className="text-red-500 flex-shrink-0">
        <AlertCircle size={14} />
      </span>
    );
  }
  if (daysLeft < 7) {
    return (
      <span title={`Token expires in ${daysLeft}d`} className="text-amber-500 flex-shrink-0">
        <Clock size={14} />
      </span>
    );
  }
  return (
    <span title={`Token valid (${daysLeft}d left)`} className="text-emerald-500 flex-shrink-0">
      <CheckCircle2 size={14} />
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AccountHub() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(null);
  const [toast, setToast] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const loadAccounts = useCallback(async () => {
    try {
      const { data } = await getAccounts();
      setAccounts(data);
    } catch {
      // backend may not be running yet
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle OAuth redirect-back
  useEffect(() => {
    const connected = searchParams.get("connected");
    const count = searchParams.get("count");
    const error = searchParams.get("error");

    if (connected) {
      const label = PLATFORMS.find((p) => p.id === connected)?.label ?? connected;
      setToast({
        type: "success",
        message: `Connected ${count} ${label} account${count !== "1" ? "s" : ""}`,
      });
      setSearchParams({}, { replace: true });
      loadAccounts();
    } else if (error) {
      setToast({ type: "error", message: `Connection failed: ${decodeURIComponent(error)}` });
      setSearchParams({}, { replace: true });
    }
  }, []); // eslint-disable-line

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const handleConnect = async (platformId) => {
    setConnecting(platformId);
    try {
      const { data } = await connectPlatform(platformId);
      window.location.href = data.auth_url;
    } catch (err) {
      setConnecting(null);
      setToast({
        type: "error",
        message: err.response?.data?.detail ?? "Failed to start connection",
      });
    }
  };

  const handleDisconnect = async (accountId) => {
    try {
      await disconnectAccount(accountId);
      setAccounts((prev) => prev.filter((a) => a.account_id !== accountId));
      setToast({ type: "success", message: "Account disconnected" });
    } catch {
      setToast({ type: "error", message: "Failed to disconnect account" });
    }
  };

  const handleRefresh = async (accountId) => {
    try {
      await refreshAccountToken(accountId);
      setToast({ type: "success", message: "Token refreshed — account is ready to post" });
      loadAccounts();
    } catch (err) {
      setToast({
        type: "error",
        message: err.response?.data?.detail ?? "Token refresh failed — try reconnecting",
      });
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Account Hub</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Connect your social media accounts to start posting, scheduling, and viewing insights.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 h-64 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {PLATFORMS.map((platform) => (
            <PlatformCard
              key={platform.id}
              platform={platform}
              accounts={accounts}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              onRefresh={handleRefresh}
              connecting={connecting}
            />
          ))}
        </div>
      )}

      {/* Summary bar */}
      {!loading && accounts.length > 0 && (
        <div className="mt-6 flex items-center gap-6 text-sm text-slate-500">
          <span>
            <strong className="text-slate-800">{accounts.length}</strong> accounts connected
          </span>
          {PLATFORMS.map((p) => {
            const n = accounts.filter((a) => a.platform === p.id).length;
            return n > 0 ? (
              <span key={p.id}>
                <strong className="text-slate-800">{n}</strong> {p.label}
              </span>
            ) : null;
          })}
        </div>
      )}

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
