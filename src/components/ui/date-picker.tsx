import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerProps {
  value?: string; // ISO string format (YYYY-MM-DD)
  onChange: (date: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  highlightedDates?: string[]; // array of 'YYYY-MM-DD' dates that have data/invoices
}

export function DatePicker({
  value,
  onChange,
  placeholder = "اختر التاريخ",
  className,
  disabled = false,
  highlightedDates,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  
  const selectedDate = value ? new Date(value) : undefined;

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      // Convert to ISO string format (YYYY-MM-DD)
      const isoDate = format(date, "yyyy-MM-dd");
      onChange(isoDate);
      setOpen(false);
    }
  };

  const modifiers = React.useMemo(() => {
    if (!highlightedDates || highlightedDates.length === 0) return undefined;
    const set = new Set(highlightedDates);
    return {
      hasData: (date: Date) => set.has(format(date, "yyyy-MM-dd")),
      emptyDay: (date: Date) => !set.has(format(date, "yyyy-MM-dd")),
    };
  }, [highlightedDates]);

  const modifiersClassNames = React.useMemo(() => {
    if (!highlightedDates || highlightedDates.length === 0) return undefined;
    return {
      hasData:
        "font-bold text-foreground bg-primary/15 border border-primary/40 rounded-md relative after:content-[''] after:absolute after:bottom-0.5 after:left-1/2 after:-translate-x-1/2 after:w-1.5 after:h-1.5 after:bg-primary after:rounded-full",
      emptyDay: "opacity-35 text-muted-foreground/60 hover:opacity-75",
    };
  }, [highlightedDates]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-right font-normal bg-muted border-0 h-10",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="ml-2 h-4 w-4" />
          {value ? format(selectedDate!, "yyyy/MM/dd") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 z-50" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          modifiers={modifiers}
          modifiersClassNames={modifiersClassNames}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
        {highlightedDates && highlightedDates.length > 0 && (
          <div className="px-3 py-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground bg-muted/20">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary inline-block shrink-0" />
              <span>أيام بها فواتير</span>
            </div>
            <div className="flex items-center gap-1.5 opacity-60">
              <span className="w-2 h-2 rounded-full bg-muted-foreground/40 inline-block shrink-0" />
              <span>أيام فارغة</span>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
