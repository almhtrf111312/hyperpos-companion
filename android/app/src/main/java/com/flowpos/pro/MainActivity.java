package com.flowpos.pro;

import android.os.Bundle;
import android.content.res.Configuration;
import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.webkit.WebSettings;
import java.util.Locale;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Force English/US locale to prevent Arabic/Hindi digit substitution
        Locale locale = new Locale("en", "US");
        Locale.setDefault(locale);

        Configuration config = getBaseContext().getResources().getConfiguration();
        config.setLocale(locale);
        getBaseContext().getResources().updateConfiguration(config,
                getBaseContext().getResources().getDisplayMetrics());

        super.onCreate(savedInstanceState);

        try {
            WebView webView = this.bridge.getWebView();
            if (webView != null) {
                // Ensure persistent DOM storage and caching for instant offline app experience
                WebSettings settings = webView.getSettings();
                settings.setDomStorageEnabled(true);
                settings.setDatabaseEnabled(true);
                settings.setCacheMode(WebSettings.LOAD_DEFAULT);

                // Native Android Print Service Integration
                webView.addJavascriptInterface(new Object() {
                    @JavascriptInterface
                    public void print() {
                        runOnUiThread(() -> {
                            try {
                                PrintManager printManager = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                                if (printManager != null) {
                                    PrintDocumentAdapter printAdapter = webView.createPrintDocumentAdapter("FlowPOS_PrintJob");
                                    printManager.print("FlowPOS Print", printAdapter, new PrintAttributes.Builder().build());
                                }
                            } catch (Exception e) {
                                e.printStackTrace();
                            }
                        });
                    }
                }, "AndroidPrinter");
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    public void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        try {
            if (this.bridge != null && this.bridge.getWebView() != null) {
                this.bridge.getWebView().saveState(outState);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    protected void onRestoreInstanceState(Bundle savedInstanceState) {
        super.onRestoreInstanceState(savedInstanceState);
        try {
            if (this.bridge != null && this.bridge.getWebView() != null) {
                this.bridge.getWebView().restoreState(savedInstanceState);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
