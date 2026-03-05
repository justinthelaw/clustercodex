/**
 * Provides shared table primitives with consistent styling for data grids.
 */
import * as React from "react";

import { cn } from "@/lib/utils";

/** Renders a table element with shared baseline classes. */
function Table({ className, ...props }: React.ComponentProps<"table">) {
  return <table className={cn("w-full caption-bottom text-sm", className)} {...props} />;
}

/** Renders a table header section. */
function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead className={cn("[&_tr]:border-b [&_tr]:border-border/70", className)} {...props} />;
}

/** Renders a table body section. */
function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

/** Renders a table footer section. */
function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      className={cn("border-t border-border/70 bg-muted/30 font-medium [&>tr]:last:border-b-0", className)}
      {...props}
    />
  );
}

/** Renders a table row. */
function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      className={cn(
        "border-b border-border/60 transition-colors hover:bg-muted/35 data-[state=selected]:bg-muted/45",
        className
      )}
      {...props}
    />
  );
}

/** Renders a table header cell. */
function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      className={cn(
        "h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground",
        className
      )}
      {...props}
    />
  );
}

/** Renders a table data cell. */
function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return <td className={cn("p-4 align-middle", className)} {...props} />;
}

/** Renders a table caption. */
function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return <caption className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />;
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption
};
