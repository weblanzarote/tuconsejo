import { useLocalAuth } from "@/hooks/useLocalAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const STEPS = [
  { id: 1, titulo: "Información Personal", emoji: "👤" },
  { id: 2, titulo: "Economía & Carrera", emoji: "💼" },
  { id: 3, titulo: "Salud & Bienestar", emoji: "💪" },
  { id: 4, titulo: "Relaciones & Familia", emoji: "❤️" },
  { id: 5, titulo: "Valores & Guardián", emoji: "🔮" },
];

interface FormData {
  // Personal
  nombre: string;
  edad: string;
  ubicacion: string;
  educacion: string;
  idiomas: string;
  // Economía
  ingresos: string;
  ahorros: string;
  deudas: string;
  metaFinanciera: string;
  // Carrera
  rolActual: string;
  empresa: string;
  habilidades: string;
  metaCarrera: string;
  // Salud
  peso: string;
  altura: string;
  condicionesMedicas: string;
  horasSueno: string;
  frecuenciaEjercicio: string;
  metaSalud: string;
  // Relaciones
  estadoPareja: string;
  nombrePareja: string;
  desafiosPareja: string;
  // Familia
  estadoCivil: string;
  hijos: string;
  situacionFamiliar: string;
  amigosIntimos: string;
  // Guardián
  guardianEnabled: boolean;
  /** Una de las etiquetas predefinidas u "Otro" */
  marcoFilosofico: string;
  /** Texto libre solo cuando marcoFilosofico === "Otro" */
  marcoFilosoficoOtro: string;
  valoresCentro: string;
}

const INITIAL_FORM: FormData = {
  nombre: "", edad: "", ubicacion: "", educacion: "", idiomas: "",
  ingresos: "", ahorros: "", deudas: "", metaFinanciera: "",
  rolActual: "", empresa: "", habilidades: "", metaCarrera: "",
  peso: "", altura: "", condicionesMedicas: "", horasSueno: "", frecuenciaEjercicio: "", metaSalud: "",
  estadoPareja: "", nombrePareja: "", desafiosPareja: "",
  estadoCivil: "", hijos: "", situacionFamiliar: "", amigosIntimos: "",
  guardianEnabled: false, marcoFilosofico: "", marcoFilosoficoOtro: "", valoresCentro: "",
};

/** Etiqueta corta → descripción para la pantalla de onboarding (sin dogmatismo: orientación de lenguaje) */
const MARCO_FILOSOFICO_DESCS: Record<string, string> = {
  Estoico:
    "Énfasis en lo que controlas, aceptación de lo externo, virtud y serenidad ante la adversidad (p. ej. Marco Aurelio, Epicteto).",
  Cristiano:
    "Perspectiva centrada en fe, caridad, perdón y sentido según la tradición cristiana; el tono será respetuoso y pastoral, no predicador.",
  "Humanista Secular":
    "Ética sin apelar a lo sobrenatural: dignidad humana, razón, empatía y responsabilidad en esta vida (p. ej. tradición tipo Paul Kurtz / humanismo del siglo XXI).",
  Budista:
    "Lente de sufrimiento, impermanencia, compasión y práctica consciente; sin imponer rituales: vocabulario y preguntas alineadas con esa sensibilidad.",
  Islámico:
    "Referencias éticas y espirituales dentro del respeto a la tradición islámica; tono prudente y no sectario.",
  Otro: "Escribe abajo cómo nombras tu propia brújula (filosofía, escuela, mestizaje, etc.).",
};

function marcoGuardianLabel(form: FormData): string {
  if (form.marcoFilosofico === "Otro") return form.marcoFilosoficoOtro.trim();
  return form.marcoFilosofico.trim();
}

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((step, idx) => (
        <div key={step.id} className="flex items-center gap-2">
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all",
            currentStep === step.id
              ? "bg-primary text-primary-foreground scale-110"
              : currentStep > step.id
              ? "bg-primary/30 text-primary"
              : "bg-muted text-muted-foreground"
          )}>
            {currentStep > step.id ? <CheckCircle2 className="h-4 w-4" /> : step.id}
          </div>
          {idx < STEPS.length - 1 && (
            <div className={cn(
              "h-0.5 w-8 md:w-12 rounded-full transition-all",
              currentStep > step.id ? "bg-primary/50" : "bg-muted"
            )} />
          )}
        </div>
      ))}
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

