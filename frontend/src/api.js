import axios from "axios";

const api = axios.create({ baseURL: "", headers: { "Content-Type": "application/json" } });

api.interceptors.request.use((config) => {
  const key = localStorage.getItem("socails_api_key");
  if (key) config.headers["Authorization"] = `Bearer ${key}`;
  return config;
});

export default api;

// Accounts
export const getAccounts = (platform) =>
  api.get("/api/v1/accounts", { params: platform ? { platform } : {} });
export const disconnectAccount = (id) => api.delete(`/api/v1/accounts/${id}`);
export const getAccountHealth = (id) => api.get(`/api/v1/accounts/${id}/health`);
export const connectPlatform = (platform) => api.get(`/api/auth/${platform}/connect`);

// API Keys
export const getApiKeys = () => api.get("/api/v1/keys");
export const createApiKey = (name, scope) => api.post("/api/v1/keys", { name, scope });
export const revokeApiKey = (id) => api.delete(`/api/v1/keys/${id}`);

// Posts
export const getPosts = (params) => api.get("/api/v1/posts", { params });
export const createPost = (body) => api.post("/api/v1/posts", body);
export const getPost = (id) => api.get(`/api/v1/posts/${id}`);
export const updatePost = (id, body) => api.patch(`/api/v1/posts/${id}`, body);
export const deletePost = (id) => api.delete(`/api/v1/posts/${id}`);
export const publishPost = (id) => api.post(`/api/v1/posts/${id}/publish`);
export const bulkCreatePosts = (posts) => api.post("/api/v1/posts/bulk", posts);
export const refreshPostMetrics = (id) => api.post(`/api/v1/posts/${id}/refresh-metrics`);

// Scheduler
export const getQueue = (params) => api.get("/api/v1/queue", { params });
export const getBestTimes = (platform) => api.get(`/api/v1/scheduler/best-times/${platform}`);

// Inbox
export const getInbox = (params) => api.get("/api/v1/inbox", { params });
export const getUnreadCount = () => api.get("/api/v1/inbox/unread-count");
export const getInboxItem = (id) => api.get(`/api/v1/inbox/${id}`);
export const replyToItem = (id, content) => api.post(`/api/v1/inbox/${id}/reply`, { content });
export const updateInboxItem = (id, body) => api.patch(`/api/v1/inbox/${id}`, body);

// Analytics
export const getAnalyticsSummary = (days) =>
  api.get("/api/v1/analytics/summary", { params: { days } });
export const getPostMetrics = (params) => api.get("/api/v1/analytics/posts", { params });
export const getTopPosts = (params) => api.get("/api/v1/analytics/top-posts", { params });
export const getFollowerGrowth = (days) =>
  api.get("/api/v1/analytics/follower-growth", { params: { days } });
export const snapshotFollowers = () => api.post("/api/v1/accounts/snapshot-followers");

// Media
export const getMedia = (params) => api.get("/api/v1/media", { params });
export const uploadMedia = (formData) =>
  api.post("/api/v1/media", formData, { headers: { "Content-Type": "multipart/form-data" } });
export const deleteMedia = (id) => api.delete(`/api/v1/media/${id}`);
export const getHashtagGroups = () => api.get("/api/v1/media/hashtag-groups");
export const createHashtagGroup = (body) => api.post("/api/v1/media/hashtag-groups", body);
export const updateHashtagGroup = (id, body) =>
  api.patch(`/api/v1/media/hashtag-groups/${id}`, body);
export const deleteHashtagGroup = (id) => api.delete(`/api/v1/media/hashtag-groups/${id}`);

// AI
export const generateCaption = (prompt, platform, tone) =>
  api.post("/api/v1/ai/caption", { prompt, platform, tone });
export const tagMessage = (content) => api.post("/api/v1/ai/tag-message", { content });
export const repurposePost = (content, sourcePlatform, targetPlatforms) =>
  api.post("/api/v1/ai/repurpose", { content, source_platform: sourcePlatform, target_platforms: targetPlatforms });

