import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  CheckCircle2,
  Edit3,
  Loader2,
  Save,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface VaultSection {
  key: string;
  label: string;
  emoji: string;
  color: string;
  fields: Array<{
    key: string;
    label: string;
    type?: "text" | "textarea" | "number";
    placeholder?: string;
  }>;
}

const VAULT_SECTIONS: VaultSection[] = [
  {
    key: "personalInfo",
    label: "Perfil Personal",
    emoji: "👤",
    color: "#8b5cf6",
    fields: [
      { key: "nombre", label: "Nombre completo", placeholder: "Tu nombre" },
      { key: "edad", label: "Edad", type: "number", placeholder: "32" },
      { key: "ubicacion", label: "Ubicación", placeholder: "Ciudad, País" },
      { key: "educacion", label: "Educación", placeholder: "Nivel educativo" },
      { key: "idiomas", label: "Idiomas", placeholder: "Español, Inglés..." },
    ],
  },
  {
    key: "financialStatus",
    label: "Estado Financiero",
    emoji: "💰",
    color: "#10b981",
    fields: [
      { key: "ingresos", label: "Ingresos mensuales", placeholder: "Ej: 3.500€" },
      { key: "ahorros", label: "Ahorros actuales", placeholder: "Ej: 15.000€" },
      { key: "deudas", label: "Deudas pendientes", placeholder: "Ej: Hipoteca 120.000€" },
      { key: "metaFinanciera", label: "Meta financiera", placeholder: "Independencia financiera..." },
    ],
  },
  {
    key: "careerData",
    label: "Carrera & Talento",
    emoji: "🚀",
    color: "#3b82f6",
    fields: [
      { key: "rolActual", label: "Rol actual", placeholder: "Gerente de Marketing" },
      { key: "empresa", label: "Empresa / Sector", placeholder: "Startup tecnológica" },
      { key: "habilidades", label: "Habilidades clave", placeholder: "Liderazgo, Python..." },
      { key: "metaCarrera", label: "Meta profesional", placeholder: "Ser CTO en 3 años" },
    ],
  },
  {
    key: "healthMetrics",
    label: "Salud & Vitalidad",
    emoji: "💪",
    color: "#f43f5e",
    fields: [
      { key: "peso", label: "Peso (kg)", type: "number", placeholder: "75" },
      { key: "altura", label: "Altura (cm)", type: "number", placeholder: "178" },
      { key: "condicionesMedicas", label: "Condiciones médicas", placeholder: "Ninguna / Diabetes..." },
      { key: "horasSueno", label: "Horas de sueño", placeholder: "7" },
      { key: "frecuenciaEjercicio", label: "Frecuencia de ejercicio", placeholder: "3 veces/semana" },
      { key: "metaSalud", label: "Meta de salud", placeholder: "Perder 10kg..." },
    ],
  },
  {
    key: "relationshipStatus",
    label: "Relaciones Íntimas",
    emoji: "❤️",
    color: "#ec4899",
    fields: [
      { key: "estadoPareja", label: "Estado de pareja", placeholder: "En pareja, Soltero/a..." },
      { key: "nombrePareja", label: "Nombre de pareja", placeholder: "Opcional" },
      { key: "desafiosPareja", label: "Desafíos en pareja", type: "textarea", placeholder: "Comunicación, tiempo..." },
    ],
  },
  {
    key: "familyCircle",
    label: "Círculo & Familia",
    emoji: "👨‍👩‍👧‍👦",
    color: "#f59e0b",
    fields: [
      { key: "estadoCivil", label: "Estado civil", placeholder: "Casado/a, Soltero/a..." },
      { key: "hijos", label: "Hijos", placeholder: "2 hijos (5 y 8 años)" },
      { key: "situacionFamiliar", label: "Situación familiar", type: "textarea", placeholder: "Padres mayores..." },
      { key: "amigosIntimos", label: "Amigos íntimos", placeholder: "3-4 amigos cercanos" },
    ],
  },
];

