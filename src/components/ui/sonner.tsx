import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-right"
      duration={2000}
      closeButton
      offset={16}
      
      style={{
        '--width': 'auto',
        '--front-toast-width': 'auto'
      } as React.CSSProperties}
      toastOptions={{
        classNames: {
          toast:
            "group toast w-auto min-w-[220px] max-w-[85vw] group-[.toaster]:bg-card/98 dark:group-[.toaster]:bg-card/98 group-[.toaster]:backdrop-blur-lg group-[.toaster]:text-foreground group-[.toaster]:border group-[.toaster]:border-border/60 group-[.toaster]:shadow-xl group-[.toaster]:rounded-lg group-[.toaster]:border-l-4 transition-all duration-200 hover:scale-105 hover:shadow-lg dark:hover:shadow-black/30",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:text-xs",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-md group-[.toast]:text-xs group-[.toast]:px-3 group-[.toast]:py-1.5",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-md group-[.toast]:text-xs group-[.toast]:px-3 group-[.toast]:py-1.5",
          success: "group-[.toaster]:!border-l-success group-[.toaster]:!text-foreground",
          error: "group-[.toaster]:!border-l-destructive group-[.toaster]:!text-foreground",
          warning: "group-[.toaster]:!border-l-warning group-[.toaster]:!text-foreground",
          info: "group-[.toaster]:!border-l-primary group-[.toaster]:!text-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
