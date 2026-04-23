import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { TimezoneSelect } from "@/components/TimezoneSelect";
import { useLocalAuth } from "@/hooks/useLocalAuth";
import { getDetectedTimeZone } from "@/lib/dateTz";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  CheckCircle2,
  Edit3,
  Loader2,
  Save,
  X,
  Sparkles,
  Download,
  Upload,
  Bell,
  Send,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
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

function AccountTimezoneSection() {
  const { user, refresh } = useLocalAuth();
  const [tz, setTz] = useState(() => user?.timezone ?? getDetectedTimeZone());
  useEffect(() => {
    setTz(user?.timezone ?? getDetectedTimeZone());
  }, [user?.timezone]);
  const updateTz = trpc.auth.updateTimezone.useMutation({
    onSuccess: async () => {
      toast.success("Zona horaria guardada");
      await refresh();
    },
    onError: () => toast.error("No se pudo guardar la zona horaria"),
  });

  return (
    <div className="border border-border rounded-lg p-4 bg-card space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Zona horaria</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          El diario usa un día por fecha según esta zona (cuándo es “mañana” en tu calendario). Debe coincidir con tu reloj habitual.
        </p>
      </div>
      <TimezoneSelect value={tz} onChange={setTz} id="vault-tz" />
      <Button
        type="button"
        size="sm"
        onClick={() => updateTz.mutate({ timezone: tz })}
        disabled={updateTz.isPending}
        className="w-full sm:w-auto"
      >
        {updateTz.isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Guardando…
          </>
        ) : (
          "Guardar zona horaria"
        )}
      </Button>
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

      <AccountTimezoneSection />

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

      <NotificationsSection />
      <AppSection />
      <DataPortabilitySection />
    </div>
  );
}

