import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

// Plain controlled input. Android IME handling is left to the browser:
// no synthetic composition events and no DOM value mutation (both caused
// stale search results and "ghost" backspaces in the Android app).
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-xl border border-border/50 bg-muted/30 px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary/50 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm transition-all duration-200",
          className
        )}
        ref={ref}
        autoComplete={props.autoComplete ?? "off"}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";

export { Input };
