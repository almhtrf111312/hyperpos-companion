import { Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { POS_SHORTCUTS } from '@/hooks/use-keyboard-shortcuts';

const shortcuts = [
  { key: POS_SHORTCUTS.CASH_SALE, description: 'بيع نقدي' },
  { key: POS_SHORTCUTS.DEBT_SALE, description: 'بيع بالدين' },
  { key: POS_SHORTCUTS.CLEAR_CART, description: 'مسح السلة' },
  { key: POS_SHORTCUTS.PRINT, description: 'طباعة' },
  { key: POS_SHORTCUTS.SCAN_BARCODE, description: 'مسح الباركود' },
  { key: POS_SHORTCUTS.TOGGLE_MODE, description: 'تبديل الوضع (منتجات/صيانة)' },
];

export function KeyboardShortcutsHelp() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-foreground"
          title="اختصارات لوحة المفاتيح"
        >
          <Keyboard className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="w-5 h-5" />
            اختصارات لوحة المفاتيح
          </DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <div className="space-y-3">
            {shortcuts.map((shortcut) => (
              <div 
                key={shortcut.key}
                className="flex items-center justify-between p-2 rounded-lg bg-muted"
              >
                <span className="text-sm">{shortcut.description}</span>
                <kbd className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-background border border-border rounded shadow-sm">
                  {shortcut.key}
                </kbd>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-4 text-center">
            استخدم هذه الاختصارات لتسريع عملية البيع
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
