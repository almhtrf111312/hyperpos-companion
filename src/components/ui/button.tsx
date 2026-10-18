import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold leading-[var(--app-button-line-height,1.4)] ring-offset-background transition-[transform,colors,opacity,box-shadow,filter] duration-150 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-95 cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-gradient-primary text-primary-foreground shadow-xs hover:brightness-105 hover:shadow-sm hover:scale-[1.01]",
        destructive: "bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90 hover:scale-[1.01]",
        outline: "border border-border/80 bg-card text-foreground hover:bg-muted/80 hover:border-border shadow-2xs hover:scale-[1.01]",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-2xs hover:scale-[1.01]",
        ghost: "hover:bg-muted hover:text-foreground active:scale-95",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        xs: "min-h-7 px-2 py-1 text-xs",
        default: "min-h-10 px-4 py-2",
        sm: "min-h-9 px-3 py-1.5 text-xs sm:text-sm",
        lg: "min-h-11 px-8 py-2.5",
        icon: "size-10 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
