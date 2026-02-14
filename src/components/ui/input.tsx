import * as React from "react";

import { cn } from "@/lib/utils";

// Convert Arabic/Hindi numerals to English
const normalizeDigits = (value: string): string => {
  const arabicMap = [/٠/g, /١/g, /٢/g, /٣/g, /٤/g, /٥/g, /٦/g, /٧/g, /٨/g, /٩/g];
  const hindiMap = [/۰/g, /۱/g, /۲/g, /۳/g, /۴/g, /۵/g, /۶/g, /۷/g, /۸/g, /۹/g];
  let result = value;
  for (let i = 0; i < 10; i++) {
    result = result.replace(arabicMap[i], i.toString()).replace(hindiMap[i], i.toString());
  }
  return result;
};

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onChange, inputMode, pattern, ...props }, ref) => {
    const isNumeric = type === "number";

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (isNumeric || type === "tel") {
        const normalized = normalizeDigits(e.target.value);
        if (normalized !== e.target.value) {
          e.target.value = normalized;
        }
      }
      onChange?.(e);
    };

    return (
      <input
        type={type}
        inputMode={inputMode || (isNumeric ? "decimal" : undefined)}
        pattern={pattern || (isNumeric ? "[0-9]*" : undefined)}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        onChange={handleChange}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
