import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import api, { getAccounts } from "../api";

const SLIDE_COLORS = [
  "#1e293b", "#0f172a", "#1e1b4b", "#172554", "#064e3b",
  "#7c3aed", "#0A66C2", "#10b981", "#f59e0b", "#ef4444",
  "#ffffff", "#f8fafc", "#f0fdf4", "#eff6ff",
];

const MAX_SLIDES = 12;

const defaultSlide = (i) => ({
  id: crypto.randomUUID(),
  title: i === 0 ? "Your hook title here" : `Point ${i}`,
  body: i === 0 ? "The bold claim or insight that makes people swipe right" : "Explanation in 2–3 sentences. Clear, actionable, valuable.",
  bg: i === 0 ? "#1e293b" : i === MAX_SLIDES - 1 ? "#7c3aed" : "#ffffff",
  textColor: i === 0 ? "#ffffff" : i === MAX_SLIDES - 1 ? "#ffffff" : "#1e293b",
  isCtaSlide: false,
});

function SlidePreview({ slide, index, total, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`relative w-16 h-24 rounded-lg overflow-hidden border-2 flex-shrink-0 transition-all ${isActive ? "border-violet-500 scale-105 shadow-lg" : "border-transparent hover:border-slate-300"}`}
      style={{ backgroundColor: slide.bg }}
    >
      <div className="absolute inset-0 p-1 flex flex-col justify-between">
        <p className="text-[6px] font-bold leading-tight line-clamp-2" style={{ color: slide.textColor || "#fff" }}>{slide.title}</p>
        <p className="text-[4px] leading-tight opacity-70 line-clamp-2" style={{ color: slide.textColor || "#fff" }}>{slide.body}</p>
      </div>
      <div className="absolute bottom-1 right-1 text-[5px] opacity-50" style={{ color: slide.textColor || "#fff" }}>{index + 1}/{total}</div>
    </button>
  );
}

