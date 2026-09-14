import { useState, useMemo } from 'react';
import {
  Download,
  Filter,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Share2,
  Calendar,
  Tag
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { loadPartners, Partner, ProfitRecord } from '@/lib/partners-store';
import { formatNumber } from '@/lib/utils';
import { shareReport } from '@/lib/native-share';

interface DateRange {
  from: string;
  to: string;
}

interface PartnerProfitDetailedReportProps {
  dateRange: DateRange;
}

interface DetailedProfitRow {
  date: string;
  partnerName: string;
  partnerId: string;
  category: string;
  amount: number;
  invoiceId: string;
  status: 'confirmed' | 'pending';
}

export function PartnerProfitDetailedReport({ dateRange }: PartnerProfitDetailedReportProps) {
  const [selectedPartner, setSelectedPartner] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortField, setSortField] = useState<'date' | 'amount' | 'category'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [expandedPartners, setExpandedPartners] = useState<Set<string>>(new Set());

  const partners = useMemo(() => loadPartners(), []);

  // Get unique categories from all partners' profit history
  const allCategories = useMemo(() => {
    const categories = new Set<string>();
    partners.forEach(partner => {
      (partner.profitHistory || []).forEach(record => {
        if (record.category) {
          categories.add(record.category);
        }
      });
    });
    return Array.from(categories).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [partners]);

  // Process detailed profit data
  const detailedData = useMemo(() => {
    const rows: DetailedProfitRow[] = [];

    const filteredPartners = selectedPartner === 'all'
      ? partners
      : partners.filter(p => p.id === selectedPartner);

    filteredPartners.forEach(partner => {
      const profitHistory = partner.profitHistory || [];

      profitHistory.forEach(record => {
        const recordDate = new Date(record.createdAt).toISOString().split('T')[0];

        // Filter by date range
        if (recordDate < dateRange.from || recordDate > dateRange.to) return;

        // Filter by category
        if (selectedCategory !== 'all' && record.category !== selectedCategory) return;

        rows.push({
          date: recordDate,
          partnerName: partner.name,
          partnerId: partner.id,
          category: record.category || 'بدون تصنيف',
          amount: record.amount,
          invoiceId: record.invoiceId,
          status: record.isDebt ? 'pending' : 'confirmed',
        });
      });
    });

    // Sort data
    rows.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'date') {
        comparison = a.date.localeCompare(b.date);
      } else if (sortField === 'amount') {
        comparison = a.amount - b.amount;
      } else if (sortField === 'category') {
        comparison = a.category.localeCompare(b.category);
      }
      return sortDirection === 'desc' ? -comparison : comparison;
    });

    return rows;
  }, [partners, selectedPartner, selectedCategory, dateRange, sortField, sortDirection]);

  // Aggregate data by partner and category
  const aggregatedData = useMemo(() => {
    const byPartner: Record<string, {
      partnerId: string;
      partnerName: string;
      totalProfit: number;
      byCategory: Record<string, { amount: number; count: number }>;
    }> = {};

    detailedData.forEach(row => {
      if (!byPartner[row.partnerId]) {
        byPartner[row.partnerId] = {
          partnerId: row.partnerId,
          partnerName: row.partnerName,
          totalProfit: 0,
          byCategory: {},
        };
      }

      byPartner[row.partnerId].totalProfit += row.amount;

      if (!byPartner[row.partnerId].byCategory[row.category]) {
        byPartner[row.partnerId].byCategory[row.category] = { amount: 0, count: 0 };
      }
      byPartner[row.partnerId].byCategory[row.category].amount += row.amount;
      byPartner[row.partnerId].byCategory[row.category].count += 1;
    });

    return Object.values(byPartner).sort((a, b) => b.totalProfit - a.totalProfit);
  }, [detailedData]);

  // Summary statistics
  const summary = useMemo(() => {
    const totalProfit = detailedData.reduce((sum, row) => sum + row.amount, 0);
    const totalTransactions = detailedData.length;
    const confirmedProfit = detailedData
      .filter(row => row.status === 'confirmed')
      .reduce((sum, row) => sum + row.amount, 0);
    const pendingProfit = detailedData
      .filter(row => row.status === 'pending')
      .reduce((sum, row) => sum + row.amount, 0);

    return { totalProfit, totalTransactions, confirmedProfit, pendingProfit };
  }, [detailedData]);

  const toggleSort = (field: 'date' | 'amount' | 'category') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const togglePartnerExpand = (partnerId: string) => {
    setExpandedPartners(prev => {
      const next = new Set(prev);
      if (next.has(partnerId)) {
        next.delete(partnerId);
      } else {
        next.add(partnerId);
      }
      return next;
    });
  };

  const handleExportExcel = () => {
    const headers = ['التاريخ', 'الشريك', 'التصنيف', 'المبلغ', 'الحالة', 'رقم الفاتورة'];
    const rows = detailedData.map(row => [
      row.date,
      row.partnerName,
      row.category,
      row.amount,
      row.status === 'confirmed' ? 'مؤكد' : 'معلق',
      row.invoiceId,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `تقرير_أرباح_الشركاء_${dateRange.from}_${dateRange.to}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('تم تصدير التقرير بنجاح');
  };

  const handleShareWhatsApp = async () => {
    let report = `📊 تقرير أرباح الشركاء المفصل\n`;
    report += `📅 الفترة: ${dateRange.from} إلى ${dateRange.to}\n\n`;
    report += `💰 الإجمالي: $${formatNumber(summary.totalProfit)}\n`;
    report += `✅ مؤكد: $${formatNumber(summary.confirmedProfit)}\n`;
    report += `⏳ معلق: $${formatNumber(summary.pendingProfit)}\n\n`;

    report += `📋 التفاصيل:\n`;
    aggregatedData.forEach(partner => {
      report += `\n👤 ${partner.partnerName}: $${formatNumber(partner.totalProfit)}\n`;
      Object.entries(partner.byCategory).forEach(([cat, data]) => {
        report += `   • ${cat}: $${formatNumber(data.amount)} (${data.count} عملية)\n`;
      });
    });

    report += `\n---\nتم إنشاء التقرير بواسطة FlowPOS Pro`;

    const success = await shareReport('تقرير أرباح الشركاء', report);
    if (success) {
      toast.success('تم فتح المشاركة');
    }
  };

  const SortIcon = ({ field }: { field: 'date' | 'amount' | 'category' }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ?
      <ChevronUp className="w-4 h-4 inline mr-1" /> :
      <ChevronDown className="w-4 h-4 inline mr-1" />;
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold">تصفية التقرير</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">الشريك</label>
            <Select value={selectedPartner} onValueChange={setSelectedPartner}>
              <SelectTrigger>
                <SelectValue placeholder="جميع الشركاء" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الشركاء</SelectItem>
                {partners.map(partner => (
                  <SelectItem key={partner.id} value={partner.id}>
                    {partner.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-1 block">التصنيف</label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="جميع التصنيفات" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع التصنيفات</SelectItem>
                {allCategories.map(category => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end gap-2">
            <Button variant="outline" onClick={handleExportExcel} className="flex-1">
              <FileSpreadsheet className="w-4 h-4 ml-2" />
              تصدير Excel
            </Button>
            <Button variant="outline" onClick={handleShareWhatsApp}>
              <Share2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">إجمالي الأرباح</p>
          <p className="text-xl font-bold text-foreground">${formatNumber(summary.totalProfit)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">عدد العمليات</p>
          <p className="text-xl font-bold text-foreground">{formatNumber(summary.totalTransactions)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">أرباح مؤكدة</p>
          <p className="text-xl font-bold text-success">${formatNumber(summary.confirmedProfit)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">أرباح معلقة</p>
          <p className="text-xl font-bold text-warning">${formatNumber(summary.pendingProfit)}</p>
        </div>
      </div>

      {/* Aggregated View by Partner */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold flex items-center gap-2">
            <Tag className="w-5 h-5 text-primary" />
            ملخص الأرباح حسب الشريك والتصنيف
          </h3>
        </div>

        {aggregatedData.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            لا توجد بيانات للفترة المحددة
          </div>
        ) : (
          <div className="divide-y divide-border">
            {aggregatedData.map(partner => (
              <div key={partner.partnerId}>
                <button
                  onClick={() => togglePartnerExpand(partner.partnerId)}
                  className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center">
                      {partner.partnerName.charAt(0)}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{partner.partnerName}</p>
                      <p className="text-sm text-muted-foreground">
                        {Object.keys(partner.byCategory).length} تصنيف
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-left">
                      <p className="text-lg font-bold text-success">${formatNumber(partner.totalProfit)}</p>
                    </div>
                    {expandedPartners.has(partner.partnerId) ?
                      <ChevronUp className="w-5 h-5 text-muted-foreground" /> :
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    }
                  </div>
                </button>

                {expandedPartners.has(partner.partnerId) && (
                  <div className="bg-muted/30 px-4 pb-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
                      {Object.entries(partner.byCategory)
                        .sort(([, a], [, b]) => b.amount - a.amount)
                        .map(([category, data]) => (
                          <div
                            key={category}
                            className="bg-card rounded-lg p-3 border border-border"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">{category}</span>
                              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                                {data.count} عملية
                              </span>
                            </div>
                            <p className="text-lg font-bold text-primary mt-1">
                              ${formatNumber(data.amount)}
                            </p>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detailed Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            التفاصيل الكاملة
          </h3>
          <p className="text-sm text-muted-foreground">
            {detailedData.length} سجل
          </p>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => toggleSort('date')}
                >
                  <SortIcon field="date" />
                  التاريخ
                </TableHead>
                <TableHead>الشريك</TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => toggleSort('category')}
                >
                  <SortIcon field="category" />
                  التصنيف
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => toggleSort('amount')}
                >
                  <SortIcon field="amount" />
                  المبلغ
                </TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detailedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    لا توجد بيانات للفترة المحددة
                  </TableCell>
                </TableRow>
              ) : (
                detailedData.slice(0, 100).map((row, idx) => (
                  <TableRow key={`${row.invoiceId}-${idx}`}>
                    <TableCell className="font-mono text-sm">{row.date}</TableCell>
                    <TableCell>{row.partnerName}</TableCell>
                    <TableCell>
                      <span className="px-2 py-1 bg-primary/10 text-primary rounded-full text-xs">
                        {row.category}
                      </span>
                    </TableCell>
                    <TableCell className="font-semibold">${formatNumber(row.amount)}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs ${row.status === 'confirmed'
                          ? 'bg-success/10 text-success'
                          : 'bg-warning/10 text-warning'
                        }`}>
                        {row.status === 'confirmed' ? 'مؤكد' : 'معلق'}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {detailedData.length > 100 && (
          <div className="p-3 border-t border-border text-center text-sm text-muted-foreground">
            يتم عرض أول 100 سجل من {detailedData.length} سجل - صدّر التقرير للاطلاع على الكل
          </div>
        )}
      </div>
    </div>
  );
}
