import { cn } from "@/lib/utils";
import { type KeyboardEvent, useRef } from "react";

interface DiaryEntryProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

/**
 * Área de texto del diario: sin auto-expand en cada tecla (evita reflow y tirones al escribir).
 * Altura generosa + scroll interno, como un cuaderno fijo.
 */
export default function DiaryEntry({
  value,
  onChange,
  onKeyDown,
  disabled = false,
  placeholder = "Escribe libremente sobre tu día...",
  className,
}: DiaryEntryProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      disabled={disabled}
      placeholder={placeholder}
      className={cn(
        "w-full resize-y min-h-[min(50vh,22rem)] max-h-[min(70vh,32rem)] overflow-y-auto rounded-lg border border-transparent bg-transparent px-1 py-2 outline-none",
        "font-diary text-foreground text-[1.05rem] leading-relaxed",
        "placeholder:text-muted-foreground/50",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        "focus:border-border/40 focus:bg-background/30",
        className
      )}
      rows={12}
      spellCheck
    />
  );
}
