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
      offset={60}
      swipeDirections={['left', 'right']}
      style={{
        '--width': 'auto',
        '--front-toast-width': 'auto'
      } as React.CSSProperties}
      toastOptions={{
        classNames: {
          toast:
            "group toast w-auto min-w-[300px] max-w-[90vw] group-[.toaster]:bg-background group-[.toaster]:opacity-100 group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-xl group-[.toaster]:rounded-xl group-[.toaster]:backdrop-blur-none group-[.toaster]:border",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:text-sm",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success: "group-[.toaster]:!bg-success/15 group-[.toaster]:!text-success-foreground group-[.toaster]:!border-success/30",
          error: "group-[.toaster]:!bg-destructive/15 group-[.toaster]:!text-destructive-foreground group-[.toaster]:!border-destructive/30",
          warning: "group-[.toaster]:!bg-warning/15 group-[.toaster]:!text-warning-foreground group-[.toaster]:!border-warning/30",
          info: "group-[.toaster]:!bg-primary/15 group-[.toaster]:!text-primary-foreground group-[.toaster]:!border-primary/30",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
