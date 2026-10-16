import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { isGuestDemoMode, getDemoRemainingTime, clearGuestDemoData } from '@/lib/demo-data';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Sparkles, Clock, LogOut, UserPlus, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export function DemoModeBanner() {
  const navigate = useNavigate();
  const [isDemo, setIsDemo] = useState<boolean>(() => isGuestDemoMode());
  const [remaining, setRemaining] = useState(() => getDemoRemainingTime());
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const handleExpire = useCallback(async () => {
    try {
      await clearGuestDemoData(true);
      setIsDemo(false);
      toast.error('انتهت صلاحية النسخة التجريبية (24 ساعة). يرجى إنشاء حساب رسمي لحفظ بياناتك.', {
        duration: 8000,
      });
      navigate('/login');
    } catch (e) {
      console.error('[DemoBanner] Expire handling error:', e);
    }
  }, [navigate]);

  useEffect(() => {
    // Check demo status immediately
    const checkStatus = () => {
      const active = isGuestDemoMode();
      setIsDemo(active);
      if (active) {
        const rem = getDemoRemainingTime();
        setRemaining(rem);
        if (rem.isExpired) {
          handleExpire();
        }
      }
    };

    checkStatus();

    // Re-check remaining time every 30 seconds
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, [handleExpire]);

  if (!isDemo) return null;

  const handleConfirmExit = async () => {
    setIsExiting(true);
    try {
      await clearGuestDemoData(true);
      setIsDemo(false);
      setShowExitDialog(false);
      toast.info('تم إنهاء وضع التجربة بنجاح');
      navigate('/login');
    } catch (error) {
      console.error('[DemoBanner] Error exiting demo:', error);
      toast.error('حدث خطأ أثناء إنهاء التجربة');
    } finally {
      setIsExiting(false);
    }
  };

  return (
    <>
      <div
        dir="rtl"
        className="sticky top-0 z-50 w-full bg-gradient-to-r from-amber-600 via-amber-500 to-orange-600 text-white shadow-md border-b border-amber-400/40 px-3 py-1.5 transition-all"
      >
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs md:text-sm">
          {/* Left section: Info & Countdown */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1.5 font-bold bg-black/20 px-2 py-0.5 rounded-full text-[11px] md:text-xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-200 animate-pulse" />
              <span>وضع التجربة (بدون حساب)</span>
            </span>

            <span className="flex items-center gap-1 font-medium bg-black/10 px-2 py-0.5 rounded-md">
              <Clock className="w-3.5 h-3.5 text-amber-200" />
              <span>متبقي:</span>
              <strong className="font-bold tracking-wide">
                {remaining.hours} س و {remaining.minutes} د
              </strong>
            </span>

            <span className="hidden lg:inline text-[11px] text-amber-100/90">
              (البيانات محفوظة على هذا الجهاز فقط ولا تتصل بالسحابة)
            </span>
          </div>

          {/* Right section: Actions */}
          <div className="flex items-center gap-1.5 ms-auto">
            <Button
              size="sm"
              variant="default"
              onClick={() => navigate('/signup')}
              className="h-7 px-2.5 text-xs bg-white text-amber-800 hover:bg-amber-50 hover:text-amber-900 font-bold shadow-sm gap-1"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>إنشاء حساب رسمي</span>
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowExitDialog(true)}
              className="h-7 px-2 text-xs text-white hover:bg-black/20 hover:text-white gap-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>إنهاء التجربة</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Confirmation modal before ending demo */}
      <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader className="text-center sm:text-center">
            <div className="mx-auto w-12 h-12 bg-amber-100 dark:bg-amber-950/50 rounded-full flex items-center justify-center mb-2">
              <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <DialogTitle>إنهاء وضع التجربة</DialogTitle>
            <DialogDescription className="text-sm mt-1.5 leading-relaxed">
              هل أنت متأكد من رغبتك في إنهاء وضع التجربة؟ سيتم مسح كافة البيانات التجريبية والعودة لشاشة الدخول.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex-col sm:flex-row gap-2 mt-2">
            <Button
              variant="outline"
              onClick={() => setShowExitDialog(false)}
              disabled={isExiting}
              className="w-full sm:w-auto"
            >
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmExit}
              disabled={isExiting}
              className="w-full sm:w-auto bg-destructive hover:bg-destructive/90"
            >
              {isExiting ? 'جاري المسح...' : 'تأكيد الإنهاء والمسح'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
