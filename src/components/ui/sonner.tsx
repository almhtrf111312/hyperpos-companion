import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-center"
      duration={3500}
      closeButton
      offset={16}
      style={{
        '--width': 'auto',
        '--front-toast-width': 'auto'
      } as React.CSSProperties}
      toastOptions={{
        classNames: {
          toast:
            "group toast w-auto min-w-[300px] max-w-[90vw] group-[.toaster]:bg-card group-[.toaster]:text-card-foreground group-[.toaster]:border group-[.toaster]:border-border group-[.toaster]:shadow-2xl group-[.toaster]:rounded-xl group-[.toaster]:border-l-[6px] group-[.toaster]:p-4 group-[.toaster]:text-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-xl",
          title: "group-[.toast]:font-semibold group-[.toast]:text-card-foreground group-[.toast]:text-sm",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:text-sm group-[.toast]:mt-1 leading-relaxed",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-lg group-[.toast]:text-xs group-[.toast]:font-semibold group-[.toast]:px-4 group-[.toast]:py-2 group-[.toast]:shadow-sm hover:opacity-90 transition-opacity",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-lg group-[.toast]:text-xs group-[.toast]:px-3.5 group-[.toast]:py-2",
          closeButton: "group-[.toast]:bg-muted/80 group-[.toast]:text-foreground group-[.toast]:border-border/60 hover:group-[.toast]:bg-muted",
          success: "group-[.toaster]:!border-l-success group-[.toaster]:!text-card-foreground",
          error: "group-[.toaster]:!border-l-destructive group-[.toaster]:!text-card-foreground",
          warning: "group-[.toaster]:!border-l-warning group-[.toaster]:!text-card-foreground",
          info: "group-[.toaster]:!border-l-info group-[.toaster]:!text-card-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
