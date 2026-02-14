package com.flowpos.pro;

import android.os.Bundle;
import android.content.res.Configuration;
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
    }
}
