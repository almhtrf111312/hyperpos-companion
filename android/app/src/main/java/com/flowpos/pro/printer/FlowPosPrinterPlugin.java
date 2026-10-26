package com.flowpos.pro.printer;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothSocket;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;

import androidx.activity.result.ActivityResult;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.IOException;
import java.io.OutputStream;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * جسر بلوتوث كلاسيكي (SPP) للطابعات الحرارية.
 * كل الطلبات الثقيلة (اتصال، كتابة) بتصير على thread خلفي، والـ UI ما بينحجب.
 */
@CapacitorPlugin(
    name = "FlowPosPrinter",
    permissions = {
        @Permission(alias = "bluetooth", strings = {
            Manifest.permission.BLUETOOTH_SCAN,
            Manifest.permission.BLUETOOTH_CONNECT
        }),
        @Permission(alias = "location", strings = {
            Manifest.permission.ACCESS_FINE_LOCATION
        })
    }
)
public class FlowPosPrinterPlugin extends Plugin {

    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805f9b34fb");
    // ابدأ بـ 512. إذا الطابعة بتفقد بيانات أو بتطبع أحرف مشوّهة، خفّضه لـ 256
    private static final int WRITE_CHUNK = 512;
    private static final long WRITE_DELAY_MS = 8;
    private static final int PAIR_TIMEOUT_MS = 60_000;
    private static final int DEFAULT_SCAN_MS = 12_000;

    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());
    private final Object lock = new Object();

    // ---- الاتصال ----
    private BluetoothSocket socket;
    private String connectedAddress;

    // ---- البحث ----
    private boolean scanning = false;
    private PluginCall discoveryCall;
    private BroadcastReceiver discoveryReceiver;
    private Runnable discoveryTimeout;
    private final Map<String, JSObject> found = new LinkedHashMap<>();

    // ---- الاقتران ----
    private PluginCall pairCall;
    private BroadcastReceiver pairReceiver;
    private Runnable pairTimeout;
    private String pairAddress;
    private String pairPin;

    // =====================================================================
    // مساعدات
    // =====================================================================

    private BluetoothAdapter adapter() {
        BluetoothManager bm = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        return bm == null ? null : bm.getAdapter();
    }

    private boolean hasBtPermissions() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true; // صلاحيات تثبيت على Android 11 وأقل
        return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_SCAN)
                == PackageManager.PERMISSION_GRANTED
            && ContextCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_CONNECT)
                == PackageManager.PERMISSION_GRANTED;
    }

    private boolean hasLocationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) return true; // Android 12+ ما بيحتاج الموقع للبحث
        return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION)
                == PackageManager.PERMISSION_GRANTED;
    }

    private boolean canScan() {
        return hasBtPermissions() && hasLocationPermission();
    }

    private static BluetoothDevice deviceFrom(Intent intent) {
        if (Build.VERSION.SDK_INT >= 33) {
            return intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE, BluetoothDevice.class);
        }
        return intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
    }

    private JSObject toJs(BluetoothDevice d, boolean paired) {
        JSObject o = new JSObject();
        String name = null;
        try {
            name = d.getName();
        } catch (SecurityException ignored) {
        }
        o.put("name", name == null ? "" : name);
        o.put("address", d.getAddress());
        o.put("paired", paired);
        return o;
    }

    private static void closeQuietly(BluetoothSocket s) {
        if (s == null) return;
        try {
            s.close();
        } catch (IOException ignored) {
        }
    }

    // =====================================================================
    // الحالة والصلاحيات والتفعيل
    // =====================================================================

    @PluginMethod
    public void getState(PluginCall call) {
        BluetoothAdapter a = adapter();
        JSObject r = new JSObject();
        r.put("supported", a != null);
        r.put("enabled", a != null && a.isEnabled());
        r.put("hasPermissions", hasBtPermissions());
        r.put("hasLocation", hasLocationPermission());
        r.put("needsLocation", Build.VERSION.SDK_INT < Build.VERSION_CODES.S);
        call.resolve(r);
    }

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        if (canScan()) {
            resolvePermissions(call);
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            requestPermissionForAlias("bluetooth", call, "permissionsCallback");
        } else {
            requestPermissionForAlias("location", call, "permissionsCallback");
        }
    }

    @PermissionCallback
    private void permissionsCallback(PluginCall call) {
        resolvePermissions(call);
    }

    private void resolvePermissions(PluginCall call) {
        JSObject r = new JSObject();
        r.put("hasPermissions", hasBtPermissions());
        r.put("hasLocation", hasLocationPermission());
        call.resolve(r);
    }

    @PluginMethod
    public void enableBluetooth(PluginCall call) {
        BluetoothAdapter a = adapter();
        if (a == null) {
            call.reject("NO_BLUETOOTH", "NO_BLUETOOTH");
            return;
        }
        if (a.isEnabled()) {
            JSObject r = new JSObject();
            r.put("enabled", true);
            call.resolve(r);
            return;
        }
        startActivityForResult(call, new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE), "enableResult");
    }

    @ActivityCallback
    private void enableResult(PluginCall call, ActivityResult result) {
        BluetoothAdapter a = adapter();
        JSObject r = new JSObject();
        r.put("enabled", a != null && a.isEnabled());
        call.resolve(r);
    }

    // =====================================================================
    // الأجهزة المقترنة والبحث
    // =====================================================================

    @PluginMethod
    public void listPaired(PluginCall call) {
        BluetoothAdapter a = adapter();
        if (a == null || !a.isEnabled()) {
            call.reject("BT_OFF", "BT_OFF");
            return;
        }
        if (!hasBtPermissions()) {
            call.reject("NO_PERMISSION", "NO_PERMISSION");
            return;
        }
        JSArray arr = new JSArray();
        try {
            for (BluetoothDevice d : a.getBondedDevices()) {
                arr.put(toJs(d, true));
            }
        } catch (SecurityException e) {
            call.reject("NO_PERMISSION", "NO_PERMISSION");
            return;
        }
        JSObject r = new JSObject();
        r.put("devices", arr);
        call.resolve(r);
    }

    @PluginMethod
    public void discover(PluginCall call) {
        BluetoothAdapter a = adapter();
        if (a == null || !a.isEnabled()) {
            call.reject("BT_OFF", "BT_OFF");
            return;
        }
        if (!canScan()) {
            call.reject("NO_PERMISSION", "NO_PERMISSION");
            return;
        }
        if (scanning) {
            // في بحث شغّال أصلاً، ما بنبدأ ثاني
            call.reject("ALREADY_SCANNING", "ALREADY_SCANNING");
            return;
        }

        scanning = true;
        found.clear();

        // الأجهزة المحفوظة بتدخل النتيجة من البداية، حتى لو الطابعة مطفية وما ردّت على البحث
        try {
            for (BluetoothDevice d : a.getBondedDevices()) {
                found.put(d.getAddress(), toJs(d, true));
            }
        } catch (SecurityException ignored) {
        }

        discoveryReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context ctx, Intent intent) {
                String action = intent.getAction();
                if (BluetoothDevice.ACTION_FOUND.equals(action)) {
                    BluetoothDevice d = deviceFrom(intent);
                    if (d == null || d.getAddress() == null) return;
                    JSObject o = toJs(d, d.getBondState() == BluetoothDevice.BOND_BONDED);
                    found.put(d.getAddress(), o);
                    notifyListeners("deviceFound", o);
                } else if (BluetoothAdapter.ACTION_DISCOVERY_FINISHED.equals(action)) {
                    finishDiscovery();
                }
            }
        };

        IntentFilter f = new IntentFilter();
        f.addAction(BluetoothDevice.ACTION_FOUND);
        f.addAction(BluetoothAdapter.ACTION_DISCOVERY_FINISHED);
        ContextCompat.registerReceiver(getContext(), discoveryReceiver, f, ContextCompat.RECEIVER_EXPORTED);

        boolean started;
        try {
            started = a.startDiscovery();
        } catch (SecurityException e) {
            started = false;
        }
        if (!started) {
            scanning = false;
            cleanupDiscoveryReceiver();
            call.reject("DISCOVERY_FAILED", "DISCOVERY_FAILED");
            return;
        }

        discoveryCall = call;
        discoveryTimeout = this::finishDiscovery;
        main.postDelayed(discoveryTimeout, call.getInt("durationMs", DEFAULT_SCAN_MS));
    }

    @PluginMethod
    public void stopDiscovery(PluginCall call) {
        finishDiscovery();
        call.resolve();
    }

    /** ينهي البحث مرة وحدة بس، ويرجّع القائمة الكاملة (المحفوظة + اللي انلقت) */
    private void finishDiscovery() {
        if (!scanning) return;
        scanning = false;

        if (discoveryTimeout != null) {
            main.removeCallbacks(discoveryTimeout);
            discoveryTimeout = null;
        }
        try {
            BluetoothAdapter a = adapter();
            if (a != null) a.cancelDiscovery();
        } catch (SecurityException ignored) {
        }
        cleanupDiscoveryReceiver();

        PluginCall c = discoveryCall;
        discoveryCall = null;
        if (c != null) {
            JSArray arr = new JSArray();
            for (JSObject o : found.values()) arr.put(o);
            JSObject r = new JSObject();
            r.put("devices", arr);
            c.resolve(r);
        }
    }

    private void cleanupDiscoveryReceiver() {
        if (discoveryReceiver != null) {
            try {
                getContext().unregisterReceiver(discoveryReceiver);
            } catch (IllegalArgumentException ignored) {
            }
            discoveryReceiver = null;
        }
    }

    // =====================================================================
    // الاقتران
    // =====================================================================

    @PluginMethod
    public void pair(PluginCall call) {
        finishDiscovery(); // ما في اقتران وبحث شغّالين بنفس الوقت
        String address = call.getString("address");
        BluetoothAdapter a = adapter();
        if (address == null || a == null) {
            call.reject("BAD_ARGS", "BAD_ARGS");
            return;
        }
        if (!hasBtPermissions()) {
            call.reject("NO_PERMISSION", "NO_PERMISSION");
            return;
        }
        try {
            BluetoothDevice d = a.getRemoteDevice(address);
            if (d.getBondState() == BluetoothDevice.BOND_BONDED) {
                JSObject r = new JSObject();
                r.put("paired", true);
                call.resolve(r);
                return;
            }

            finishPair(false, "PAIR_CANCELLED"); // لو فيه اقتران سابق معلّق
            pairCall = call;
            pairAddress = address;
            pairPin = call.getString("pin"); // بس بالذاكرة، ما بنحفظه

            registerPairReceiver();
            pairTimeout = () -> finishPair(false, "PAIR_TIMEOUT");
            main.postDelayed(pairTimeout, PAIR_TIMEOUT_MS);

            if (!d.createBond()) {
                finishPair(false, "BOND_FAILED");
            }
        } catch (SecurityException e) {
            finishPair(false, "NO_PERMISSION");
        }
    }

    private void registerPairReceiver() {
        if (pairReceiver != null) return;
        pairReceiver = new BroadcastReceiver() {
            @Override
            @SuppressWarnings("deprecation") // setPin مهجور من API 33 بس لسا شغّال
            public void onReceive(Context ctx, Intent intent) {
                BluetoothDevice d = deviceFrom(intent);
                if (d == null || pairAddress == null || !pairAddress.equalsIgnoreCase(d.getAddress())) return;

                String action = intent.getAction();
                if (BluetoothDevice.ACTION_PAIRING_REQUEST.equals(action)) {
                    int variant = intent.getIntExtra(BluetoothDevice.EXTRA_PAIRING_VARIANT, BluetoothDevice.ERROR);
                    if (variant == BluetoothDevice.PAIRING_VARIANT_PIN && pairPin != null && !pairPin.isEmpty()) {
                        try {
                            d.setPin(pairPin.getBytes(StandardCharsets.UTF_8));
                        } catch (SecurityException ignored) {
                        }
                    }
                } else if (BluetoothDevice.ACTION_BOND_STATE_CHANGED.equals(action)) {
                    int state = intent.getIntExtra(BluetoothDevice.EXTRA_BOND_STATE, BluetoothDevice.ERROR);
                    int prev = intent.getIntExtra(BluetoothDevice.EXTRA_PREVIOUS_BOND_STATE, BluetoothDevice.ERROR);
                    if (state == BluetoothDevice.BOND_BONDED) {
                        finishPair(true, null);
                    } else if (state == BluetoothDevice.BOND_NONE && prev == BluetoothDevice.BOND_BONDING) {
                        finishPair(false, "PAIR_FAILED");
                    }
                }
            }
        };

        IntentFilter f = new IntentFilter();
        f.addAction(BluetoothDevice.ACTION_PAIRING_REQUEST);
        f.addAction(BluetoothDevice.ACTION_BOND_STATE_CHANGED);
        ContextCompat.registerReceiver(getContext(), pairReceiver, f, ContextCompat.RECEIVER_EXPORTED);
    }

    private void finishPair(boolean ok, String error) {
        if (pairTimeout != null) {
            main.removeCallbacks(pairTimeout);
            pairTimeout = null;
        }
        if (pairReceiver != null) {
            try {
                getContext().unregisterReceiver(pairReceiver);
            } catch (IllegalArgumentException ignored) {
            }
            pairReceiver = null;
        }
        pairPin = null;     // ما نحتفظ بالرمز بعد الاقتران
        pairAddress = null;
        PluginCall c = pairCall;
        pairCall = null;
        if (c == null) return;
        if (ok) {
            JSObject r = new JSObject();
            r.put("paired", true);
            c.resolve(r);
        } else {
            c.reject(error, error);
        }
    }

    // =====================================================================
    // الاتصال والطباعة
    // =====================================================================

    @PluginMethod
    public void connect(PluginCall call) {
        String address = call.getString("address");
        if (address == null) {
            call.reject("BAD_ARGS", "BAD_ARGS");
            return;
        }
        io.execute(() -> {
            try {
                connectInternal(address);
                JSObject r = new JSObject();
                r.put("connected", true);
                call.resolve(r);
            } catch (Exception e) {
                call.reject("CONNECT_FAILED: " + e.getMessage(), "CONNECT_FAILED");
            }
        });
    }

    /** لازم يُستدعى داخل lock أو يتم لفّه بـ synchronized. */
    private void connectInternal(String address) throws IOException {
        synchronized (lock) {
            if (socket != null && socket.isConnected() && address.equalsIgnoreCase(connectedAddress)) {
                return; // متصل أصلاً
            }
            closeSocketInternal();

            BluetoothAdapter a = adapter();
            if (a == null || !a.isEnabled()) throw new IOException("BT_OFF");
            try {
                a.cancelDiscovery(); // البحث بيبطّئ الاتصال
            } catch (SecurityException ignored) {
            }

            BluetoothDevice d = a.getRemoteDevice(address);
            BluetoothSocket s = null;
            try {
                s = d.createRfcommSocketToServiceRecord(SPP_UUID);
                s.connect();
            } catch (IOException | SecurityException first) {
                closeQuietly(s);
                // بعض الطابعات الرخيصة ما بتستجيب للـ UUID، فنجرّب القناة 1 مباشرة
                try {
                    Method m = d.getClass().getMethod("createRfcommSocket", int.class);
                    s = (BluetoothSocket) m.invoke(d, 1);
                    s.connect();
                } catch (Exception second) {
                    closeQuietly(s);
                    throw new IOException("تعذّر الاتصال: " + first.getMessage());
                }
            }
            socket = s;
            connectedAddress = address;
        }
    }

    private void closeSocketInternal() {
        closeQuietly(socket);
        socket = null;
        connectedAddress = null;
    }

    @PluginMethod
    public void print(PluginCall call) {
        String address = call.getString("address");
        String b64 = call.getString("data");
        if (address == null || b64 == null) {
            call.reject("BAD_ARGS", "BAD_ARGS");
            return;
        }
        io.execute(() -> {
            try {
                byte[] bytes = Base64.decode(b64, Base64.DEFAULT);
                synchronized (lock) {
                    connectInternal(address);
                    OutputStream out = socket.getOutputStream();
                    for (int off = 0; off < bytes.length; off += WRITE_CHUNK) {
                        int len = Math.min(WRITE_CHUNK, bytes.length - off);
                        out.write(bytes, off, len);
                        out.flush();
                        Thread.sleep(WRITE_DELAY_MS);
                    }
                }
                call.resolve();
            } catch (Exception e) {
                synchronized (lock) {
                    closeSocketInternal(); // الاتصال انقطع، المرة الجاية بنعيد الاتصال
                }
                call.reject("PRINT_FAILED: " + e.getMessage(), "PRINT_FAILED");
            }
        });
    }

    @PluginMethod
    public void isConnected(PluginCall call) {
        synchronized (lock) {
            JSObject r = new JSObject();
            r.put("connected", socket != null && socket.isConnected());
            r.put("address", connectedAddress);
            call.resolve(r);
        }
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        io.execute(() -> {
            synchronized (lock) {
                closeSocketInternal();
            }
            call.resolve();
        });
    }

    // =====================================================================
    // التنظيف
    // =====================================================================

    @Override
    protected void handleOnDestroy() {
        finishDiscovery();
        finishPair(false, "PLUGIN_DESTROYED");
        synchronized (lock) {
            closeSocketInternal();
        }
        io.shutdownNow();
        super.handleOnDestroy();
    }
}
