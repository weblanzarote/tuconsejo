import { Label } from "@/components/ui/label";
import { getDetectedTimeZone } from "@/lib/dateTz";
import { TIMEZONE_PRESETS } from "@/lib/timezonePresets";
import { cn } from "@/lib/utils";

interface TimezoneSelectProps {
  value: string;
  onChange: (iana: string) => void;
  id?: string;
  className?: string;
}

/**
 * Selector de zona IANA para el “día civil” del diario (medianoche local del usuario).
 */
export function TimezoneSelect({ value, onChange, id = "timezone", className }: TimezoneSelectProps) {
  const detected = getDetectedTimeZone();
  const hasDetectedInList = TIMEZONE_PRESETS.some((z) => z.value === detected);
  const options = hasDetectedInList
    ? TIMEZONE_PRESETS
    : [{ value: detected, label: `Este dispositivo — ${detected}` }, ...TIMEZONE_PRESETS];

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="text-sm text-muted-foreground">
        Zona horaria
      </Label>
      <select
        id={id}
        value={value || detected}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-10 rounded-md border border-border bg-input px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {options.map((z) => (
          <option key={z.value} value={z.value}>
            {z.label}
          </option>
        ))}
      </select>
      <p className="text-[11px] text-muted-foreground leading-snug">
        El diario usa <strong className="text-foreground/90">un día por fecha en esta zona</strong> (cuándo empieza “mañana” en tu reloj). El servidor la guarda para coincidir con tu calendario.
      </p>
    </div>
  );
}
