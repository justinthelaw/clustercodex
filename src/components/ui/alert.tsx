/**
 * Provides shared alert primitives with variant styling for status messaging.
 */
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-3 [&>svg+div]:translate-y-[-2px] [&>svg~*]:pl-7",
  {
    variants: {
      variant: {
        default: "border-border/70 bg-card/70 text-foreground",
        destructive: "border-destructive/40 bg-destructive/12 text-destructive"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

/** Renders a styled alert container with semantic role metadata. */
function Alert({ className, variant, ...props }: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
  );
}

/** Renders the alert heading text. */
function AlertTitle({ className, ...props }: React.ComponentProps<"h5">) {
  return <h5 className={cn("mb-1 font-medium leading-none tracking-tight", className)} {...props} />;
}

/** Renders supporting alert body content. */
function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("text-sm [&_p]:leading-relaxed", className)} {...props} />;
}

export { Alert, AlertTitle, AlertDescription };
