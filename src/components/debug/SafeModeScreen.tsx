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
        if (key && (key.startsWith('hyperpos') || key === 'setup_complete')) {
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
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '20px',
        padding: '20px',
        background: '#1a1a2e',
        color: '#fff',
        fontFamily: 'Cairo, sans-serif',
        direction: 'rtl',
      }}
    >
      <h1 style={{ fontSize: '24px', color: '#0f0' }}>🛡️ الوضع الآمن - Safe Mode</h1>
      <p style={{ color: '#888', textAlign: 'center', maxWidth: '400px' }}>
        هذه الصفحة بسيطة جداً بدون أي overlays أو مكونات معقدة.
        <br />
        إذا كانت الأزرار تعمل هنا، فالمشكلة في مكوّنات التطبيق الأخرى.
      </p>

      {/* Test Button */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
        <button
          onClick={() => {
            console.log('[SafeMode] Button clicked! Count:', count + 1);
            setCount(prev => prev + 1);
          }}
          onPointerDown={() => console.log('[SafeMode] Button pointerdown')}
          style={{
            padding: '16px 32px',
            fontSize: '18px',
            background: '#10b981',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            touchAction: 'manipulation',
          }}
        >
          اضغط هنا للاختبار
        </button>
        <div style={{ fontSize: '20px', color: '#0f0' }}>
          العداد: {count}
        </div>
      </div>

      {/* Test Input */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            console.log('[SafeMode] Input changed:', e.target.value);
            setInputValue(e.target.value);
          }}
          onFocus={() => console.log('[SafeMode] Input focused')}
          placeholder="اكتب هنا للاختبار..."
          style={{
            padding: '12px 16px',
            fontSize: '16px',
            width: '280px',
            background: '#2a2a4e',
            color: '#fff',
            border: '2px solid #444',
            borderRadius: '8px',
            outline: 'none',
            touchAction: 'manipulation',
          }}
        />
        <div style={{ fontSize: '14px', color: '#888' }}>
          المدخل: "{inputValue}"
        </div>
      </div>

      {/* Reset Button */}
      <button
        onClick={handleReset}
        style={{
          marginTop: '20px',
          padding: '12px 24px',
          fontSize: '14px',
          background: '#ef4444',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          touchAction: 'manipulation',
        }}
      >
        🗑️ مسح بيانات التطبيق وإعادة التحميل
      </button>

      {/* Back to normal */}
      <a
        href="/"
        style={{
          marginTop: '10px',
          color: '#888',
          textDecoration: 'underline',
        }}
      >
        العودة للوضع العادي
      </a>

      {/* Debug info */}
      <div
        style={{
          marginTop: '30px',
          padding: '12px',
          background: '#0a0a1a',
          borderRadius: '8px',
          fontSize: '11px',
          color: '#666',
          fontFamily: 'monospace',
          direction: 'ltr',
          textAlign: 'left',
        }}
      >
        <div>pointer-events (body): {typeof window !== 'undefined' ? getComputedStyle(document.body).pointerEvents : '?'}</div>
        <div>touch-action (body): {typeof window !== 'undefined' ? getComputedStyle(document.body).touchAction : '?'}</div>
        <div>User Agent: {typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 60) + '...' : '?'}</div>
      </div>
    </div>
  );
}
