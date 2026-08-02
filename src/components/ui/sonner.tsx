"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--overlay)",
          "--normal-text": "var(--foreground)",
          "--normal-border": "var(--primary)",
          "--border-radius": "9px",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            "border border-[var(--normal-border)] bg-[var(--normal-bg)] text-[var(--normal-text)] text-[13px] px-[18px] py-[9px] shadow-[0_8px_30px_var(--shadow-strong)]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