function SectionEditor({
  section,
  data,
  onSave,
}: {
  section: VaultSection;
  data: Record<string, string>;
  onSave: (key: string, data: Record<string, string>) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>(data);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(data);
  }, [data]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(section.key, form);
      setEditing(false);
      toast.success(`${section.label} actualizado`);
    } catch {
      toast.error("Error al guardar. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const hasData = Object.values(data).some((v) => v && v.trim());

  return (
    <div
      className="border border-border rounded-lg overflow-hidden bg-card"
    >
      {/* Header de sección */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ backgroundColor: `${section.color}10`, borderBottom: `1px solid ${section.color}20` }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">{section.emoji}</span>
          <h3 className="font-semibold text-sm text-foreground">{section.label}</h3>
          {hasData && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setEditing(!editing)}
          className="h-7 text-xs text-muted-foreground hover:text-foreground"
        >
          {editing ? (
            <>
              <X className="h-3.5 w-3.5 mr-1" />
              Cancelar
            </>
          ) : (
            <>
              <Edit3 className="h-3.5 w-3.5 mr-1" />
              Editar
            </>
          )}
        </Button>
      </div>

      {/* Contenido */}
      <div className="p-4">
        {editing ? (
          <div className="space-y-3">
            {section.fields.map((field) => (
              <div key={field.key} className="space-y-1">
                <Label className="text-xs text-muted-foreground">{field.label}</Label>
                {field.type === "textarea" ? (
                  <Textarea
                    value={form[field.key] ?? ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="bg-input border-border resize-none text-sm"
                    rows={2}
                  />
                ) : (
                  <Input
                    type={field.type ?? "text"}
                    value={form[field.key] ?? ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="bg-input border-border text-sm h-8"
                  />
                )}
              </div>
            ))}
            <Button
              onClick={handleSave}
              disabled={saving}
              size="sm"
              className="w-full bg-primary hover:bg-primary/90 mt-2"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <Save className="h-3.5 w-3.5 mr-1.5" />
              )}
              Guardar cambios
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {section.fields.map((field) => {
              const value = data[field.key];
              if (!value) return null;
              return (
                <div key={field.key} className={cn(field.type === "textarea" ? "col-span-2" : "")}>
                  <p className="text-xs text-muted-foreground">{field.label}</p>
                  <p className="text-sm text-foreground font-medium truncate">{value}</p>
                </div>
              );
            })}
            {!hasData && (
              <div className="col-span-2 text-center py-4">
                <p className="text-xs text-muted-foreground">Sin datos. Haz clic en Editar para completar.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function VaultPage() {
  const { data: vaultData, isLoading } = trpc.vault.get.useQuery();
  const updateVault = trpc.vault.update.useMutation({
    onSuccess: () => {
      utils.vault.get.invalidate();
    },
  });
  const utils = trpc.useUtils();

  const handleSave = async (sectionKey: string, data: Record<string, string>) => {
    await updateVault.mutateAsync({ [sectionKey]: data });
  };

  const getSectionData = (key: string): Record<string, string> => {
    if (!vaultData) return {};
    const raw = vaultData[key as keyof typeof vaultData];
    if (!raw || typeof raw !== "object") return {};
    return raw as Record<string, string>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const completedSections = VAULT_SECTIONS.filter((s) => {
    const data = getSectionData(s.key);
    return Object.values(data).some((v) => v && v.trim());
  }).length;

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground">Mi Perfil</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Tu información personal — el contexto que guía a tus asesores
        </p>
      </div>

      {/* Progreso global */}
      <div className="border border-border rounded-lg p-4 bg-muted">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">Perfil completado</span>
          <span className="text-sm text-foreground font-semibold">
            {completedSections}/{VAULT_SECTIONS.length} secciones
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-border overflow-hidden">
          <div
            className="h-full rounded-full bg-foreground/70 transition-all duration-500"
            style={{ width: `${(completedSections / VAULT_SECTIONS.length) * 100}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Cuanto más completo esté tu perfil, más personalizados serán los consejos de tus asesores.
        </p>
      </div>

      {/* Secciones */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {VAULT_SECTIONS.map((section) => (
          <SectionEditor
            key={section.key}
            section={section}
            data={getSectionData(section.key)}
            onSave={handleSave}
          />
        ))}
      </div>
    </div>
  );
}
