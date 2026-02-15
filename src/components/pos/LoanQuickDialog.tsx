import { useState, useEffect } from 'react';
import { BookOpen, Search, User, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { loadMembersCloud, addLoanCloud, LibraryMember } from '@/lib/cloud/library-cloud';
import { DatePicker } from '@/components/ui/date-picker';
import { showToast } from '@/lib/toast-config';
import { useLanguage } from '@/hooks/use-language';
import { format } from 'date-fns';

interface LoanQuickDialogProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  onLoanComplete: () => void;
}

export function LoanQuickDialog({
  isOpen,
  onClose,
  productId,
  productName,
  onLoanComplete,
}: LoanQuickDialogProps) {
  const { t } = useLanguage();
  const [members, setMembers] = useState<LibraryMember[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<LibraryMember | null>(null);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14); // Default 2 weeks
    return format(d, 'yyyy-MM-dd');
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadMembersCloud().then(setMembers);
      setSelectedMember(null);
      setSearchQuery('');
    }
  }, [isOpen]);

  const filteredMembers = members.filter(m =>
    m.membershipStatus === 'active' &&
    (m.name.includes(searchQuery) || m.phone.includes(searchQuery))
  );

  const handleSubmit = async () => {
    if (!selectedMember) {
      showToast.warning('يرجى اختيار عضو');
      return;
    }
    if (!dueDate) {
      showToast.warning('يرجى تحديد تاريخ الاسترداد');
      return;
    }

    setIsSubmitting(true);
    const loan = await addLoanCloud({
      productId,
      memberId: selectedMember.id,
      dueDate,
    });

    if (loan) {
      showToast.success(`تم تسجيل إعارة "${productName}" للعضو ${selectedMember.name}`);
      onLoanComplete();
      onClose();
    } else {
      showToast.error('فشل تسجيل الإعارة');
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            إعارة كتاب
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Book Name */}
          <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
            <p className="text-xs text-muted-foreground">الكتاب</p>
            <p className="font-semibold text-foreground">{productName}</p>
          </div>

          {/* Member Search */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">اختر العضو</label>
            {selectedMember ? (
              <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/30">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  <span className="font-medium">{selectedMember.name}</span>
                  {selectedMember.phone && (
                    <span className="text-xs text-muted-foreground">{selectedMember.phone}</span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedMember(null)}
                  className="text-xs"
                >
                  تغيير
                </Button>
              </div>
            ) : (
              <>
                <div className="relative mb-2">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="بحث بالاسم أو الهاتف..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pr-9 bg-muted border-0"
                  />
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {filteredMembers.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-3">
                      {members.length === 0 ? 'لا يوجد أعضاء. أضف أعضاء من صفحة المكتبة.' : 'لا توجد نتائج'}
                    </p>
                  ) : (
                    filteredMembers.map(m => (
                      <button
                        key={m.id}
                        onClick={() => setSelectedMember(m)}
                        className="w-full text-start p-2.5 rounded-lg hover:bg-muted/80 flex items-center gap-2 transition-colors"
                      >
                        <User className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{m.name}</p>
                          {m.phone && <p className="text-xs text-muted-foreground">{m.phone}</p>}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          {/* Due Date */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              <Calendar className="w-4 h-4 inline ml-1" />
              تاريخ الاسترداد
            </label>
            <DatePicker
              value={dueDate}
              onChange={setDueDate}
              placeholder="اختر تاريخ الاسترداد"
            />
          </div>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={!selectedMember || isSubmitting}
            className="w-full"
          >
            <BookOpen className="w-4 h-4 ml-2" />
            {isSubmitting ? 'جارٍ التسجيل...' : 'تأكيد الإعارة'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}