function SlideEditor({ slide, onChange }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Slide title</label>
        <input
          value={slide.title}
          onChange={e => onChange({ title: e.target.value })}
          placeholder="Bold hook or key point"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Body text</label>
        <textarea
          value={slide.body}
          onChange={e => onChange({ body: e.target.value })}
          rows={4}
          placeholder="2–3 sentences of value"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-2">Background color</label>
        <div className="flex flex-wrap gap-1.5">
          {SLIDE_COLORS.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => onChange({
                bg: c,
                textColor: ["#ffffff", "#f8fafc", "#f0fdf4", "#eff6ff"].includes(c) ? "#1e293b" : "#ffffff",
              })}
              className={`w-7 h-7 rounded-full border-2 transition-transform ${slide.bg === c ? "border-slate-800 scale-110" : "border-slate-200"}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
      <div>
        <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600">
          <input type="checkbox" checked={slide.isCtaSlide} onChange={e => onChange({ isCtaSlide: e.target.checked })} className="accent-violet-600" />
          This is the CTA slide (last slide, add "Try for free" callout)
        </label>
      </div>
    </div>
  );
}

function SlideCanvas({ slide, index, total }) {
  const isCta = slide.isCtaSlide;
  return (
    <div
      className="w-full aspect-[4/5] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      style={{ backgroundColor: slide.bg }}
    >
      <div className="flex-1 flex flex-col justify-center px-10 py-8">
        <p className="text-xs font-bold opacity-50 mb-4 tracking-widest uppercase" style={{ color: slide.textColor || "#fff" }}>
          {index + 1} / {total}
        </p>
        <h2 className="text-2xl font-bold leading-tight mb-4" style={{ color: slide.textColor || "#fff" }}>
          {slide.title || "Your title here"}
        </h2>
        <p className="text-base leading-relaxed opacity-85" style={{ color: slide.textColor || "#fff" }}>
          {slide.body || "Your body text here"}
        </p>
      </div>
      {isCta && (
        <div className="mx-8 mb-8 bg-white/20 backdrop-blur rounded-xl px-5 py-3 text-center">
          <p className="font-bold text-sm" style={{ color: slide.textColor || "#fff" }}>
            Practice free → systemdesignlab.io
          </p>
        </div>
      )}
      <div className="px-10 pb-6 flex items-center gap-2 opacity-60">
        <div className="w-5 h-5 rounded-full bg-white/30" />
        <p className="text-xs font-semibold" style={{ color: slide.textColor || "#fff" }}>SystemDesignLab</p>
      </div>
    </div>
  );
}

export default function CarouselCreator() {
  const [slides, setSlides] = useState([defaultSlide(0), defaultSlide(1), defaultSlide(2), { ...defaultSlide(9), title: "Practice for free", body: "Join thousands of engineers who practice system design with AI feedback.", isCtaSlide: true, bg: "#7c3aed", textColor: "#ffffff" }]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    getAccounts().then(({ data }) => {
      const li = data.filter(a => a.platform === "linkedin");
      setAccounts(li);
      if (li.length > 0) setSelectedAccount(li[0].account_id);
    }).catch(() => {});
  }, []);

  const activeSlide = slides[activeIdx];

  const updateSlide = (updates) => {
    setSlides(prev => prev.map((s, i) => i === activeIdx ? { ...s, ...updates } : s));
  };

  const addSlide = () => {
    if (slides.length >= MAX_SLIDES) return;
    const newSlide = defaultSlide(slides.length);
    setSlides(prev => {
      const next = [...prev];
      next.splice(activeIdx + 1, 0, newSlide);
      return next;
    });
    setActiveIdx(activeIdx + 1);
  };

  const deleteSlide = (idx) => {
    if (slides.length <= 2) return;
    setSlides(prev => prev.filter((_, i) => i !== idx));
    setActiveIdx(Math.min(idx, slides.length - 2));
  };

  const handlePublish = async () => {
    if (!selectedAccount || slides.length < 2) return;
    setPublishing(true);
    try {
      const { data } = await api.post("/api/v1/posts/carousel", {
        account_id: selectedAccount,
        slides: slides.map(s => ({
          title: s.title,
          body: s.body,
          bg_color: s.bg,
          text_color: s.textColor || "#ffffff",
          is_cta: s.isCtaSlide,
        })),
      });
      setToast({ type: "success", message: `Carousel queued! Post ID: ${data.post_id}` });
    } catch (err) {
      setToast({ type: "error", message: err.response?.data?.detail || "Failed to publish carousel" });
    } finally {
      setPublishing(false);
      setTimeout(() => setToast(null), 5000);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">LinkedIn Carousel Creator</h1>
        <p className="text-slate-500 text-sm mt-1">
          Carousels get <strong>278% more engagement</strong> than video on LinkedIn. Build yours here.
        </p>
      </div>

      <div className="flex gap-6">
        {/* Left: slide strip + editor */}
        <div className="w-72 flex-shrink-0 space-y-4">
          {/* Slide strip */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-600">{slides.length} / {MAX_SLIDES} slides</p>
              <button onClick={addSlide} disabled={slides.length >= MAX_SLIDES} className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 font-medium disabled:opacity-40">
                <Plus size={12} /> Add slide
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {slides.map((s, i) => (
                <SlidePreview key={s.id} slide={s} index={i} total={slides.length} isActive={i === activeIdx} onClick={() => setActiveIdx(i)} />
              ))}
            </div>
          </div>

          {/* Slide editor */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-700">
                Slide {activeIdx + 1}
                {activeSlide?.isCtaSlide && <span className="ml-2 text-violet-600 font-bold">CTA</span>}
              </p>
              <button
                onClick={() => deleteSlide(activeIdx)}
                disabled={slides.length <= 2}
                className="p-1.5 text-slate-300 hover:text-red-400 disabled:opacity-30 transition-colors"
              >
                <Trash2 size={13} />
              </button>
            </div>
            {activeSlide && <SlideEditor slide={activeSlide} onChange={updateSlide} />}
          </div>
        </div>

        {/* Middle: canvas */}
        <div className="flex-1 max-w-sm">
          <div className="sticky top-8">
            {activeSlide && <SlideCanvas slide={activeSlide} index={activeIdx} total={slides.length} />}

            {/* Nav */}
            <div className="flex items-center justify-center gap-4 mt-4">
              <button onClick={() => setActiveIdx(i => Math.max(0, i - 1))} disabled={activeIdx === 0} className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:opacity-30">
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm text-slate-500">{activeIdx + 1} / {slides.length}</span>
              <button onClick={() => setActiveIdx(i => Math.min(slides.length - 1, i + 1))} disabled={activeIdx === slides.length - 1} className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:opacity-30">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Right: publish panel */}
        <div className="w-64 flex-shrink-0 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Post to LinkedIn</h3>

            {accounts.length === 0 ? (
              <p className="text-xs text-slate-400">No LinkedIn accounts connected. <a href="/accounts" className="text-violet-600 hover:underline">Connect one →</a></p>
            ) : (
              <>
                <div className="mb-3">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Account</label>
                  <select value={selectedAccount} onChange={e => setSelectedAccount(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                    {accounts.map(a => <option key={a.account_id} value={a.account_id}>{a.display_name || a.username}</option>)}
                  </select>
                </div>

                <button
                  onClick={handlePublish}
                  disabled={publishing || !selectedAccount || slides.length < 2}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#0A66C2] text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 transition-colors"
                >
                  {publishing ? <Loader2 size={14} className="animate-spin" /> : null}
                  {publishing ? "Publishing…" : "Post carousel"}
                </button>

                <p className="text-[10px] text-slate-400 mt-2 text-center">
                  Slides are rendered as a PDF and posted as a native LinkedIn document carousel
                </p>
              </>
            )}
          </div>

          {/* Tips */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-2">
            <p className="text-xs font-semibold text-slate-700">📋 Carousel formula</p>
            <div className="space-y-1.5 text-[11px] text-slate-500">
              <p>• <strong>Slide 1:</strong> Bold hook + strong claim</p>
              <p>• <strong>Slides 2–9:</strong> One concept per slide</p>
              <p>• <strong>Slide 10:</strong> CTA → systemdesignlab.io</p>
              <p>• <strong>8–12 slides</strong> is the sweet spot</p>
              <p>• Include your logo/username on every slide</p>
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium z-50 ${toast.type === "error" ? "bg-red-600" : "bg-emerald-600"} text-white`}>
          {toast.type === "error" ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
          {toast.message}
        </div>
      )}
    </div>
  );
}
