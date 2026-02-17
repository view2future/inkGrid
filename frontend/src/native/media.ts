import { Capacitor, registerPlugin } from '@capacitor/core';

type SavePngOptions = {
  base64: string;
  filename: string;
};

type BeginPngSessionOptions = {
  filename: string;
};

type AppendPngChunkOptions = {
  sessionId: string;
  chunk: string;
};

type FinishPngSessionOptions = {
  sessionId: string;
  mode: 'save' | 'share';
  dialogTitle?: string;
  title?: string;
  text?: string;
};

type InkgridMediaPlugin = {
  // Legacy single-shot API (may fail for large base64 payloads).
  savePngToGallery?: (options: SavePngOptions) => Promise<{ uri?: string }>;

  // Chunked APIs for large payloads.
  beginPngSession: (options: BeginPngSessionOptions) => Promise<{ sessionId: string }>;
  appendPngChunk: (options: AppendPngChunkOptions) => Promise<{ bytesWritten?: number }>;
  finishPngSession: (options: FinishPngSessionOptions) => Promise<{ uri?: string }>;
  cancelPngSession: (options: { sessionId: string }) => Promise<void>;
};

const InkgridMedia = registerPlugin<InkgridMediaPlugin>('InkgridMedia');

function isAndroidNative() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

async function writePngByChunks(base64: string, filename: string, mode: 'save' | 'share', opts?: Omit<FinishPngSessionOptions, 'sessionId' | 'mode'>) {
  const payload = String(base64 || '').trim();
  const name = String(filename || '').trim() || 'mozzhen_poster.png';

  // Keep chunks small to avoid WebView bridge payload limits.
  const chunkSizeRaw = 32 * 1024;
  const chunkSize = chunkSizeRaw - (chunkSizeRaw % 4);

  const session = await InkgridMedia.beginPngSession({ filename: name });
  const sessionId = String(session?.sessionId || '').trim();
  if (!sessionId) throw new Error('missing sessionId');

  try {
    for (let i = 0; i < payload.length; i += chunkSize) {
      const chunk = payload.slice(i, i + chunkSize);
      await InkgridMedia.appendPngChunk({ sessionId, chunk });
    }
    const res = await InkgridMedia.finishPngSession({ sessionId, mode, ...opts });
    return { ok: true as const, uri: res?.uri };
  } catch (err) {
    try {
      await InkgridMedia.cancelPngSession({ sessionId });
    } catch {
      // ignore
    }
    throw err;
  }
}

export async function savePngToGallery(base64: string, filename: string): Promise<{ ok: boolean; uri?: string }> {
  if (!isAndroidNative()) return { ok: false };

  try {
    const res = await writePngByChunks(base64, filename, 'save');
    return { ok: true, uri: res?.uri };
  } catch (err) {
    console.error('[media] savePngToGallery failed', {
      filename,
      base64Len: String(base64 || '').length,
      error: err instanceof Error ? err.message : String(err),
    });
    // Fallback: legacy method (best-effort).
    try {
      if (InkgridMedia.savePngToGallery) {
        const res = await InkgridMedia.savePngToGallery({ base64, filename });
        return { ok: true, uri: res?.uri };
      }
    } catch (err2) {
      console.error('[media] legacy savePngToGallery failed', {
        filename,
        base64Len: String(base64 || '').length,
        error: err2 instanceof Error ? err2.message : String(err2),
      });
      // ignore
    }
    return { ok: false };
  }
}

export async function sharePngToApps(
  base64: string,
  filename: string,
  opts?: { dialogTitle?: string; title?: string; text?: string }
): Promise<{ ok: boolean; uri?: string }> {
  if (!isAndroidNative()) return { ok: false };
  try {
    const res = await writePngByChunks(base64, filename, 'share', {
      dialogTitle: opts?.dialogTitle,
      title: opts?.title,
      text: opts?.text,
    });
    return { ok: true, uri: res?.uri };
  } catch (err) {
    console.error('[media] sharePngToApps failed', {
      filename,
      base64Len: String(base64 || '').length,
      dialogTitle: opts?.dialogTitle,
      title: opts?.title,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false };
  }
}
