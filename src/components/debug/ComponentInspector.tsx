import React, { useState, useEffect, useRef } from 'react';

const SOURCE_KEY = Symbol.for('__jsxSource__');

interface InspectedElementInfo {
  fileName: string;
  lineNumber: number;
  columnNumber?: number;
  displayName: string;
  elementText: string;
  xpath: string;
}

function cleanFilePath(filePath: string): string {
  if (!filePath) return '';
  let clean = filePath.replace(/\\/g, '/');
  // Remove absolute prefix if present
  const srcIdx = clean.indexOf('src/');
  if (srcIdx !== -1) {
    clean = clean.slice(srcIdx);
  }
  return clean;
}

function findComponentSource(el: HTMLElement | null): InspectedElementInfo | null {
  let curr: any = el;
  while (curr && curr !== document.body && curr !== document.documentElement) {
    // 1. Lovable / Vite JSX tagger symbol
    if (curr[SOURCE_KEY]) {
      const src = curr[SOURCE_KEY];
      return {
        fileName: cleanFilePath(src.fileName),
        lineNumber: src.lineNumber,
        columnNumber: src.columnNumber,
        displayName: src.displayName || curr.tagName.toLowerCase(),
        elementText: (curr.innerText || curr.textContent || '').trim().slice(0, 40),
        xpath: curr.tagName.toLowerCase() + (curr.id ? `#${curr.id}` : ''),
      };
    }

    // 2. React Internal Fiber debugSource fallback
    const fiberKey = Object.keys(curr).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
    if (fiberKey) {
      let fiber = curr[fiberKey];
      while (fiber) {
        if (fiber._debugSource) {
          return {
            fileName: cleanFilePath(fiber._debugSource.fileName),
            lineNumber: fiber._debugSource.lineNumber,
            columnNumber: fiber._debugSource.columnNumber,
            displayName: fiber.type?.displayName || fiber.type?.name || curr.tagName.toLowerCase(),
            elementText: (curr.innerText || curr.textContent || '').trim().slice(0, 40),
            xpath: curr.tagName.toLowerCase() + (curr.id ? `#${curr.id}` : ''),
          };
        }
        fiber = fiber.return;
      }
    }

    curr = curr.parentElement;
  }
  return null;
}

