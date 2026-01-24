import { Shield, MessageCircle, Phone, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';

const SUPPORT_WHATSAPP = '+963991234567'; // Replace with your actual WhatsApp number

export function DeviceBlockedScreen() {
  const { language } = useLanguage();
  const { signOut } = useAuth();
  const isRTL = language === 'ar';

  const handleContactSupport = () => {
    const message = encodeURIComponent(
      isRTL 
        ? 'مرحباً، أحتاج مساعدة في إعادة تعيين جهازي المسجل في تطبيق FlowPOS Pro.' 
        : 'Hello, I need help resetting my registered device in FlowPOS Pro app.'
    );
    window.open(`https://wa.me/${SUPPORT_WHATSAPP.replace('+', '')}?text=${message}`, '_blank');
  };

  const handleSignOut = async () => {
    await signOut();
    window.location.reload();
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20 p-4" 
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <Card className="w-full max-w-md shadow-2xl border-destructive/20">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
            <Shield className="w-8 h-8 text-destructive" />
          </div>
          <CardTitle className="text-xl text-destructive flex items-center justify-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            {isRTL ? 'تنبيه أمان: تم اكتشاف جهاز جديد' : 'Security Alert: New Device Detected'}
          </CardTitle>
          <CardDescription className="text-base mt-2">
            {isRTL 
              ? 'عذراً، هذا الحساب مرتبط بجهاز آخر مسبقاً.' 
              : 'Sorry, this account is already linked to another device.'
            }
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {isRTL 
                ? 'لضمان أمان بياناتك والالتزام بشروط الاستخدام، لا يمكن فتح الحساب من أكثر من جهاز في وقت واحد.'
                : 'To ensure your data security and comply with the terms of use, the account cannot be accessed from more than one device at a time.'
              }
            </p>
            
            <div className="border-t pt-3">
              <p className="text-sm font-medium mb-1">
                {isRTL ? 'الإجراء المطلوب:' : 'Required Action:'}
              </p>
              <p className="text-sm text-muted-foreground">
                {isRTL 
                  ? 'إذا قمت بتغيير جهازك أو تريد نقل الحساب، يرجى التواصل مع الدعم الفني لإعادة تعيين الجهاز.'
                  : 'If you have changed your device or want to transfer the account, please contact support to reset the device.'
                }
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <Button 
              onClick={handleContactSupport}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              size="lg"
            >
              <MessageCircle className="w-5 h-5 me-2" />
              {isRTL ? 'تواصل مع الدعم عبر واتساب' : 'Contact Support via WhatsApp'}
            </Button>

            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Phone className="w-4 h-4" />
              <span dir="ltr">{SUPPORT_WHATSAPP}</span>
            </div>

            <Button 
              variant="outline" 
              onClick={handleSignOut}
              className="w-full"
            >
              {isRTL ? 'تسجيل الخروج وتجربة حساب آخر' : 'Sign out and try another account'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
