import * as React from "react";
import { LucideIcon, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface EmptyStateProps {
  icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon | React.ComponentType<{ className?: string }>;
    variant?: "default" | "outline" | "secondary";
  };
  children?: React.ReactNode;
  className?: string;
  iconClassName?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  children,
  className,
  iconClassName,
}: EmptyStateProps) {
  const ActionIcon = action?.icon;

  return (
    <div
      className={cn(
        "bg-card text-card-foreground border border-border/70 rounded-2xl p-6 sm:p-10 text-center flex flex-col items-center justify-center shadow-xs select-none",
        className
      )}
    >
      <div className="w-14 h-14 rounded-2xl bg-muted/60 border border-border/80 flex items-center justify-center mb-3 text-muted-foreground shadow-2xs">
        <Icon className={cn("w-7 h-7 text-muted-foreground/80", iconClassName)} />
      </div>

      <h3 className="text-base sm:text-lg font-bold text-foreground mb-1 leading-snug">
        {title}
      </h3>

      {description && (
        <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto mb-4 leading-relaxed">
          {description}
        </p>
      )}

      {action && (
        <Button
          variant={action.variant || "default"}
          onClick={action.onClick}
          className="rounded-xl gap-2 font-semibold text-xs sm:text-sm min-h-[44px] px-5"
        >
          {ActionIcon && <ActionIcon className="w-4 h-4" />}
          {action.label}
        </Button>
      )}

      {children && <div className="mt-4 w-full">{children}</div>}
    </div>
  );
}