function DataPortabilitySection() {
  const utils = trpc.useUtils();
  const exportQuery = trpc.userData.export.useQuery(undefined, { enabled: false });
  const importMut = trpc.userData.import.useMutation({
    onSuccess: () => {
      toast.success("Datos restaurados. Recarga la página para verlos.");
      utils.invalidate();
    },
    onError: (err) => toast.error(`Error al importar: ${err.message}`),
  });
  const [importing, setImporting] = useState(false);

  const handleExport = async () => {
    const res = await exportQuery.refetch();
    if (!res.data) {
      toast.error("No se pudo exportar");
      return;
    }
    const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const date = new Date().toISOString().slice(0, 10);
    a.download = `consejo-export-${date}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Exportado");
  };

  const handleImport = (file: File) => {
    const ok = confirm(
      "Esto reemplazará tu bóveda, notas, tareas, diario y memoria actuales con los datos del archivo. ¿Continuar?"
    );
    if (!ok) return;
    setImporting(true);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(String(reader.result));
        importMut.mutate({ payload, confirm: true });
      } catch {
        toast.error("Archivo inválido (no es JSON)");
      } finally {
        setImporting(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="border border-border rounded-lg p-4 bg-card space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Exportar / Importar datos</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Descarga una copia completa de tu bóveda, notas, tareas, diario y memoria, o restaura desde un archivo anterior.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={handleExport}
          disabled={exportQuery.isFetching}
          className="gap-2 text-xs"
        >
          {exportQuery.isFetching ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          Exportar a JSON
        </Button>
        <label
          className={cn(
            "inline-flex items-center gap-2 text-xs px-3 h-8 rounded-md border border-border cursor-pointer hover:bg-muted transition-colors",
            (importMut.isPending || importing) && "opacity-60 cursor-wait"
          )}
        >
          {importMut.isPending || importing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          Importar desde JSON
          <input
            type="file"
            accept="application/json"
            className="hidden"
            disabled={importMut.isPending || importing}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImport(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>
    </div>
  );
}

function NotificationsSection() {
  const { data, isLoading } = trpc.notifications.getSettings.useQuery();
  const utils = trpc.useUtils();
  const update = trpc.notifications.updateSettings.useMutation({
    onSuccess: () => {
      utils.notifications.getSettings.invalidate();
    },
    onError: (err) => toast.error(`No se pudo guardar: ${err.message}`),
  });
  const sendTest = trpc.notifications.sendTest.useMutation({
    onSuccess: () => toast.success("Prueba enviada a Telegram"),
    onError: (err) => toast.error(err.message),
  });

  type EmailFreq = "instant" | "hourly" | "daily" | "off";
  type TaskFreq = "hourly" | "every4h" | "every8h" | "daily" | "off";

  const [chatId, setChatId] = useState("");
  const [emailFreq, setEmailFreq] = useState<EmailFreq>("instant");
  const [taskFreq, setTaskFreq] = useState<TaskFreq>("daily");
  const [dailyTime, setDailyTime] = useState("09:00");
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (!data) return;
    setChatId(data.telegramChatId ?? "");
    setEmailFreq(data.emailFrequency as EmailFreq);
    // Backwards-compat: valores antiguos ("instant") se mapean a "daily".
    const tf = data.taskFrequency as string;
    const validTaskFreqs: TaskFreq[] = ["hourly", "every4h", "every8h", "daily", "off"];
    setTaskFreq((validTaskFreqs as string[]).includes(tf) ? (tf as TaskFreq) : "daily");
    setDailyTime(data.dailyDigestTime ?? "09:00");
    setEnabled(Boolean(data.enabled));
  }, [data]);

  const handleSave = () => {
    update.mutate({
      telegramChatId: chatId.trim() || null,
      enabled,
      emailFrequency: emailFreq,
      taskFrequency: taskFreq,
      dailyDigestTime: dailyTime,
    });
  };

  if (isLoading) {
    return (
      <div className="border border-border rounded-lg p-4 bg-card">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg p-4 bg-card space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Bell className="h-4 w-4" /> Notificaciones (Telegram)
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Recibe avisos en Telegram cuando llegue un correo importante o haya tareas pendientes.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Label htmlFor="notif-enabled" className="text-xs text-muted-foreground">
            Activas
          </Label>
          <Switch id="notif-enabled" checked={enabled} onCheckedChange={setEnabled} />
        </div>
      </div>

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer hover:text-foreground">Solo quien instala o aloja la app (una vez)</summary>
        <p className="mt-2 leading-relaxed">
          El <strong>token del bot</strong> va en el servidor (<code>TELEGRAM_BOT_TOKEN</code> en <code>.env</code>), no aquí. Eso lo hace quien despliega Consejo Sinérgico: crea el bot con <strong>@BotFather</strong> (<code>/newbot</code>), guarda el token, reinicia el servidor y comunica a los usuarios el <strong>nombre del bot</strong> en Telegram (p. ej. <code>@TuBotOficial</code>).
        </p>
      </details>

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer hover:text-foreground">Cómo conectar tu Telegram (cada usuario)</summary>
        <ol className="list-decimal ml-5 mt-2 space-y-1.5 leading-relaxed">
          <li>
            En Telegram, abre el <strong>bot de esta aplicación</strong> (te lo tiene que decir quien te dio acceso o quien administra el servidor).
          </li>
          <li>
            Pulsa <strong>Iniciar</strong> o envía <code>/start</code> al bot. Así Telegram sabe que quieres recibir mensajes de él.
          </li>
          <li>
            Copia tu <strong>ID numérico</strong>: la forma más sencilla es escribir a un bot público como <strong>@userinfobot</strong> y copiar el número que te muestra (en un chat privado contigo suele ser el mismo valor que hace falta como chat_id aquí).
          </li>
          <li>
            Pégalo en <strong>Chat ID</strong> abajo, guarda, y prueba con <strong>Enviar prueba</strong>.
          </li>
        </ol>
        <p className="mt-2 text-[11px] opacity-90">
          La URL <code>api.telegram.org/.../getUpdates</code> solo la usa quien tiene el token del bot (normalmente el administrador), no hace falta que cada usuario la abra.
        </p>
      </details>

      <div className="space-y-1.5">
        <Label htmlFor="chat-id" className="text-xs text-muted-foreground">
          Chat ID de Telegram
        </Label>
        <div className="flex gap-2">
          <Input
            id="chat-id"
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            placeholder="123456789"
            className="bg-input border-border text-sm h-8 flex-1"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => sendTest.mutate()}
            disabled={sendTest.isPending || !data?.telegramChatId}
            className="gap-1.5 text-xs"
          >
            {sendTest.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Enviar prueba
          </Button>
        </div>
        {!data?.telegramChatId && (
          <p className="text-[11px] text-muted-foreground">Guarda el chat_id antes de poder enviar la prueba.</p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Correos importantes</Label>
          <Select value={emailFreq} onValueChange={(v) => setEmailFreq(v as EmailFreq)}>
            <SelectTrigger className="w-full h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="instant">Al momento</SelectItem>
              <SelectItem value="hourly">Resumen cada hora</SelectItem>
              <SelectItem value="daily">Resumen diario</SelectItem>
              <SelectItem value="off">No notificar</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Recordatorios de tareas pendientes</Label>
          <Select value={taskFreq} onValueChange={(v) => setTaskFreq(v as TaskFreq)}>
            <SelectTrigger className="w-full h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hourly">Cada hora</SelectItem>
              <SelectItem value="every4h">Cada 4 horas</SelectItem>
              <SelectItem value="every8h">Cada 8 horas</SelectItem>
              <SelectItem value="daily">Una vez al día</SelectItem>
              <SelectItem value="off">No notificar</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {(emailFreq === "daily" || taskFreq === "daily") && (
        <div className="space-y-1.5">
          <Label htmlFor="digest-time" className="text-xs text-muted-foreground">
            Hora del resumen diario (tu zona horaria)
          </Label>
          <Input
            id="digest-time"
            type="time"
            value={dailyTime}
            onChange={(e) => setDailyTime(e.target.value)}
            className="bg-input border-border text-sm h-8 w-32"
          />
        </div>
      )}

      <Button
        size="sm"
        onClick={handleSave}
        disabled={update.isPending}
        className="gap-1.5"
      >
        {update.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        Guardar
      </Button>
    </div>
  );
}

function AppSection() {
  const { canInstall, isInstalled, install } = useInstallPrompt();
  const generateIcon = trpc.system.generateAppIcon.useMutation({
    onSuccess: (data) => {
      toast.success(`Icono generado con ${data.source}. Recarga la página para verlo.`);
    },
    onError: (err) => {
      toast.error(`No se pudo generar el icono: ${err.message}`);
    },
  });

  return (
    <div className="border border-border rounded-lg p-4 bg-card space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">App instalable</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Añade Consejo Sinérgico a tu pantalla de inicio para acceder sin abrir el navegador.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        {isInstalled ? (
          <p className="text-xs text-[#5C8A6D] flex items-center gap-1.5">
            <Download className="h-3.5 w-3.5" /> App ya instalada
          </p>
        ) : canInstall ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => void install()}
            className="gap-2 text-xs"
          >
            <Download className="h-3.5 w-3.5" />
            Instalar app
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">
            En iOS: toca <strong>Compartir → Añadir a pantalla de inicio</strong>. En Android/Chrome el botón "Instalar" aparecerá en el menú lateral cuando el navegador lo ofrezca.
          </p>
        )}

        <Button
          size="sm"
          variant="outline"
          onClick={() => generateIcon.mutate()}
          disabled={generateIcon.isPending}
          className="gap-2 text-xs"
        >
          {generateIcon.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          Generar icono con IA
        </Button>
      </div>
    </div>
  );
}
