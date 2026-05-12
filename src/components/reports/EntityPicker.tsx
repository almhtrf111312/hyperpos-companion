import { useState, useMemo, useEffect } from 'react';
import { Search, Check, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface PickableEntity {
  id: string;
  name: string;
  subtitle?: string;
}

interface Props {
  label: string;
  placeholder?: string;
  items: PickableEntity[];
  value: string | null;
  onChange: (id: string | null) => void;
  emptyText?: string;
}

/**
 * Inline entity picker (no portal, mobile-stable).
 * Used to filter a report to a single product/customer/partner/cashier.
 */
export function EntityPicker({ label, placeholder = 'بحث...', items, value, onChange, emptyText = 'لا توجد نتائج' }: Props) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const selected = useMemo(() => items.find(i => i.id === value) || null, [items, value]);

  const filtered = useMemo(() => {
    if (!search.trim()) return items.slice(0, 50);
    const s = search.trim().toLowerCase();
    return items.filter(i =>
      i.name.toLowerCase().includes(s) || (i.subtitle || '').toLowerCase().includes(s)
    ).slice(0, 50);
  }, [items, search]);

  useEffect(() => { if (!open) setSearch(''); }, [open]);

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {selected ? (
        <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2">
          <Check className="w-4 h-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{selected.name}</p>
            {selected.subtitle && <p className="text-[10px] text-muted-foreground truncate">{selected.subtitle}</p>}
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { onChange(null); setOpen(false); }}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="w-full text-right rounded-xl border border-border/50 bg-card px-3 py-2 text-sm text-muted-foreground hover:border-primary/40 transition-colors"
        >
          {placeholder}
        </button>
      )}

      {open && !selected && (
        <div className="rounded-xl border border-border bg-card shadow-lg overflow-hidden">
          <div className="relative p-2 border-b border-border/50">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ابحث بالاسم أو الباركود..."
              className="h-8 text-xs pr-8"
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">{emptyText}</p>
            ) : (
              filtered.map(it => (
                <button
                  key={it.id}
                  onClick={() => { onChange(it.id); setOpen(false); }}
                  className={cn(
                    'w-full text-right px-3 py-2 text-sm hover:bg-muted/60 transition-colors border-b border-border/30 last:border-0',
                  )}
                >
                  <p className="font-medium truncate">{it.name}</p>
                  {it.subtitle && <p className="text-[10px] text-muted-foreground truncate mt-0.5">{it.subtitle}</p>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
