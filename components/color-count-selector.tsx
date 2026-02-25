"use client";

interface ColorCountSelectorProps {
  count: number;
  onChange: (count: number) => void;
}

export function ColorCountSelector({ count, onChange }: ColorCountSelectorProps) {
  const options = [3, 4, 5, 6, 7, 8];

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground">Colors</span>
      <div className="flex gap-1">
        {options.map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={`w-8 h-8 rounded-lg text-sm font-mono transition-all duration-200 ${
              count === n
                ? "bg-foreground text-background font-medium"
                : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
            }`}
            aria-label={`Extract ${n} colors`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
