package com.inkgrid.app;

import android.graphics.Color;
import android.os.Bundle;

import androidx.core.splashscreen.SplashScreen;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Bridge;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        SplashScreen.installSplashScreen(this);
        setTheme(R.style.AppTheme_NoActionBar);
        super.onCreate(savedInstanceState);
        registerPlugin(InkgridNotificationsPlugin.class);
        registerPlugin(InkgridMediaPlugin.class);
        registerPlugin(InkgridExamIslandPlugin.class);

        try {
            Bridge bridge = this.getBridge();
            if (bridge != null && bridge.getWebView() != null) {
                bridge.getWebView().setBackgroundColor(Color.parseColor("#070707"));
            }
        } catch (Exception ignored) {
            // best-effort: avoid white flash while WebView boots
        }
    }
}
