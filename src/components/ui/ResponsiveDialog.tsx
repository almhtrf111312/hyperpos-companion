import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";

export interface ResponsiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  trigger?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  footerClassName?: string;
}

/**
 * ResponsiveDialog:
 * - Desktop & iPad (>=768px): Centered Radix Dialog modal.
 * - Mobile (<768px): Bottom Sheet modal with w-[calc(100%-2rem)], max-h-[85vh],
 *   internal scroll, and sticky bottom footer with safe area padding.
 */
export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  trigger,
  className,
  bodyClassName,
  footerClassName,
}: ResponsiveDialogProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
        <SheetContent
          side="bottom"
          className={cn(
            "w-[calc(100%-2rem)] max-h-[85vh] max-h-[85dvh] mx-auto mb-2 rounded-2xl flex flex-col p-4 z-50 bg-card border border-border shadow-2xl",
            className
          )}
        >
          <SheetHeader className="text-right shrink-0 pb-2.5 border-b border-border/50">
            <SheetTitle className="text-base font-bold text-foreground">
              {title}
            </SheetTitle>
            {description && (
              <SheetDescription className="text-xs text-muted-foreground mt-1">
                {description}
              </SheetDescription>
            )}
          </SheetHeader>

          {/* Scrollable Body */}
          <div className={cn("flex-1 overflow-y-auto py-3 px-0.5 min-h-0", bodyClassName)}>
            {children}
          </div>

          {/* Sticky Bottom Actions */}
          {footer && (
            <div
              className={cn(
                "shrink-0 pt-2.5 border-t border-border/60 pb-[env(safe-area-inset-bottom,0px)] flex flex-col gap-2",
                footerClassName
              )}
            >
              {footer}
            </div>
          )}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        className={cn(
          "sm:max-w-lg max-h-[85vh] max-h-[85dvh] flex flex-col p-6 z-50 bg-card border border-border shadow-xl",
          className
        )}
      >
        <DialogHeader className="text-right shrink-0 pb-3 border-b border-border/50">
          <DialogTitle className="text-lg font-bold text-foreground">
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>

        {/* Scrollable Body */}
        <div className={cn("flex-1 overflow-y-auto py-4 px-1 min-h-0", bodyClassName)}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <DialogFooter
            className={cn(
              "shrink-0 pt-3 border-t border-border/60 flex items-center justify-end gap-2",
              footerClassName
            )}
          >
            {footer}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
