/**
 * Provides shared card layout primitives for panelized UI sections.
 */
import * as React from "react";

import { cn } from "@/lib/utils";

/** Renders the outer card container. */
function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-2xl border border-border/60 bg-card/85 text-card-foreground shadow-xl", className)}
      {...props}
    />
  );
}

/** Renders card header content. */
function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />;
}

/** Renders the primary card heading. */
function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return <h3 className={cn("text-xl font-semibold tracking-tight", className)} {...props} />;
}

/** Renders supporting card description text. */
function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

/** Renders card body content. */
function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}

/** Renders card footer content. */
function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex items-center p-6 pt-0", className)} {...props} />;
}

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
