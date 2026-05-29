import { cn } from "@/lib/utils";
import { ReactNode } from "react";

export function BentoGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-[minmax(140px,auto)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function BentoTile({
  children,
  className,
  colSpan = 1,
  rowSpan = 1,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  colSpan?: 1 | 2 | 3 | 4;
  rowSpan?: 1 | 2 | 3;
  delay?: number;
}) {
  const col = { 1: "lg:col-span-1", 2: "lg:col-span-2", 3: "lg:col-span-3", 4: "lg:col-span-4" }[colSpan];
  const row = { 1: "lg:row-span-1", 2: "lg:row-span-2", 3: "lg:row-span-3" }[rowSpan];
  return (
    <div
      className={cn(
        "stat-card animate-fade-in flex flex-col",
        col,
        row,
        colSpan >= 2 ? "sm:col-span-2" : "",
        className,
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}