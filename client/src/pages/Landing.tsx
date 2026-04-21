import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { ArrowRight, Brain, Shield, Sparkles, Users, Zap } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";

const AGENTS = [
  { emoji: "💰", nombre: "Alejandro", dominio: "Economía & Riqueza", color: "#10b981" },
  { emoji: "🚀", nombre: "Valentina", dominio: "Carrera & Talento", color: "#3b82f6" },
  { emoji: "💪", nombre: "Dr. Marcos", dominio: "Salud & Vitalidad", color: "#f43f5e" },
  { emoji: "❤️", nombre: "Sofía", dominio: "Relaciones Íntimas", color: "#ec4899" },
  { emoji: "👨‍👩‍👧‍👦", nombre: "Elena", dominio: "Círculo & Familia", color: "#f59e0b" },
  { emoji: "🔮", nombre: "El Guardián", dominio: "Valores & Propósito", color: "#8b5cf6" },
];

const FEATURES = [
  {
    icon: Brain,
    titulo: "Memoria Contextual",
    desc: "Cada asesor recuerda tus conversaciones y evoluciona contigo.",
  },
  {
    icon: Users,
    titulo: "Conciencia Cruzada",
    desc: "Los asesores leen los planes de sus colegas para identificar conflictos.",
  },
  {
    icon: Shield,
    titulo: "Sala de Juntas",
    desc: "Todos los asesores debaten juntos tus decisiones más complejas.",
  },
  {
    icon: Zap,
    titulo: "Plan de Acción",
    desc: "Convierte cualquier consejo en una tarea comprometida con un clic.",
  },
];

export default function Landing() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && user) {
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-council-gradient text-foreground overflow-x-hidden">
      {/* ── Header ── */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 glass border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <span className="text-lg">🔮</span>
          </div>
          <span className="font-display font-semibold text-lg">Consejo Sinérgico</span>
        </div>
        <Button
          onClick={() => (window.location.href = getLoginUrl())}
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          Iniciar sesión
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </header>

      {/* ── Hero ── */}
      <section className="pt-32 pb-20 px-6 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 text-sm text-primary mb-8">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Powered by IA avanzada</span>
        </div>

        <h1 className="font-display text-5xl md:text-7xl font-bold text-foreground mb-6 leading-tight">
          Tu Consejo Personal
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-[#06b6d4]">
            de Asesores IA
          </span>
        </h1>

        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          Seis expertos especializados trabajando en sinergia para ayudarte a tomar
          mejores decisiones en todas las áreas de tu vida. Economía, Carrera, Salud,
          Relaciones, Familia y Valores.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            size="lg"
            onClick={() => (window.location.href = getLoginUrl())}
            className="bg-primary hover:bg-primary/90 text-primary-foreground text-base px-8 py-6"
          >
            Conoce a tu Consejo
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => (window.location.href = getLoginUrl())}
            className="border-border text-foreground hover:bg-secondary text-base px-8 py-6"
          >
            Iniciar sesión
          </Button>
        </div>
      </section>

      {/* ── Los 6 Asesores ── */}
      <section className="py-20 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
            Tu Equipo de Élite
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Cada asesor es un experto profundo en su dominio, con personalidad única
            y acceso completo a tu perfil de vida.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {AGENTS.map((agent) => (
            <div
              key={agent.nombre}
              className="glass rounded-xl p-5 hover:scale-105 transition-transform duration-200 cursor-default group"
              style={{ borderColor: `${agent.color}30` }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-3"
                style={{ backgroundColor: `${agent.color}20` }}
              >
                {agent.emoji}
              </div>
              <h3 className="font-semibold text-foreground text-sm mb-0.5">{agent.nombre}</h3>
              <p className="text-xs text-muted-foreground">{agent.dominio}</p>
              <div
                className="mt-3 h-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ backgroundColor: agent.color }}
              />
            </div>
          ))}
        </div>
      </section>

      {/* ── Características ── */}
      <section className="py-20 px-6 max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
            Tecnología al Servicio de tu Vida
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {FEATURES.map((feat) => {
            const Icon = feat.icon;
            return (
              <div key={feat.titulo} className="glass rounded-xl p-6 flex gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">{feat.titulo}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feat.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── CTA Final ── */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-2xl mx-auto glass rounded-2xl p-12 border border-primary/20">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
            ¿Listo para tu Consejo?
          </h2>
          <p className="text-muted-foreground mb-8">
            Comienza con el onboarding de 5 minutos y activa a tus 6 asesores personales.
          </p>
          <Button
            size="lg"
            onClick={() => (window.location.href = getLoginUrl())}
            className="bg-primary hover:bg-primary/90 text-primary-foreground text-base px-10 py-6"
          >
            Comenzar ahora — Es gratis
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-8 px-6 text-center border-t border-border">
        <p className="text-sm text-muted-foreground">
          © 2025 Consejo Sinérgico · Tu equipo de asesores IA personales
        </p>
      </footer>
    </div>
  );
}
