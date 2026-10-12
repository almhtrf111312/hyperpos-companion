import { FileText, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/use-language';

interface Props {
  onExportPDF: () => void;
  onExportExcel: () => void;
  disabled?: boolean;
  extraActions?: React.ReactNode;
}

export function ReportToolbar({ onExportPDF, onExportExcel, disabled, extraActions }: Props) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={onExportPDF} disabled={disabled} className="h-8 text-xs rounded-lg gap-1">
        <FileText className="w-3.5 h-3.5" />
        {t('reports.exportPDF') || 'PDF'}
      </Button>
      <Button variant="outline" size="sm" onClick={onExportExcel} disabled={disabled} className="h-8 text-xs rounded-lg gap-1">
        <Download className="w-3.5 h-3.5" />
        {t('reports.exportExcel') || 'Excel'}
      </Button>
      {extraActions}
    </div>
  );
}
