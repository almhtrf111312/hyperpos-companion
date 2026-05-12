import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { FileText, Download } from 'lucide-react';

interface Props {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  children: ReactNode;
  filters?: ReactNode;
  onExportPDF?: () => void;
  onExportExcel?: () => void;
  exportDisabled?: boolean;
  className?: string;
}

/**
 * Unified report shell used by advanced reports.
 * Provides: large gradient header, filter slot, sticky export toolbar, content area.
 * Mobile-first: no horizontal overflow at 375px.
 */
export function ReportShell({ icon, title, subtitle, children, filters, onExportPDF, onExportExcel, exportDisabled, className }: Props) {
  return (
    <div className={cn('space-y-3', className)}>
      {/* Header card */}
      <div className="rounded-2xl bg-gradient-to-l from-primary/15 via-primary/5 to-transparent border border-primary/20 p-4 flex items-start gap-3">
        <div className="shrink-0 w-11 h-11 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base md:text-lg font-bold text-foreground truncate">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{subtitle}</p>}
        </div>
      </div>

      {/* Filters slot */}
      {filters && (
        <div className="rounded-2xl border border-border/40 bg-card p-3">
          {filters}
        </div>
      )}

      {/* Export toolbar */}
      {(onExportPDF || onExportExcel) && (
        <div className="flex items-center gap-2 sticky top-0 z-10 bg-background/85 backdrop-blur py-1.5">
          {onExportPDF && (
            <Button variant="outline" size="sm" onClick={onExportPDF} disabled={exportDisabled} className="h-9 text-xs rounded-xl gap-1.5 flex-1 max-w-[160px]">
              <FileText className="w-4 h-4" /> تصدير PDF
            </Button>
          )}
          {onExportExcel && (
            <Button variant="outline" size="sm" onClick={onExportExcel} disabled={exportDisabled} className="h-9 text-xs rounded-xl gap-1.5 flex-1 max-w-[160px]">
              <Download className="w-4 h-4" /> تصدير Excel
            </Button>
          )}
        </div>
      )}

      {/* Content */}
      <div className="space-y-3">
        {children}
      </div>
    </div>
  );
}
