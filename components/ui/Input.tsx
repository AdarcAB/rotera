import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200",
        className
      )}
      {...props}
    />
  );
}

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("text-sm font-medium text-neutral-800 mb-1 block", className)}
      {...props}
    />
  );
}

export function Field({ children }: { children: React.ReactNode }) {
  return <div className="mb-3">{children}</div>;
}
