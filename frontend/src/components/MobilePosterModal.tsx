import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, Share2, X } from 'lucide-react';
import { type PosterKind, type PosterTemplate, INKGRID_QR_LABEL, renderPosterPng } from '../utils/poster';
import { sharePngToApps, savePngToGallery } from '../native/media';
import { Capacitor } from '@capacitor/core';

type PosterTarget =
  | {
      kind: 'char';
      title: string;
      data: {
        simplified?: string;
        pinyin?: string;
        meaning?: string;
        en_word?: string;
        en_meaning?: string;
        image: string;
        sourceTitle?: string;
        author?: string;
        dynasty?: string;
      };
    }
  | {
      kind: 'stele';
      title: string;
      data: {
        name: string;
        author: string;
        dynasty: string;
        script_type: string;
        year?: string;
        type?: string;
        location: string;
        total_chars: number;
        description?: string;
        content?: string;
      };
    };

export default function MobilePosterModal({
  isOpen,
  target,
  onClose,
}: {
  isOpen: boolean;
  target: PosterTarget;
  onClose: () => void;
}) {
  const [template, setTemplate] = useState<PosterTemplate>('folio');
  const [isBusy, setIsBusy] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [tip, setTip] = useState<string | null>(null);
  const [toastText, setToastText] = useState<string | null>(null);
  const [loadingIndex, setLoadingIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const loadingNotes = useMemo(
    () =>
      [
        { title: '正在研墨…', text: '中鋒用筆，藏鋒起收，氣息自然生。' },
        { title: '正在拓印…', text: '看字先看勢：勢立則氣生，筆到意到。' },
        { title: '正在排章…', text: '疏可走馬，密不透風；章法如呼吸。' },
        { title: '正在落款…', text: '轉折處見筋骨，提按間見節奏。' },
        { title: '正在成帖…', text: '一字一世界，慢讀方見其厚。' },
      ],
    []
  );

  const templates = useMemo(
    () =>
      [
        { id: 'folio' as const, label: '册页', hint: '装帧', swatch: '#C9A46A' },
        { id: 'minimal' as const, label: '展签', hint: '留白', swatch: '#F8F8F4' },
        { id: 'night' as const, label: '乌金', hint: '夜墨', swatch: '#0B0B0E' },
      ],
    []
  );

  const targetKey = useMemo(() => {
    if (target.kind === 'char') {
      const d = target.data;
      return [
        'char',
        d.image,
        d.simplified || '',
        d.pinyin || '',
        (d.meaning || '').slice(0, 80),
        d.en_word || '',
        (d.en_meaning || '').slice(0, 80),
      ].join('|');
    }
    const d = target.data;
    return [
      'stele',
      d.name,
      d.author,
      d.dynasty,
      d.script_type,
      d.location,
      String(d.total_chars),
      (d.description || '').slice(0, 80),
      String((d.content || '').length),
    ].join('|');
  }, [target]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    let watchdog: number | null = null;
    setIsBusy(true);
    setErrorText(null);
    setTip(null);

    const run = async () => {
      watchdog = window.setTimeout(() => {
        cancelled = true;
        setErrorText('生成海报超时，请重试。');
        setIsBusy(false);
      }, 12000);

      try {
        const res =
          target.kind === 'char'
            ? await renderPosterPng({ kind: 'char', template, data: target.data }, { pixelRatio: 1 })
            : await renderPosterPng({ kind: 'stele', template, data: target.data }, { pixelRatio: 1 });
        if (cancelled) return;

        if (previewUrl) URL.revokeObjectURL(previewUrl);
        const url = URL.createObjectURL(res.blob);
        setPreviewUrl(url);
        setPreviewBlob(res.blob);
      } catch (err) {
        if (cancelled) return;
        console.error('[MobilePosterModal] Failed to generate poster', err);
        setErrorText('生成海报失败，请稍后重试。');
      } finally {
        if (watchdog !== null) window.clearTimeout(watchdog);
        watchdog = null;
        if (!cancelled) setIsBusy(false);
      }
    };

    run();
    return () => {
      cancelled = true;
      if (watchdog !== null) window.clearTimeout(watchdog);
    };
  }, [isOpen, template, targetKey]);

  useEffect(() => {
    if (!isOpen) return;
    if (!loadingNotes.length) return;
    setLoadingIndex(Math.floor(Math.random() * loadingNotes.length));
  }, [isOpen, targetKey, template, loadingNotes.length]);

  useEffect(() => {
    if (!isOpen) return;
    if (!isBusy) return;
    if (loadingNotes.length <= 1) return;

    const timer = window.setInterval(() => {
      setLoadingIndex((i) => (i + 1) % loadingNotes.length);
    }, 2600);

    return () => window.clearInterval(timer);
  }, [isOpen, isBusy, loadingNotes.length]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const filename = useMemo(() => {
    const date = new Date();
    const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    if (target.kind === 'char') {
      const s = (target.data.simplified || 'char').trim() || 'char';
      return `inkgrid_${stamp}_${s}.png`;
    }
    const n = target.data.name.replace(/\s+/g, '').slice(0, 12) || 'stele';
    return `inkgrid_${stamp}_${n}.png`;
  }, [target.kind, target.data]);

  const handleDownload = async () => {
    if (!previewBlob) return;

    const showToast = (text: string) => {
      setToastText(text);
      window.setTimeout(() => setToastText(null), 1600);
    };

    const blobToBase64 = (blob: Blob) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('read failed'));
        reader.onload = () => {
          const res = String(reader.result || '');
          const idx = res.indexOf(',');
          resolve(idx >= 0 ? res.slice(idx + 1) : res);
        };
        reader.readAsDataURL(blob);
      });

    try {
      setIsSaving(true);
      setTip(null);

      // Native Android: save into system gallery via MediaStore.
      const base64 = await blobToBase64(previewBlob);
      const nativeRes = await savePngToGallery(base64, filename);
      if (nativeRes.ok) {
        showToast('已保存到相册');
        return;
      }

      // Web fallback.
      const url = URL.createObjectURL(previewBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast('已开始下载');
      setTip('已尝试保存；若无反应，请长按图片保存。');
    } catch {
      showToast('保存失败');
      setTip('保存失败；可长按图片保存到手机本地。');
    } finally {
      setIsSaving(false);
    }
  };

  const shareWithFile = async (label: string) => {
    if (!previewBlob) return;

    const blobToBase64 = (blob: Blob) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('read failed'));
        reader.onload = () => {
          const res = String(reader.result || '');
          const idx = res.indexOf(',');
          resolve(idx >= 0 ? res.slice(idx + 1) : res);
        };
        reader.readAsDataURL(blob);
      });

    const showToast = (text: string) => {
      setToastText(text);
      window.setTimeout(() => setToastText(null), 1600);
    };

    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
      try {
        setIsSaving(true);
        const base64 = await blobToBase64(previewBlob);
        const res = await sharePngToApps(base64, filename, {
          dialogTitle: label,
          title: target.title,
          text: `${target.title} · ${INKGRID_QR_LABEL}`,
        });
        if (res.ok) {
          showToast('已打开分享');
          return;
        }
        showToast('分享失败');
        setTip(`分享失败；可先保存海报，再在微信 ${label}。`);
      } catch {
        showToast('分享失败');
        setTip(`分享失败；可先保存海报，再在微信 ${label}。`);
      } finally {
        setIsSaving(false);
      }
      return;
    }

    const file = new File([previewBlob], filename, { type: 'image/png' });
    const nav: any = navigator;
    if (!nav?.share) {
      setTip(`当前环境不支持一键分享，请先保存海报，再在微信 ${label}。`);
      return;
    }

    try {
      if (nav.canShare && !nav.canShare({ files: [file] })) {
        setTip(`无法直接分享图片，请先保存海报，再在微信 ${label}。`);
        return;
      }
      await nav.share({
        title: target.title,
        text: `${target.title} · ${INKGRID_QR_LABEL}`,
        files: [file],
      });
    } catch {
      setTip(`分享未完成；可长按保存海报，再在微信 ${label}。`);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-2xl"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 18, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 18, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            className="absolute inset-x-0 top-[max(env(safe-area-inset-top),32px)] bottom-[env(safe-area-inset-bottom)] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-4 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 bg-[#8B0000] rotate-45" />
                <span className="text-[11px] font-black tracking-[0.6em] pl-[0.6em] text-[#F2E6CE]">海报</span>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-stone-200"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-5 pb-4">
              <div className="grid grid-cols-3 gap-2 bg-white/10 border border-white/10 rounded-[1.25rem] p-2">
                {templates.map((t) => {
                  const active = template === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTemplate(t.id)}
                      className={`flex items-center justify-center text-center px-3 py-2.5 rounded-[1.05rem] transition active:scale-[0.99] ${
                        active
                          ? 'bg-[#8B0000] text-[#F2E6CE] shadow-[0_14px_40px_rgba(139,0,0,0.28)]'
                          : 'bg-white/5 text-stone-200 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex flex-col items-center leading-tight">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${active ? 'ring-1 ring-[#F2E6CE]/60' : 'ring-1 ring-white/20'}`}
                            style={{ backgroundColor: t.swatch }}
                            aria-hidden
                          />
                          <span className="text-[11px] font-black tracking-[0.18em]">{t.label}</span>
                        </div>
                        <span className={`mt-1 text-[9px] font-serif tracking-[0.2em] ${active ? 'text-[#F2E6CE]/90' : 'text-stone-400'}`}>{t.hint}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5">
              <div className="max-w-md mx-auto">
                <div className="rounded-[2rem] bg-white/5 border border-white/10 shadow-[0_40px_120px_rgba(0,0,0,0.65)] overflow-hidden">
                  <div className="relative w-full aspect-[9/16] bg-black/30">
                    {previewUrl ? (
                      <img src={previewUrl} alt="poster" className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-stone-400 text-sm font-serif">
                        {isBusy ? '正在生成…' : '预览不可用'}
                      </div>
                    )}
                    {isBusy ? (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <div className="w-10 h-10 rounded-full border-2 border-white/20 border-t-white/70 animate-spin" />
                      </div>
                    ) : null}

                    <AnimatePresence mode="wait">
                      {isBusy && loadingNotes[loadingIndex] ? (
                        <motion.div
                          key={loadingIndex}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 8 }}
                          transition={{ duration: 0.5, ease: 'easeOut' }}
                          className="absolute inset-x-4 top-1/2 -translate-y-1/2"
                        >
                          <div className="rounded-[1.5rem] bg-black/40 border border-white/10 shadow-[0_22px_70px_rgba(0,0,0,0.55)] backdrop-blur-md px-5 py-4">
                            <div className="text-[10px] font-black tracking-[0.22em] text-[#F2E6CE] opacity-90">
                              {loadingNotes[loadingIndex].title}
                            </div>
                            <div className="mt-2 text-[12px] font-serif text-stone-200 leading-relaxed tracking-wide">
                              {loadingNotes[loadingIndex].text}
                            </div>
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>
                </div>

                {errorText ? <div className="mt-4 text-center text-sm text-red-200">{errorText}</div> : null}
                {tip ? <div className="mt-4 text-center text-[12px] font-serif text-stone-300">{tip}</div> : null}

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <button
                    onClick={handleDownload}
                    disabled={!previewBlob || isBusy || isSaving}
                    className="flex items-center justify-center gap-3 px-4 py-4 rounded-[1.25rem] bg-white/10 border border-white/10 text-stone-100 text-[12px] font-black tracking-[0.18em] text-center active:scale-95 transition disabled:opacity-40"
                  >
                    <Download size={16} />
                    保存典藏海报
                  </button>

                  <button
                    onClick={() => shareWithFile('发给好友')}
                    disabled={!previewBlob || isBusy || isSaving}
                    className="flex items-center justify-center gap-3 px-4 py-4 rounded-[1.25rem] bg-[#8B0000] border border-[#8B0000]/60 text-[#F2E6CE] text-[12px] font-black tracking-[0.18em] text-center shadow-[0_18px_45px_rgba(139,0,0,0.35)] active:scale-95 transition disabled:opacity-40"
                  >
                    <Share2 size={16} />
                    发给好友
                  </button>
                </div>

                <button
                  onClick={() => shareWithFile('分享到朋友圈')}
                  disabled={!previewBlob || isBusy || isSaving}
                  className="mt-3 w-full flex items-center justify-center gap-3 px-4 py-4 rounded-[1.25rem] bg-white/10 border border-white/10 text-stone-100 text-[12px] font-black tracking-[0.18em] text-center active:scale-95 transition disabled:opacity-40"
                >
                  <Share2 size={16} />
                  发到朋友圈
                </button>

                <div className="mt-6 pb-10 text-center text-[11px] font-serif text-stone-300 opacity-80 leading-relaxed">
                  如果一键分享不可用：先保存海报，再在微信里发送/发朋友圈。
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      <AnimatePresence>
        {toastText ? (
          <motion.div
            key={toastText}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="fixed left-1/2 -translate-x-1/2 bottom-[calc(2rem+env(safe-area-inset-bottom))] z-[310]"
          >
            <div className="px-5 py-3 rounded-full bg-black/70 border border-white/10 text-[#F2E6CE] text-[12px] font-black tracking-[0.18em] shadow-[0_18px_50px_rgba(0,0,0,0.55)]">
              {toastText}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </AnimatePresence>
  );
}
