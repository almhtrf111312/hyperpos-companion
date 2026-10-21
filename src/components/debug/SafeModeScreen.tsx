import { useState } from 'react';

export function SafeModeScreen() {
  const [count, setCount] = useState(0);
  const [inputValue, setInputValue] = useState('');

  const handleReset = () => {
    try {
      // Clear all hyperpos keys
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('hyperpos') || key === 'setup_complete') &&
            key !== 'hyperpos_privacy_accepted' &&
            key !== 'hyperpos_privacy_version' &&
            key !== 'hyperpos_language' &&
            key !== 'hyperpos_theme') {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      alert(`تم مسح ${keysToRemove.length} مفتاح. سيتم إعادة التحميل...`);
      window.location.href = '/';
    } catch (err) {
      alert('فشل مسح البيانات: ' + String(err));
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5 p-5 bg-palette-navy-950 text-white font-sans dir-rtl">
      <h1 className="text-2xl font-bold text-emerald-400">🛡️ الوضع الآمن - Safe Mode</h1>
      <p className="text-muted-foreground text-center max-w-md text-sm">
        هذه الصفحة بسيطة جداً بدون أي overlays أو مكونات معقدة.
        <br />
        إذا كانت الأزرار تعمل هنا، فالمشكلة في مكوّنات التطبيق الأخرى.
      </p>

      {/* Test Button */}
      <div className="flex flex-col items-center gap-2.5">
        <button
          onClick={() => {
            console.log('[SafeMode] Button clicked! Count:', count + 1);
            setCount(prev => prev + 1);
          }}
          onPointerDown={() => console.log('[SafeMode] Button pointerdown')}
          className="px-8 py-4 text-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg cursor-pointer touch-manipulation shadow-md transition-colors"
        >
          اضغط هنا للاختبار
        </button>
        <div className="text-xl font-bold text-emerald-400">
          العداد: {count}
        </div>
      </div>

      {/* Test Input */}
      <div className="flex flex-col items-center gap-2.5">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            console.log('[SafeMode] Input changed:', e.target.value);
            setInputValue(e.target.value);
          }}
          onFocus={() => console.log('[SafeMode] Input focused')}
          placeholder="اكتب هنا للاختبار..."
          className="px-4 py-3 text-base w-72 bg-secondary text-foreground border border-border rounded-lg outline-none touch-manipulation focus:ring-2 focus:ring-primary"
        />
        <div className="text-sm text-muted-foreground">
          المدخل: "{inputValue}"
        </div>
      </div>

      {/* Reset Button */}
      <button
        onClick={handleReset}
        className="mt-5 px-6 py-3 text-sm bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold rounded-lg cursor-pointer touch-manipulation shadow-sm transition-colors"
      >
        🗑️ مسح بيانات التطبيق وإعادة التحميل
      </button>

      {/* Back to normal */}
      <a
        href="/"
        className="mt-2.5 text-sm text-muted-foreground underline hover:text-foreground transition-colors"
      >
        العودة للوضع العادي
      </a>

      {/* Debug info */}
      <div className="mt-8 p-3 rounded-lg bg-black/40 border border-border/40 text-xs text-muted-foreground font-mono dir-ltr text-left max-w-md w-full">
        <div>pointer-events (body): {typeof window !== 'undefined' ? getComputedStyle(document.body).pointerEvents : '?'}</div>
        <div>touch-action (body): {typeof window !== 'undefined' ? getComputedStyle(document.body).touchAction : '?'}</div>
        <div>User Agent: {typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 60) + '...' : '?'}</div>
      </div>
    </div>
  );
}
