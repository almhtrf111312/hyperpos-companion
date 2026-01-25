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
      duration={1500}
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:rounded-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success: "group-[.toaster]:!bg-success/15 group-[.toaster]:!text-success group-[.toaster]:!border-success/30",
          error: "group-[.toaster]:!bg-destructive/15 group-[.toaster]:!text-destructive group-[.toaster]:!border-destructive/30",
          warning: "group-[.toaster]:!bg-warning/15 group-[.toaster]:!text-warning group-[.toaster]:!border-warning/30",
          info: "group-[.toaster]:!bg-primary/15 group-[.toaster]:!text-primary group-[.toaster]:!border-primary/30",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
