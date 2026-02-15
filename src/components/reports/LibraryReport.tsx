import { useState, useEffect, useMemo } from 'react';
import { BookOpen, Users, AlertTriangle, Clock, DollarSign, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { loadLoansCloud, loadMembersCloud, BookLoan, LibraryMember } from '@/lib/cloud/library-cloud';
import { formatNumber } from '@/lib/utils';
import { useLanguage } from '@/hooks/use-language';

interface LibraryReportProps {
  dateRange: { from: string; to: string };
}

export function LibraryReport({ dateRange }: LibraryReportProps) {
  const { t } = useLanguage();
  const [loans, setLoans] = useState<BookLoan[]>([]);
  const [members, setMembers] = useState<LibraryMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const [l, m] = await Promise.all([loadLoansCloud(), loadMembersCloud()]);
      setLoans(l);
      setMembers(m);
      setIsLoading(false);
    };
    load();
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // Filter by date range
    const filteredLoans = loans.filter(l => {
      const loanDate = l.loanDate;
      return loanDate >= dateRange.from && loanDate <= dateRange.to;
    });

    const activeLoans = loans.filter(l => l.status === 'active');
    const returnedLoans = filteredLoans.filter(l => l.status === 'returned');
    const lostLoans = filteredLoans.filter(l => l.status === 'lost');
    const overdueLoans = activeLoans.filter(l => l.dueDate < today);

    // Most borrowed books
    const bookCounts: Record<string, { name: string; count: number; lastDate: string }> = {};
    loans.forEach(l => {
      const key = l.productId;
      if (!bookCounts[key]) {
        bookCounts[key] = { name: l.bookName || 'غير معروف', count: 0, lastDate: l.loanDate };
      }
      bookCounts[key].count++;
      if (l.loanDate > bookCounts[key].lastDate) {
        bookCounts[key].lastDate = l.loanDate;
      }
    });
    const topBooks = Object.values(bookCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Member stats
    const activeMembers = members.filter(m => m.membershipStatus === 'active');
    const suspendedMembers = members.filter(m => m.membershipStatus === 'suspended');
    const totalFees = members.reduce((sum, m) => sum + (m.lateFees || 0), 0);

    return {
      totalLoans: filteredLoans.length,
      activeLoans: activeLoans.length,
      returnedLoans: returnedLoans.length,
      lostLoans: lostLoans.length,
      overdueLoans,
      topBooks,
      totalMembers: members.length,
      activeMembers: activeMembers.length,
      suspendedMembers: suspendedMembers.length,
      totalFees,
    };
  }, [loans, members, dateRange]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardContent className="p-4 text-center">
            <BookOpen className="w-6 h-6 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold text-foreground">{stats.totalLoans}</p>
            <p className="text-xs text-muted-foreground">إجمالي الإعارات</p>
          </CardContent>
        </Card>
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardContent className="p-4 text-center">
            <Clock className="w-6 h-6 text-blue-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-foreground">{stats.activeLoans}</p>
            <p className="text-xs text-muted-foreground">إعارات نشطة</p>
          </CardContent>
        </Card>
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardContent className="p-4 text-center">
            <AlertTriangle className="w-6 h-6 text-destructive mx-auto mb-2" />
            <p className="text-2xl font-bold text-foreground">{stats.overdueLoans.length}</p>
            <p className="text-xs text-muted-foreground">كتب متأخرة</p>
          </CardContent>
        </Card>
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardContent className="p-4 text-center">
            <Users className="w-6 h-6 text-green-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-foreground">{stats.totalMembers}</p>
            <p className="text-xs text-muted-foreground">إجمالي الأعضاء</p>
          </CardContent>
        </Card>
      </div>

      {/* Member Stats */}
      <Card className="bg-card/80 backdrop-blur-sm border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            إحصائيات الأعضاء
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-lg font-bold">{stats.activeMembers}</p>
              <p className="text-xs text-muted-foreground">نشط</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-lg font-bold">{stats.suspendedMembers}</p>
              <p className="text-xs text-muted-foreground">معلق</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-lg font-bold">{stats.returnedLoans}</p>
              <p className="text-xs text-muted-foreground">مرتجعة</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-lg font-bold text-destructive">${formatNumber(stats.totalFees)}</p>
              <p className="text-xs text-muted-foreground">غرامات محصلة</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Overdue Books */}
      {stats.overdueLoans.length > 0 && (
        <Card className="bg-card/80 backdrop-blur-sm border-destructive/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              الكتب المتأخرة ({stats.overdueLoans.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.overdueLoans.map(loan => {
                const daysLate = Math.ceil(
                  (new Date().getTime() - new Date(loan.dueDate).getTime()) / (1000 * 60 * 60 * 24)
                );
                return (
                  <div key={loan.id} className="flex items-center justify-between p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                    <div>
                      <p className="font-medium text-sm">{loan.bookName || 'كتاب غير معروف'}</p>
                      <p className="text-xs text-muted-foreground">{loan.memberName}</p>
                    </div>
                    <div className="text-end">
                      <p className="text-sm font-bold text-destructive">{daysLate} يوم تأخير</p>
                      <p className="text-xs text-muted-foreground">استحقاق: {loan.dueDate}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Borrowed Books */}
      <Card className="bg-card/80 backdrop-blur-sm border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            الكتب الأكثر إعارة
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.topBooks.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">لا توجد إعارات بعد</p>
          ) : (
            <div className="space-y-2">
              {stats.topBooks.map((book, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                      {i + 1}
                    </span>
                    <span className="font-medium text-sm">{book.name}</span>
                  </div>
                  <div className="text-end">
                    <p className="text-sm font-bold">{book.count} إعارة</p>
                    <p className="text-xs text-muted-foreground">آخر: {book.lastDate}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Loan Summary */}
      <Card className="bg-card/80 backdrop-blur-sm border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            ملخص الإعارات
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-lg font-bold text-primary">{stats.totalLoans}</p>
              <p className="text-xs text-muted-foreground">إجمالي</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
              <p className="text-lg font-bold text-blue-500">{stats.activeLoans}</p>
              <p className="text-xs text-muted-foreground">نشطة</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-green-500/5 border border-green-500/20">
              <p className="text-lg font-bold text-green-500">{stats.returnedLoans}</p>
              <p className="text-xs text-muted-foreground">مرتجعة</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-destructive/5 border border-destructive/20">
              <p className="text-lg font-bold text-destructive">{stats.lostLoans}</p>
              <p className="text-xs text-muted-foreground">مفقودة</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}