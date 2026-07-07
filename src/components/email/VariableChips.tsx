import { Badge } from "@/components/ui/badge";
import { variableToken } from "@/lib/rejectionEmailTemplate";

interface VariableChipsProps {
  variables: readonly string[];
  onInsert: (variable: string) => void;
}

export function VariableChips({ variables, onInsert }: VariableChipsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {variables.map((variable) => (
        <button key={variable} type="button" onClick={() => onInsert(variable)}>
          <Badge variant="secondary" className="font-mono text-xs cursor-pointer hover:bg-primary/10">
            {variableToken(variable)}
          </Badge>
        </button>
      ))}
    </div>
  );
}