export default function Onboarding() {
  const { user, loading } = useLocalAuth();
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);

  const completeOnboarding = trpc.vault.completeOnboarding.useMutation();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  const update = (field: keyof FormData, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    if (step === 1 && !form.nombre.trim()) {
      toast.error("Escribe al menos cómo te llamas para continuar.");
      return;
    }
    if (step < STEPS.length) setStep((s) => s + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep((s) => s - 1);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await completeOnboarding.mutateAsync({
        personalInfo: {
          nombre: form.nombre,
          edad: form.edad,
          ubicacion: form.ubicacion,
          educacion: form.educacion,
          idiomas: form.idiomas,
        },
        financialStatus: {
          ingresos: form.ingresos,
          ahorros: form.ahorros,
          deudas: form.deudas,
          metaFinanciera: form.metaFinanciera,
        },
        careerData: {
          rolActual: form.rolActual,
          empresa: form.empresa,
          habilidades: form.habilidades,
          metaCarrera: form.metaCarrera,
        },
        healthMetrics: {
          peso: form.peso,
          altura: form.altura,
          condicionesMedicas: form.condicionesMedicas,
          horasSueno: form.horasSueno,
          frecuenciaEjercicio: form.frecuenciaEjercicio,
          metaSalud: form.metaSalud,
        },
        relationshipStatus: {
          estadoPareja: form.estadoPareja,
          nombrePareja: form.nombrePareja,
          desafiosPareja: form.desafiosPareja,
        },
        familyCircle: {
          estadoCivil: form.estadoCivil,
          hijos: form.hijos,
          situacionFamiliar: form.situacionFamiliar,
          amigosIntimos: form.amigosIntimos,
        },
        valuesFramework: form.guardianEnabled
          ? {
              marcoFilosofico: marcoGuardianLabel(form) || form.marcoFilosofico,
              valoresCentro: form.valoresCentro,
            }
          : undefined,
        guardianEnabled: form.guardianEnabled,
        guardianFramework: form.guardianEnabled
          ? marcoGuardianLabel(form) || undefined
          : undefined,
      });
      toast.success("¡Tu Consejo está listo!");
      navigate("/hoy");
    } catch {
      toast.error("Error al guardar tu perfil. Inténtalo de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentStep = STEPS[step - 1];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <span className="text-lg leading-none">✦</span>
            <h1 className="text-xl font-semibold text-foreground">Tu Perfil Personal</h1>
          </div>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Solo necesitas un nombre para empezar. El resto es opcional: puedes saltar bloques o completar más tarde en{" "}
            <strong className="text-foreground/90">Mi Perfil</strong> o con <strong className="text-foreground/90">Lucía</strong> (chat Encuestadora).
            Cuanto más compartas cuando te apetezca, mejor te orientará el Consejo.
          </p>
        </div>

        <StepIndicator currentStep={step} />

        {/* Card del paso */}
        <div className="border border-border rounded-xl p-6 md:p-8 bg-card">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-2xl">{currentStep?.emoji}</span>
            <h2 className="text-lg font-semibold text-foreground">{currentStep?.titulo}</h2>
          </div>

          {/* Paso 1: Personal */}
          {step === 1 && (
            <div className="space-y-4 animate-fade-in-up">
              <FieldGroup label="¿Cómo te llamas?">
                <Input
                  value={form.nombre}
                  onChange={(e) => update("nombre", e.target.value)}
                  placeholder="Tu nombre completo"
                  className="bg-input border-border"
                />
              </FieldGroup>
              <div className="grid grid-cols-2 gap-4">
                <FieldGroup label="Edad">
                  <Input
                    value={form.edad}
                    onChange={(e) => update("edad", e.target.value)}
                    placeholder="Ej: 32"
                    type="number"
                    className="bg-input border-border"
                  />
                </FieldGroup>
                <FieldGroup label="Ubicación">
                  <Input
                    value={form.ubicacion}
                    onChange={(e) => update("ubicacion", e.target.value)}
                    placeholder="Ciudad, País"
                    className="bg-input border-border"
                  />
                </FieldGroup>
              </div>
              <FieldGroup label="Nivel educativo">
                <Input
                  value={form.educacion}
                  onChange={(e) => update("educacion", e.target.value)}
                  placeholder="Ej: Máster en Administración de Empresas"
                  className="bg-input border-border"
                />
              </FieldGroup>
              <FieldGroup label="Idiomas que hablas">
                <Input
                  value={form.idiomas}
                  onChange={(e) => update("idiomas", e.target.value)}
                  placeholder="Ej: Español, Inglés, Francés"
                  className="bg-input border-border"
                />
              </FieldGroup>
            </div>
          )}

          {/* Paso 2: Economía & Carrera */}
          {step === 2 && (
            <div className="space-y-4 animate-fade-in-up">
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                Todo este bloque es opcional. Esta información es confidencial y solo la usan tus asesores para personalizarte consejos.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <FieldGroup label="Ingresos mensuales aprox.">
                  <Input
                    value={form.ingresos}
                    onChange={(e) => update("ingresos", e.target.value)}
                    placeholder="Ej: 3.500€"
                    className="bg-input border-border"
                  />
                </FieldGroup>
                <FieldGroup label="Ahorros actuales">
                  <Input
                    value={form.ahorros}
                    onChange={(e) => update("ahorros", e.target.value)}
                    placeholder="Ej: 15.000€"
                    className="bg-input border-border"
                  />
                </FieldGroup>
              </div>
              <FieldGroup label="Deudas pendientes">
                <Input
                  value={form.deudas}
                  onChange={(e) => update("deudas", e.target.value)}
                  placeholder="Ej: Hipoteca 120.000€, tarjeta 2.000€"
                  className="bg-input border-border"
                />
              </FieldGroup>
              <FieldGroup label="Meta financiera principal">
                <Input
                  value={form.metaFinanciera}
                  onChange={(e) => update("metaFinanciera", e.target.value)}
                  placeholder="Ej: Independencia financiera a los 45"
                  className="bg-input border-border"
                />
              </FieldGroup>
              <div className="gradient-line my-2" />
              <FieldGroup label="Rol o cargo actual">
                <Input
                  value={form.rolActual}
                  onChange={(e) => update("rolActual", e.target.value)}
                  placeholder="Ej: Gerente de Marketing"
                  className="bg-input border-border"
                />
              </FieldGroup>
              <FieldGroup label="Empresa / Sector">
                <Input
                  value={form.empresa}
                  onChange={(e) => update("empresa", e.target.value)}
                  placeholder="Ej: Startup tecnológica"
                  className="bg-input border-border"
                />
              </FieldGroup>
              <FieldGroup label="Habilidades clave">
                <Input
                  value={form.habilidades}
                  onChange={(e) => update("habilidades", e.target.value)}
                  placeholder="Ej: Liderazgo, Python, Negociación"
                  className="bg-input border-border"
                />
              </FieldGroup>
              <FieldGroup label="Meta profesional">
                <Input
                  value={form.metaCarrera}
                  onChange={(e) => update("metaCarrera", e.target.value)}
                  placeholder="Ej: Ser CTO en 3 años"
                  className="bg-input border-border"
                />
              </FieldGroup>
            </div>
          )}

          {/* Paso 3: Salud */}
          {step === 3 && (
            <div className="space-y-4 animate-fade-in-up">
              <div className="grid grid-cols-2 gap-4">
                <FieldGroup label="Peso (kg)">
                  <Input
                    value={form.peso}
                    onChange={(e) => update("peso", e.target.value)}
                    placeholder="Ej: 75"
                    className="bg-input border-border"
                  />
                </FieldGroup>
                <FieldGroup label="Altura (cm)">
                  <Input
                    value={form.altura}
                    onChange={(e) => update("altura", e.target.value)}
                    placeholder="Ej: 178"
                    className="bg-input border-border"
                  />
                </FieldGroup>
              </div>
              <FieldGroup label="Condiciones médicas relevantes">
                <Input
                  value={form.condicionesMedicas}
                  onChange={(e) => update("condicionesMedicas", e.target.value)}
                  placeholder="Ej: Ninguna / Diabetes tipo 2 / Ansiedad"
                  className="bg-input border-border"
                />
              </FieldGroup>
              <div className="grid grid-cols-2 gap-4">
                <FieldGroup label="Horas de sueño por noche">
                  <Input
                    value={form.horasSueno}
                    onChange={(e) => update("horasSueno", e.target.value)}
                    placeholder="Ej: 7"
                    className="bg-input border-border"
                  />
                </FieldGroup>
                <FieldGroup label="Frecuencia de ejercicio">
                  <Input
                    value={form.frecuenciaEjercicio}
                    onChange={(e) => update("frecuenciaEjercicio", e.target.value)}
                    placeholder="Ej: 3 veces/semana"
                    className="bg-input border-border"
                  />
                </FieldGroup>
              </div>
              <FieldGroup label="Meta de salud principal">
                <Input
                  value={form.metaSalud}
                  onChange={(e) => update("metaSalud", e.target.value)}
                  placeholder="Ej: Perder 10kg, mejorar energía diaria"
                  className="bg-input border-border"
                />
              </FieldGroup>
            </div>
          )}

          {/* Paso 4: Relaciones & Familia */}
          {step === 4 && (
            <div className="space-y-4 animate-fade-in-up">
              <FieldGroup label="Estado de pareja">
                <Input
                  value={form.estadoPareja}
                  onChange={(e) => update("estadoPareja", e.target.value)}
                  placeholder="Ej: En pareja, Soltero/a, Casado/a"
                  className="bg-input border-border"
                />
              </FieldGroup>
              <FieldGroup label="Nombre de tu pareja (opcional)">
                <Input
                  value={form.nombrePareja}
                  onChange={(e) => update("nombrePareja", e.target.value)}
                  placeholder="Ej: María"
                  className="bg-input border-border"
                />
              </FieldGroup>
              <FieldGroup label="Desafíos en tu relación de pareja">
                <Textarea
                  value={form.desafiosPareja}
                  onChange={(e) => update("desafiosPareja", e.target.value)}
                  placeholder="Ej: Comunicación, tiempo de calidad, proyectos de vida distintos..."
                  className="bg-input border-border resize-none"
                  rows={2}
                />
              </FieldGroup>
              <div className="gradient-line my-2" />
              <div className="grid grid-cols-2 gap-4">
                <FieldGroup label="Estado civil">
                  <Input
                    value={form.estadoCivil}
                    onChange={(e) => update("estadoCivil", e.target.value)}
                    placeholder="Ej: Casado/a, Soltero/a"
                    className="bg-input border-border"
                  />
                </FieldGroup>
                <FieldGroup label="Hijos">
                  <Input
                    value={form.hijos}
                    onChange={(e) => update("hijos", e.target.value)}
                    placeholder="Ej: 2 hijos (5 y 8 años)"
                    className="bg-input border-border"
                  />
                </FieldGroup>
              </div>
              <FieldGroup label="Situación familiar actual">
                <Textarea
                  value={form.situacionFamiliar}
                  onChange={(e) => update("situacionFamiliar", e.target.value)}
                  placeholder="Ej: Padres mayores que necesitan apoyo, hermano con quien tengo conflictos..."
                  className="bg-input border-border resize-none"
                  rows={2}
                />
              </FieldGroup>
              <FieldGroup label="Amigos íntimos / círculo de confianza">
                <Input
                  value={form.amigosIntimos}
                  onChange={(e) => update("amigosIntimos", e.target.value)}
                  placeholder="Ej: 3-4 amigos cercanos, grupo de trabajo"
                  className="bg-input border-border"
                />
              </FieldGroup>
            </div>
          )}

          {/* Paso 5: Guardián de Valores */}
          {step === 5 && (
            <div className="space-y-6 animate-fade-in-up">
              <div className="bg-muted border border-border rounded-xl p-4 space-y-3">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  El <strong className="text-foreground">Guardián de Valores</strong> es tu sexto asesor opcional:
                  un interlocutor que hace preguntas incómodas en el buen sentido —para comprobar si lo que planeas encaja con lo que dices que te importa.
                </p>
                <ul className="text-xs text-muted-foreground space-y-2 list-disc pl-4 leading-relaxed">
                  <li>
                    <strong className="text-foreground/90">Activar aquí</strong> guarda en tu perfil (La Bóveda) el marco y los valores que elijas abajo, para que{" "}
                    <strong className="text-foreground/90">El Guardián</strong> y el resto del Consejo los tengan en cuenta al orientarte.
                  </li>
                  <li>
                    <strong className="text-foreground/90">No activar</strong> no borra el chat: podrás hablar con El Guardián cuando quieras; solo que{" "}
                    <strong className="text-foreground/90">no se guardan</strong> en este paso tu marco ni tu lista de valores (podrás completarlos después en Mi Perfil o con Lucía).
                  </li>
                </ul>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">
                  ¿Deseas activar al Guardián de Valores?
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => update("guardianEnabled", true)}
                    className={cn(
                      "flex-1 py-3 rounded-xl border text-sm font-medium transition-all",
                      form.guardianEnabled
                        ? "bg-accent border-foreground/30 text-foreground font-semibold"
                        : "border-border text-muted-foreground hover:border-foreground/20"
                    )}
                  >
                    🔮 Sí, activar
                  </button>
                  <button
                    type="button"
                    onClick={() => update("guardianEnabled", false)}
                    className={cn(
                      "flex-1 py-3 rounded-xl border text-sm font-medium transition-all",
                      !form.guardianEnabled
                        ? "bg-muted border-border text-foreground"
                        : "border-border text-muted-foreground hover:border-border"
                    )}
                  >
                    No por ahora
                  </button>
                </div>
              </div>

              {form.guardianEnabled && (
                <div className="space-y-4 animate-fade-in-up">
                  <FieldGroup label="Marco filosófico / espiritual">
                    <p className="text-xs text-muted-foreground -mt-1 mb-2 leading-relaxed">
                      Es la <strong className="text-foreground/80">lente</strong> o tradición con la que quieres que El Guardián hable (vocabulario y ejemplos),{" "}
                      <strong className="text-foreground/80">no un examen de ortodoxia</strong>. La caja de &quot;valores&quot; de abajo es tu lista personal; si algo chocara,{" "}
                      <strong className="text-foreground/80">prevalece lo que tú escribes</strong> como prioridad explícita.
                    </p>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      {["Estoico", "Cristiano", "Humanista Secular", "Budista", "Islámico", "Otro"].map((marco) => (
                        <button
                          type="button"
                          key={marco}
                          onClick={() => update("marcoFilosofico", marco)}
                          className={cn(
                            "py-2 px-3 rounded-lg border text-xs font-medium transition-all text-left",
                            form.marcoFilosofico === marco
                              ? "bg-primary/20 border-primary/50 text-primary"
                              : "border-border text-muted-foreground hover:border-border/80"
                          )}
                        >
                          {marco}
                        </button>
                      ))}
                    </div>
                    {form.marcoFilosofico && MARCO_FILOSOFICO_DESCS[form.marcoFilosofico] && (
                      <p className="text-xs text-muted-foreground border border-border/60 rounded-lg p-3 bg-background/50 leading-relaxed mb-2">
                        <span className="font-medium text-foreground/90">{form.marcoFilosofico}:</span>{" "}
                        {MARCO_FILOSOFICO_DESCS[form.marcoFilosofico]}
                      </p>
                    )}
                    {form.marcoFilosofico === "Otro" && (
                      <Input
                        placeholder="Especifica tu marco (ej. feminismo, perreo y estudio, tu mezcla personal…)"
                        className="bg-input border-border"
                        value={form.marcoFilosoficoOtro}
                        onChange={(e) => update("marcoFilosoficoOtro", e.target.value)}
                      />
                    )}
                  </FieldGroup>

                  <FieldGroup label="Tus valores más importantes">
                    <p className="text-xs text-muted-foreground -mt-1 mb-2 leading-relaxed">
                      Aquí va <strong className="text-foreground/80">tu lista corta</strong> de lo que no negocias (familia, honestidad, salud mental…). El marco de arriba ayuda al tono; esto es lo que el sistema trata como tu brújula explícita.
                    </p>
                    <Textarea
                      value={form.valoresCentro}
                      onChange={(e) => update("valoresCentro", e.target.value)}
                      placeholder="Ej: Honestidad, familia, crecimiento personal, servicio a los demás..."
                      className="bg-input border-border resize-none"
                      rows={3}
                    />
                  </FieldGroup>
                </div>
              )}
            </div>
          )}

          {/* Navegación */}
          <div className="mt-8 pt-6 border-t border-border space-y-3">
            {step >= 2 && step < STEPS.length && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleNext}
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 cursor-pointer"
                >
                  Saltar este bloque por ahora →
                </button>
              </div>
            )}
            <div className="flex flex-wrap justify-between gap-3 items-center">
              <Button
                variant="ghost"
                onClick={handleBack}
                disabled={step === 1}
                className="text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Anterior
              </Button>

              {step < STEPS.length ? (
                <Button onClick={handleNext} className="bg-primary hover:bg-primary/90">
                  Siguiente
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="border-border"
                  >
                    Entrar ya; completaré el perfil después
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="bg-primary hover:bg-primary/90"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Activando tu Consejo...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Activar mi Consejo
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Paso {step} de {STEPS.length} · Puedes editar esta información en Mi Perfil
        </p>
      </div>
    </div>
  );
}
