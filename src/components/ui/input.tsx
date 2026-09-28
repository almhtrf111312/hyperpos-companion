import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, onChange, ...props }, ref) => {

    // ✅ Fix: Android IME Composition Bug in Capacitor WebView
    // When user types on Android keyboard, the IME enters "composition mode"
    // which adds invisible characters to the input buffer.
    // onCompositionEnd fires when the user finishes composing (lifts finger/confirms word)
    // and forces React to sync with the actual DOM value.
    const handleCompositionEnd = (
      e: React.CompositionEvent<HTMLInputElement>
    ) => {
      const target = e.target as HTMLInputElement;
      const syntheticEvent = {
        ...e,
        target,
        currentTarget: target,
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      onChange?.(syntheticEvent);
    };

    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-xl border border-border/50 bg-muted/30 px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary/50 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm transition-all duration-200",
          className
        )}
        ref={ref}
        onChange={onChange}
        onCompositionEnd={handleCompositionEnd}
        autoComplete={props.autoComplete ?? "off"}
        autoCorrect={props.autoCorrect ?? "off"}
        spellCheck={props.spellCheck ?? false}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";

export { Input };
