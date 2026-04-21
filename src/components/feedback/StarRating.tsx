import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
  readOnly?: boolean;
}

export default function StarRating({ value, onChange, size = 20, readOnly = false }: Props) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(n)}
          className={cn(
            "transition-transform",
            !readOnly && "hover:scale-110 active:scale-95 cursor-pointer",
            readOnly && "cursor-default",
          )}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
        >
          <Star
            style={{ width: size, height: size }}
            className={cn(
              n <= value ? "fill-amber-400 text-amber-400" : "fill-transparent text-muted-foreground/40",
            )}
          />
        </button>
      ))}
    </div>
  );
}