export function ComponentInspector() {
  const [isActive, setIsActive] = useState(false);
  const [hoveredRect, setHoveredRect] = useState<DOMRect | null>(null);
  const [hoveredInfo, setHoveredInfo] = useState<InspectedElementInfo | null>(null);
  const [lastSelected, setLastSelected] = useState<InspectedElementInfo | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        setIsActive(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt' && !localStorage.getItem('antigravity_inspector_pinned')) {
        setIsActive(false);
        setHoveredRect(null);
        setHoveredInfo(null);
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isActive) return;
      const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      if (!target || target.closest('#antigravity-inspector-ui')) {
        setHoveredRect(null);
        setHoveredInfo(null);
        return;
      }

      const rect = target.getBoundingClientRect();
      setHoveredRect(rect);
      const info = findComponentSource(target);
      setHoveredInfo(info || {
        fileName: 'unknown',
        lineNumber: 0,
        displayName: target.tagName.toLowerCase(),
        elementText: (target.innerText || '').slice(0, 30),
        xpath: target.tagName.toLowerCase(),
      });
    };

    const handleClick = (e: MouseEvent) => {
      if (!isActive) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('#antigravity-inspector-ui')) return;

      e.preventDefault();
      e.stopPropagation();

      const info = findComponentSource(target);
      if (info) {
        setLastSelected(info);
        const copyText = `${info.fileName}:${info.lineNumber}`;
        
        // Copy to clipboard
        navigator.clipboard?.writeText(copyText).catch(() => {});

        // Save globally for Antigravity Agent inspection
        (window as any).__LAST_INSPECTED_COMPONENT__ = info;
        try {
          localStorage.setItem('antigravity_last_inspected', JSON.stringify(info));
        } catch {}

        // Show feedback toast
        setToastMessage(`تم النسخ للحافظة: ${info.displayName} (${copyText})`);
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 4000);

        console.log(`%c[Antigravity Inspector] 🎯 Target identified:`, 'background: #2563eb; color: #fff; font-weight: bold; padding: 2px 6px; border-radius: 4px;', {
          component: info.displayName,
          file: info.fileName,
          line: info.lineNumber,
          text: info.elementText,
          copyString: copyText,
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('click', handleClick, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('click', handleClick, true);
    };
  }, [isActive]);

  const togglePin = () => {
    const next = !isActive;
    setIsActive(next);
    if (next) {
      localStorage.setItem('antigravity_inspector_pinned', '1');
    } else {
      localStorage.removeItem('antigravity_inspector_pinned');
      setHoveredRect(null);
      setHoveredInfo(null);
    }
  };

  return (
    <div id="antigravity-inspector-ui">
      {/* 1. زر التحكم العائم لتشغيل/إيقاف الفاحص */}
      <div
        style={{
          position: 'fixed',
          bottom: '18px',
          left: '18px',
          zIndex: 9999999,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          direction: 'rtl',
        }}
      >
        <button
          type="button"
          onClick={togglePin}
          style={{
            background: isActive ? '#f59e0b' : 'rgba(24, 24, 27, 0.85)',
            color: isActive ? '#000' : '#fff',
            border: `1px solid ${isActive ? '#d97706' : 'rgba(255,255,255,0.2)'}`,
            padding: '6px 12px',
            borderRadius: '9999px',
            fontSize: '12px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backdropFilter: 'blur(8px)',
            transition: 'all 0.2s',
          }}
          title="اضغط لتثبيت وضع فحص الأزرار، أو اضغط مطولاً على مفتاح Alt أثناء النقر"
        >
          <span>🎯</span>
          <span>{isActive ? 'وضع الفحص مفعّل (انقر أي زر)' : 'فاحص الأزرار (Alt + Click)'}</span>
        </button>
      </div>

      {/* 2. إطار التحديد المباشر عند تمرير الماوس */}
      {isActive && hoveredRect && (
        <div
          style={{
            position: 'fixed',
            top: `${hoveredRect.top}px`,
            left: `${hoveredRect.left}px`,
            width: `${hoveredRect.width}px`,
            height: `${hoveredRect.height}px`,
            border: '2px solid #3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.15)',
            pointerEvents: 'none',
            zIndex: 9999998,
            borderRadius: '4px',
            transition: 'all 0.05s ease-out',
          }}
        >
          {hoveredInfo && (
            <div
              style={{
                position: 'absolute',
                top: hoveredRect.top > 35 ? '-28px' : 'calc(100% + 4px)',
                right: '0',
                background: '#1e293b',
                color: '#fff',
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontFamily: 'monospace',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                direction: 'ltr',
              }}
            >
              <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>&lt;{hoveredInfo.displayName}&gt;</span>
              <span style={{ color: '#94a3b8' }}>{hoveredInfo.fileName}:{hoveredInfo.lineNumber}</span>
            </div>
          )}
        </div>
      )}

      {/* 3. شريط إشعار النسخ عند النقر على الزر */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#0f172a',
            color: '#38bdf8',
            border: '1px solid #38bdf8',
            borderRadius: '14px',
            padding: '10px 18px',
            fontSize: '12px',
            fontWeight: 'bold',
            zIndex: 10000000,
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            fontFamily: 'system-ui, sans-serif',
            direction: 'rtl',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            animation: 'fadeIn 0.2s',
          }}
        >
          <span style={{ fontSize: '16px' }}>📋</span>
          <div>
            <div>{toastMessage}</div>
            <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
              تم نسخه للحافظة تلقائياً — الصقه مباشرة لغالب في المحادثة!
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
