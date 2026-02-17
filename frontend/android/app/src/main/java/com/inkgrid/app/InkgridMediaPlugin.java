package com.inkgrid.app;

import android.Manifest;
import android.content.ClipData;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@CapacitorPlugin(
    name = "InkgridMedia",
    permissions = {
        @Permission(strings = { Manifest.permission.READ_MEDIA_IMAGES }, alias = InkgridMediaPlugin.PERM_PHOTOS),
        @Permission(strings = { Manifest.permission.READ_EXTERNAL_STORAGE }, alias = InkgridMediaPlugin.PERM_LEGACY_READ),
        @Permission(strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE }, alias = InkgridMediaPlugin.PERM_LEGACY_WRITE)
    }
)
public class InkgridMediaPlugin extends Plugin {
    private static final String TAG = "InkgridMedia";

    static final String PERM_PHOTOS = "photos";
    static final String PERM_LEGACY_READ = "legacyRead";
    static final String PERM_LEGACY_WRITE = "legacyWrite";

    private static final String RELATIVE_ALBUM_PATH = Environment.DIRECTORY_DCIM + "/MoZhen";

    private static class PngSession {
        public final File file;
        public final OutputStream out;
        public final String displayName;
        public int bytesWritten;

        public PngSession(File file, OutputStream out, String displayName) {
            this.file = file;
            this.out = out;
            this.displayName = displayName;
            this.bytesWritten = 0;
        }
    }

    private static final Map<String, PngSession> SESSIONS = new ConcurrentHashMap<>();

    @PluginMethod
    public void beginPngSession(PluginCall call) {
        String filename = call.getString("filename", "mozzhen_poster.png");
        String safeName = sanitizeFilename(filename);
        if (!safeName.toLowerCase().endsWith(".png")) safeName = safeName + ".png";

        Context ctx = getContext();
        File dir = new File(ctx.getCacheDir(), "mozzhen");
        if (!dir.exists()) {
            //noinspection ResultOfMethodCallIgnored
            dir.mkdirs();
        }

        String sessionId = UUID.randomUUID().toString();
        File file = new File(dir, sessionId + "_" + safeName);

        OutputStream out;
        try {
            out = new FileOutputStream(file, false);
        } catch (Exception e) {
            Log.e(TAG, "beginPngSession: failed to create temp file", e);
            call.reject("failed to create temp file: " + e.getMessage());
            return;
        }

        SESSIONS.put(sessionId, new PngSession(file, out, safeName));

        JSObject ret = new JSObject();
        ret.put("sessionId", sessionId);
        call.resolve(ret);
    }

