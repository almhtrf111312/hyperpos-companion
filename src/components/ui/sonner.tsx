import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";
import { useLanguage } from "@/hooks/use-language";
import { cn } from "@/lib/utils";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();
  const { isRTL } = useLanguage();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-center"
      duration={2600}
      visibleToasts={3}
      closeButton={false}
      swipeDirections={['left', 'right', 'top']}
      offset={58}
      mobileOffset={58}
      dir={isRTL ? "rtl" : "ltr"}
      style={{
        '--width': 'auto',
        '--front-toast-width': 'auto'
      } as React.CSSProperties}
      toastOptions={{
        classNames: {
          toast: cn(
            "group toast w-auto min-w-[290px] max-w-[94vw] sm:max-w-[420px]",
            "group-[.toaster]:bg-card/95 group-[.toaster]:backdrop-blur-2xl group-[.toaster]:text-card-foreground",
            "group-[.toaster]:border group-[.toaster]:border-border/80 dark:group-[.toaster]:border-white/10",
            "group-[.toaster]:shadow-2xl group-[.toaster]:rounded-2xl",
            "group-[.toaster]:p-3.5 sm:group-[.toaster]:p-4 group-[.toaster]:text-sm sm:group-[.toaster]:text-base",
            "[touch-action:pan-x] cursor-grab active:cursor-grabbing",
            "transition-all duration-200 select-none",
            isRTL
              ? "group-[.toaster]:border-r-[5px] group-[.toaster]:border-l"
              : "group-[.toaster]:border-l-[5px] group-[.toaster]:border-r"
          ),
          title: "group-[.toast]:font-bold group-[.toast]:text-card-foreground group-[.toast]:text-sm sm:group-[.toast]:text-base leading-snug",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:text-xs sm:group-[.toast]:text-sm group-[.toast]:mt-1 leading-relaxed",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-xl group-[.toast]:text-xs group-[.toast]:font-semibold group-[.toast]:px-4 group-[.toast]:py-2 group-[.toast]:shadow-sm hover:opacity-90 transition-opacity",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-xl group-[.toast]:text-xs group-[.toast]:px-3.5 group-[.toast]:py-2",
          closeButton: "hidden",
          success: isRTL ? "group-[.toaster]:!border-r-emerald-500 group-[.toaster]:!text-card-foreground" : "group-[.toaster]:!border-l-emerald-500 group-[.toaster]:!text-card-foreground",
          error: isRTL ? "group-[.toaster]:!border-r-destructive group-[.toaster]:!text-card-foreground" : "group-[.toaster]:!border-l-destructive group-[.toaster]:!text-card-foreground",
          warning: isRTL ? "group-[.toaster]:!border-r-amber-500 group-[.toaster]:!text-card-foreground" : "group-[.toaster]:!border-l-amber-500 group-[.toaster]:!text-card-foreground",
          info: isRTL ? "group-[.toaster]:!border-r-primary group-[.toaster]:!text-card-foreground" : "group-[.toaster]:!border-l-primary group-[.toaster]:!text-card-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
