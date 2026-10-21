import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { isGuestDemoMode, getDemoRemainingTime, clearGuestDemoData } from '@/lib/demo-data';
import { toast } from '@/lib/sonner-bridge';

/**
 * DemoModeBanner
 * يدير مؤقت الـ 24 ساعة للوضع التجريبي في الخلفية بصمت تام بدون أي شريط علوي أو عداد منبثق.
 * عند انتهاء الـ 24 ساعة فقط، يتم مسح البيانات التجريبية حصراً وإعادة التوجيه لصفحة الدخول.
 */
export function DemoModeBanner() {
  const navigate = useNavigate();

  const handleExpire = useCallback(async () => {
    try {
      await clearGuestDemoData(true);
      toast.info('انتهت فترة التجربة المؤقتة (24 ساعة). مرحباً بك لإنشاء حساب رسمي لحفظ بياناتك.', {
        duration: 8000,
      });
      navigate('/login');
    } catch (e) {
      console.error('[DemoModeBanner] Expire handling error:', e);
    }
  }, [navigate]);

  useEffect(() => {
    const checkStatus = () => {
      if (isGuestDemoMode()) {
        const rem = getDemoRemainingTime();
        if (rem.isExpired) {
          handleExpire();
        }
      }
    };

    // فحص فوري عند التركيب
    checkStatus();

    // فحص صامت كل 30 ثانية في الخلفية
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, [handleExpire]);

  // إخفاء الشريط العلوي والتحذيرات تماماً لتبقى الشاشة نظيفة للعميل
  return null;
}