    @PluginMethod
    public void appendPngChunk(PluginCall call) {
        String sessionId = call.getString("sessionId", "");
        String chunk = call.getString("chunk", "");

        if (sessionId == null || sessionId.isEmpty()) {
            call.reject("missing sessionId");
            return;
        }
        if (chunk == null || chunk.isEmpty()) {
            call.reject("missing chunk");
            return;
        }

        PngSession session = SESSIONS.get(sessionId);
        if (session == null) {
            call.reject("invalid sessionId");
            return;
        }

        String normalized = chunk.trim();
        int mod = normalized.length() % 4;
        if (mod != 0) {
            int pad = 4 - mod;
            normalized = normalized + "====".substring(0, pad);
        }

        byte[] bytes;
        try {
            bytes = Base64.decode(normalized, Base64.DEFAULT);
        } catch (Exception e) {
            Log.e(TAG, "appendPngChunk: invalid base64", e);
            call.reject("invalid base64 chunk: " + e.getMessage());
            return;
        }

        if (bytes == null || bytes.length == 0) {
            call.reject("empty chunk");
            return;
        }

        try {
            session.out.write(bytes);
            session.bytesWritten += bytes.length;
            JSObject ret = new JSObject();
            ret.put("bytesWritten", session.bytesWritten);
            call.resolve(ret);
        } catch (IOException e) {
            Log.e(TAG, "appendPngChunk: write failed", e);
            call.reject("write failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void finishPngSession(PluginCall call) {
        String mode = call.getString("mode", "save");
        if ("save".equalsIgnoreCase(mode)) {
            if (requiresSavePermission() && !hasSavePermission()) {
                requestPermissionForAlias(getSavePermissionAlias(), call, "finishPngSessionPermissions");
                return;
            }
        }
        finishInternal(call);
    }

    @PermissionCallback
    private void finishPngSessionPermissions(PluginCall call) {
        if (requiresSavePermission() && !hasSavePermission()) {
            cleanupSession(call.getString("sessionId", ""));
            call.reject("permission denied");
            return;
        }
        finishInternal(call);
    }

    private void finishInternal(PluginCall call) {
        String sessionId = call.getString("sessionId", "");
        String mode = call.getString("mode", "save");
        String dialogTitle = call.getString("dialogTitle", "分享海报");
        String title = call.getString("title", "");
        String text = call.getString("text", "");

        if (sessionId == null || sessionId.isEmpty()) {
            call.reject("missing sessionId");
            return;
        }

        PngSession session = SESSIONS.remove(sessionId);
        if (session == null) {
            call.reject("invalid sessionId");
            return;
        }

        try {
            try {
                session.out.flush();
            } catch (Exception ignored) {}
            try {
                session.out.close();
            } catch (Exception ignored) {}

            String uri;
            if ("share".equalsIgnoreCase(mode)) {
                uri = shareTempFile(session.file, title, text, dialogTitle);
            } else {
                uri = saveTempFileToGallery(session.file, session.displayName);
                Toast.makeText(getContext(), "已保存到相册", Toast.LENGTH_SHORT).show();
                //noinspection ResultOfMethodCallIgnored
                session.file.delete();
            }

            JSObject ret = new JSObject();
            ret.put("uri", uri);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "finishPngSession: finish failed", e);
            //noinspection ResultOfMethodCallIgnored
            session.file.delete();
            call.reject("finish failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void cancelPngSession(PluginCall call) {
        String sessionId = call.getString("sessionId", "");
        cleanupSession(sessionId);
        call.resolve();
    }

    // Legacy single-shot API (kept for backward compatibility).
    @PluginMethod
    public void savePngToGallery(PluginCall call) {
        String base64 = call.getString("base64", "");
        String filename = call.getString("filename", "mozzhen_poster.png");
        if (base64 == null || base64.isEmpty()) {
            call.reject("missing base64");
            return;
        }

        byte[] bytes;
        try {
            bytes = Base64.decode(base64, Base64.DEFAULT);
        } catch (Exception e) {
            Log.e(TAG, "savePngToGallery: invalid base64", e);
            call.reject("invalid base64: " + e.getMessage());
            return;
        }

        if (bytes == null || bytes.length == 0) {
            call.reject("empty image");
            return;
        }

        if (requiresSavePermission() && !hasSavePermission()) {
            requestPermissionForAlias(getSavePermissionAlias(), call, "savePngToGalleryPermissions");
            return;
        }

        try {
            String safeName = sanitizeFilename(filename);
            if (!safeName.toLowerCase().endsWith(".png")) safeName = safeName + ".png";

            Context ctx = getContext();
            File dir = new File(ctx.getCacheDir(), "mozzhen");
            if (!dir.exists()) {
                //noinspection ResultOfMethodCallIgnored
                dir.mkdirs();
            }
            File tmp = new File(dir, UUID.randomUUID().toString() + "_" + safeName);
            OutputStream out = new FileOutputStream(tmp, false);
            out.write(bytes);
            out.flush();
            out.close();

            String uri = saveTempFileToGallery(tmp, safeName);
            Toast.makeText(getContext(), "已保存到相册", Toast.LENGTH_SHORT).show();
            //noinspection ResultOfMethodCallIgnored
            tmp.delete();

            JSObject ret = new JSObject();
            ret.put("uri", uri);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "savePngToGallery: save failed", e);
            call.reject("save failed: " + e.getMessage());
        }
    }

    @PermissionCallback
    private void savePngToGalleryPermissions(PluginCall call) {
        if (requiresSavePermission() && !hasSavePermission()) {
            call.reject("permission denied");
            return;
        }
        savePngToGallery(call);
    }

    private void cleanupSession(String sessionId) {
        if (sessionId == null || sessionId.isEmpty()) return;
        PngSession session = SESSIONS.remove(sessionId);
        if (session == null) return;
        try {
            try {
                session.out.close();
            } catch (Exception ignored) {}
            //noinspection ResultOfMethodCallIgnored
            session.file.delete();
        } catch (Exception ignored) {}
    }

    private boolean requiresSavePermission() {
        // MediaStore insert on Android 10+ does not require storage permissions.
        // Only legacy external storage (Android 9 and below) needs WRITE permission.
        return Build.VERSION.SDK_INT <= Build.VERSION_CODES.P;
    }

    private String getSavePermissionAlias() {
        return PERM_LEGACY_WRITE;
    }

    private boolean hasSavePermission() {
        PermissionState state = getPermissionState(getSavePermissionAlias());
        return state == PermissionState.GRANTED;
    }

    private String shareTempFile(File file, String title, String text, String dialogTitle) {
        Context ctx = getContext();
        String authority = ctx.getPackageName() + ".fileprovider";
        Uri uri = FileProvider.getUriForFile(ctx, authority, file);

        Intent intent = new Intent(Intent.ACTION_SEND);
        intent.setType("image/png");
        intent.putExtra(Intent.EXTRA_STREAM, uri);
        if (text != null && !text.isEmpty()) {
            intent.putExtra(Intent.EXTRA_TEXT, text);
        }
        if (title != null && !title.isEmpty()) {
            intent.putExtra(Intent.EXTRA_SUBJECT, title);
        }
        intent.setClipData(ClipData.newUri(ctx.getContentResolver(), "poster", uri));
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

        Intent chooser = Intent.createChooser(intent, dialogTitle == null || dialogTitle.isEmpty() ? "分享海报" : dialogTitle);
        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        ctx.startActivity(chooser);
        return uri.toString();
    }

    private String saveTempFileToGallery(File file, String displayName) throws IOException {
        String safeName = sanitizeFilename(displayName);
        if (!safeName.toLowerCase().endsWith(".png")) safeName = safeName + ".png";

        Context ctx = getContext();
        ContentResolver resolver = ctx.getContentResolver();

        ContentValues values = new ContentValues();
        values.put(MediaStore.Images.Media.DISPLAY_NAME, safeName);
        values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            values.put(MediaStore.Images.Media.RELATIVE_PATH, RELATIVE_ALBUM_PATH);
            values.put(MediaStore.Images.Media.IS_PENDING, 1);
        }

        Uri uri = null;
        OutputStream out = null;
        FileInputStream in = null;
        try {
            uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
            if (uri == null) throw new IOException("failed to create image");
            out = resolver.openOutputStream(uri);
            if (out == null) throw new IOException("failed to open output stream");
            in = new FileInputStream(file);
            byte[] buf = new byte[32 * 1024];
            int n;
            while ((n = in.read(buf)) >= 0) {
                if (n == 0) continue;
                out.write(buf, 0, n);
            }
            out.flush();

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues done = new ContentValues();
                done.put(MediaStore.Images.Media.IS_PENDING, 0);
                resolver.update(uri, done, null, null);
            }

            return uri.toString();
        } catch (IOException e) {
            if (uri != null) {
                try {
                    resolver.delete(uri, null, null);
                } catch (Exception ignored) {}
            }
            throw e;
        } finally {
            if (in != null) {
                try {
                    in.close();
                } catch (Exception ignored) {}
            }
            if (out != null) {
                try {
                    out.close();
                } catch (Exception ignored) {}
            }
        }
    }

    private String sanitizeFilename(String input) {
        if (input == null) return "mozzhen_poster.png";
        String s = input.trim();
        if (s.isEmpty()) return "mozzhen_poster.png";
        s = s.replace("/", "_").replace("\\\\", "_");
        s = s.replaceAll("[\\u0000-\\u001F]", "");
        s = s.replaceAll("\\s+", " ");
        if (s.length() > 64) s = s.substring(0, 64);
        return s;
    }
}