// Webhooks
export const getWebhooks = () => api.get("/api/v1/webhooks");
export const createWebhook = (body) => api.post("/api/v1/webhooks", body);
export const deleteWebhook = (id) => api.delete(`/api/v1/webhooks/${id}`);

// Posts (extended)
export const createThread = (body) => api.post("/api/v1/posts/thread", body);
export const createCarousel = (body) => api.post("/api/v1/posts/carousel", body);
export const bulkCsvPosts = (formData) =>
  api.post("/api/v1/posts/bulk-csv", formData, { headers: { "Content-Type": "multipart/form-data" } });
export const clonePost = (id) => api.post(`/api/v1/posts/${id}/clone`);
export const retryPost = (id) => api.post(`/api/v1/posts/${id}/retry`);
export const toggleEvergreen = (id) => api.post(`/api/v1/posts/${id}/evergreen`);

// Queue Slots
export const getQueueSlots = () => api.get("/api/v1/queue/slots");
export const createQueueSlot = (body) => api.post("/api/v1/queue/slots", body);
export const updateQueueSlot = (id, body) => api.patch(`/api/v1/queue/slots/${id}`, body);
export const deleteQueueSlot = (id) => api.delete(`/api/v1/queue/slots/${id}`);

// Categories
export const getCategories = () => api.get("/api/v1/categories");
export const createCategory = (body) => api.post("/api/v1/categories", body);
export const deleteCategory = (id) => api.delete(`/api/v1/categories/${id}`);

// Inbox Templates
export const getReplyTemplates = () => api.get("/api/v1/inbox/templates");
export const createReplyTemplate = (body) => api.post("/api/v1/inbox/templates", body);
export const deleteReplyTemplate = (id) => api.delete(`/api/v1/inbox/templates/${id}`);

// Keyword Alerts
export const getAlerts = () => api.get("/api/v1/alerts");
export const createAlert = (keyword) => api.post("/api/v1/alerts", { keyword });
export const deleteAlert = (id) => api.delete(`/api/v1/alerts/${id}`);

// Analytics (extended)
export const getAnalyticsHeatmap = (days) =>
  api.get("/api/v1/analytics/heatmap", { params: { days } });
export const exportAnalyticsCSV = () => api.get("/api/v1/analytics/export");

// Brand Kit
export const getBrandKit = () => api.get("/api/v1/brand-kit");
export const updateBrandKit = (body) => api.put("/api/v1/brand-kit", body);

// Media (extended)
export const searchUnsplash = (query, page = 1) =>
  api.get("/api/v1/media/unsplash", { params: { query, page } });
export const autoTagMedia = (id) => api.post(`/api/v1/media/${id}/auto-tag`);

// AI (extended)
export const analyzeSentiment = (content) => api.post("/api/v1/ai/sentiment", { content });

// Content Pillars
export const getPillars = () => api.get("/api/v1/pillars");
export const createPillar = (body) => api.post("/api/v1/pillars", body);
export const deletePillar = (id) => api.delete(`/api/v1/pillars/${id}`);
export const tagPostWithPillar = (postId, pillarId) =>
  api.patch(`/api/v1/posts/${postId}`, { pillar_id: pillarId });

// SMART Goals
export const getGoals = () => api.get("/api/v1/goals");
export const createGoal = (body) => api.post("/api/v1/goals", body);
export const updateGoal = (id, body) => api.patch(`/api/v1/goals/${id}`, body);
export const deleteGoal = (id) => api.delete(`/api/v1/goals/${id}`);

// 90-Day Plan
export const getPlanChecklist = () => api.get("/api/v1/plan/checklist");
export const updateChecklistItem = (id, body) => api.patch(`/api/v1/plan/checklist/${id}`, body);
export const resetChecklist = () => api.post("/api/v1/plan/checklist/reset");
export const getPlanMeta = () => api.get("/api/v1/plan/meta");
export const startPlan = (started_at) => api.post("/api/v1/plan/start", started_at ? { started_at } : {});
