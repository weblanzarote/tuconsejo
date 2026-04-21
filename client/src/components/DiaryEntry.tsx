import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface DiaryEntryProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export default function DiaryEntry({
  value,
  onChange,
  onBlur,
  disabled = false,
  placeholder = "Escribe libremente sobre tu día...",
  className,
}: DiaryEntryProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Auto-expand textarea
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      disabled={disabled}
      placeholder={placeholder}
      className={cn(
        "w-full resize-none bg-transparent border-none outline-none",
        "font-diary text-foreground text-[1.05rem] leading-relaxed",
        "placeholder:text-muted-foreground/50",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        "min-h-[280px]",
        className
      )}
      rows={10}
    />
  );
}
