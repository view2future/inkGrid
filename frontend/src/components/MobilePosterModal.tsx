import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, Share2, X } from 'lucide-react';
import { type PosterKind, type PosterTemplate, INKGRID_QR_LABEL, renderPosterPng } from '../utils/poster';

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

  const templates = useMemo(
    () =>
      [
        { id: 'folio' as const, label: '册页' },
        { id: 'wash' as const, label: '水墨' },
        { id: 'minimal' as const, label: '素白' },
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
    setIsBusy(true);
    setErrorText(null);
    setTip(null);

    const run = async () => {
      try {
        const res =
          target.kind === 'char'
            ? await renderPosterPng({ kind: 'char', template, data: target.data })
            : await renderPosterPng({ kind: 'stele', template, data: target.data });
        if (cancelled) return;

        if (previewUrl) URL.revokeObjectURL(previewUrl);
        const url = URL.createObjectURL(res.blob);
        setPreviewUrl(url);
        setPreviewBlob(res.blob);
      } catch (err) {
        if (cancelled) return;
        setErrorText('生成海报失败，请稍后重试。');
      } finally {
        if (!cancelled) setIsBusy(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [isOpen, template, targetKey]);

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
    try {
      const url = URL.createObjectURL(previewBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setTip('已尝试保存；若无反应，请长按图片保存。');
    } catch {
      setTip('请长按图片保存到手机本地。');
    }
  };

  const shareWithFile = async (label: string) => {
    if (!previewBlob) return;

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
            className="absolute inset-x-0 top-[env(safe-area-inset-top)] bottom-[env(safe-area-inset-bottom)] flex flex-col"
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
              <div className="flex bg-white/10 border border-white/10 rounded-full p-1">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTemplate(t.id)}
                    className={`flex-1 px-4 py-2 rounded-full text-[11px] font-black tracking-[0.45em] pl-[0.45em] transition ${
                      template === t.id ? 'bg-[#8B0000] text-[#F2E6CE]' : 'text-stone-300'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
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
                  </div>
                </div>

                {errorText ? <div className="mt-4 text-center text-sm text-red-200">{errorText}</div> : null}
                {tip ? <div className="mt-4 text-center text-[12px] font-serif text-stone-300">{tip}</div> : null}

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <button
                    onClick={handleDownload}
                    disabled={!previewBlob || isBusy}
                    className="flex items-center justify-center gap-3 px-4 py-4 rounded-[1.25rem] bg-white/10 border border-white/10 text-stone-100 text-[12px] font-black tracking-[0.35em] pl-[0.35em] active:scale-95 transition disabled:opacity-40"
                  >
                    <Download size={16} />
                    保存海报
                  </button>

                  <button
                    onClick={() => shareWithFile('发给好友')}
                    disabled={!previewBlob || isBusy}
                    className="flex items-center justify-center gap-3 px-4 py-4 rounded-[1.25rem] bg-[#8B0000] border border-[#8B0000]/60 text-[#F2E6CE] text-[12px] font-black tracking-[0.35em] pl-[0.35em] shadow-[0_18px_45px_rgba(139,0,0,0.35)] active:scale-95 transition disabled:opacity-40"
                  >
                    <Share2 size={16} />
                    发给好友
                  </button>
                </div>

                <button
                  onClick={() => shareWithFile('分享到朋友圈')}
                  disabled={!previewBlob || isBusy}
                  className="mt-3 w-full flex items-center justify-center gap-3 px-4 py-4 rounded-[1.25rem] bg-white/10 border border-white/10 text-stone-100 text-[12px] font-black tracking-[0.35em] pl-[0.35em] active:scale-95 transition disabled:opacity-40"
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
    </AnimatePresence>
  );
}
