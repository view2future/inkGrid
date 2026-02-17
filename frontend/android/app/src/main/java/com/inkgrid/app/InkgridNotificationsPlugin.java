package com.inkgrid.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "InkgridNotifications")
public class InkgridNotificationsPlugin extends Plugin {
    static final String CHANNEL_ID = "inkflow";
    static final int NOTIFICATION_ID = 1001;

    @PluginMethod
    public void showInkFlowNotification(PluginCall call) {
        String title = call.getString("title", "墨流");
        String subtitle = call.getString("subtitle", "");
        String deepLinkUrl = call.getString("deepLinkUrl");
        String nextDeepLinkUrl = call.getString("nextDeepLinkUrl");
        Boolean ongoing = call.getBoolean("ongoing", false);
        Integer progress = call.getInt("progress");
        Integer progressMax = call.getInt("progressMax");

        ensureChannel();

        PendingIntent contentIntent = buildOpenPendingIntent(deepLinkUrl, 1);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(getContext(), CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(subtitle)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(subtitle))
                .setContentIntent(contentIntent)
                .setOnlyAlertOnce(true)
                .setOngoing(Boolean.TRUE.equals(ongoing))
                .setAutoCancel(!Boolean.TRUE.equals(ongoing))
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC);

        if (progress != null && progressMax != null && progressMax > 0) {
            int safeProgress = Math.min(progress, progressMax);
            builder.setProgress(progressMax, safeProgress, false);
        }

        if (nextDeepLinkUrl != null && !nextDeepLinkUrl.isEmpty()) {
            PendingIntent nextIntent = buildOpenPendingIntent(nextDeepLinkUrl, 2);
            builder.addAction(R.mipmap.ic_launcher, "下一页", nextIntent);
        }

        builder.addAction(R.mipmap.ic_launcher, "打开", contentIntent);
        builder.addAction(R.mipmap.ic_launcher, "关闭", buildCancelPendingIntent());

        NotificationManagerCompat.from(getContext()).notify(NOTIFICATION_ID, builder.build());
        call.resolve();
    }

    @PluginMethod
    public void cancelInkFlowNotification(PluginCall call) {
        NotificationManagerCompat.from(getContext()).cancel(NOTIFICATION_ID);
        call.resolve();
    }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        Context ctx = getContext();
        NotificationManager manager = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;
        NotificationChannel existing = manager.getNotificationChannel(CHANNEL_ID);
        if (existing != null) return;

        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "墨流",
                NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("墨流进度与快捷入口");
        manager.createNotificationChannel(channel);
    }

    private PendingIntent buildOpenPendingIntent(String url, int requestCode) {
        Context ctx = getContext();
        Intent intent;

        if (url != null && !url.isEmpty()) {
            intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        } else {
            intent = new Intent(ctx, MainActivity.class);
        }

        intent.setClass(ctx, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        return PendingIntent.getActivity(ctx, requestCode, intent, flags);
    }

    private PendingIntent buildCancelPendingIntent() {
        Context ctx = getContext();
        Intent intent = new Intent(ctx, InkgridNotificationReceiver.class);
        intent.setAction(InkgridNotificationReceiver.ACTION_CANCEL_INKFLOW);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        return PendingIntent.getBroadcast(ctx, 3, intent, flags);
    }
}
