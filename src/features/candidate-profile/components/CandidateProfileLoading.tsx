import { Skeleton } from "@/components/ui/skeleton";

export function CandidateProfileLoading() {
  return (
    <div className="space-y-6 max-w-3xl">
      <Skeleton className="h-8 w-48" />
      <div className="bg-card border rounded-xl p-6 space-y-4">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="bg-card border rounded-xl p-6 space-y-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-20 w-full" />
      </div>
    </div>
  );
}
