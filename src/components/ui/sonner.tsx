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
      duration={2000}
      closeButton
      offset={110}
      swipeDirections={['left', 'right']}
      style={{
        '--width': 'auto',
        '--front-toast-width': 'auto'
      } as React.CSSProperties}
      toastOptions={{
        classNames: {
          toast:
            "group toast w-auto min-w-[300px] max-w-[90vw] group-[.toaster]:bg-background/95 dark:group-[.toaster]:bg-background/90 group-[.toaster]:backdrop-blur-md group-[.toaster]:text-foreground group-[.toaster]:border-border/50 group-[.toaster]:shadow-2xl group-[.toaster]:rounded-full group-[.toaster]:border group-[.toaster]:border-s-[6px] transition-all duration-300 hover:scale-[1.02] hover:shadow-black/10 dark:hover:shadow-white/5",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:text-sm",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-full",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-full",
          success: "group-[.toaster]:!border-s-success group-[.toaster]:!text-foreground",
          error: "group-[.toaster]:!border-s-destructive group-[.toaster]:!text-foreground",
          warning: "group-[.toaster]:!border-s-warning group-[.toaster]:!text-foreground",
          info: "group-[.toaster]:!border-s-primary group-[.toaster]:!text-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
