package com.inkgrid.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import androidx.core.app.NotificationManagerCompat;

public class InkgridNotificationReceiver extends BroadcastReceiver {
    public static final String ACTION_CANCEL_INKFLOW = "com.inkgrid.app.ACTION_CANCEL_INKFLOW";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (ACTION_CANCEL_INKFLOW.equals(action)) {
            NotificationManagerCompat.from(context).cancel(InkgridNotificationsPlugin.NOTIFICATION_ID);
        }
    }
}
