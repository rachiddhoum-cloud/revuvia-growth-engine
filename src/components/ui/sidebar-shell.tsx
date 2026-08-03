"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const shellVariants = cva("grid items-start gap-8", {
  variants: {
    variant: {
      default: "grid-cols-1 gap-8 md:grid-cols-[220px_1fr]",
      sidebar: "",
      centered: "flex justify-center",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

function SidebarShell({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof shellVariants>) {
  return <div data-slot="sidebar-shell" className={cn(shellVariants({ variant }), className)} {...props} />;
}

export { SidebarShell };
