import { exportToExcel } from '@/lib/excel-export';
import { exportToPDF } from '@/lib/pdf-export';

export interface ColumnDef {
  key: string;
  label: string;
}

export interface ExportOptions {
  title: string;
  subtitle?: string;
  sheetName?: string;
  columns: ColumnDef[];
  rows: Record<string, unknown>[];
  fileName?: string;
  totals?: Record<string, number>;
  summary?: { label: string; value: string | number }[];
}

/** Unified PDF export — uses the same dataset as the on-screen report. */
export async function exportGenericToPDF(opts: ExportOptions) {
  await exportToPDF({
    title: opts.title,
    subtitle: opts.subtitle,
    columns: opts.columns.map(c => ({ header: c.label, key: c.key })),
    data: opts.rows,
    totals: opts.totals,
    summary: opts.summary,
    fileName: opts.fileName || `${opts.title}.pdf`,
    orientation: 'portrait',
  });
}

/** Unified Excel export — uses the same dataset as the on-screen report. */
export async function exportGenericToExcel(opts: ExportOptions) {
  await exportToExcel({
    sheetName: opts.sheetName || opts.title,
    fileName: opts.fileName || `${opts.title}.xlsx`,
    title: opts.title,
    subtitle: opts.subtitle,
    columns: opts.columns.map(c => ({ header: c.label, key: c.key })),
    data: opts.rows,
    totals: opts.totals,
    summary: opts.summary,
  });
}
