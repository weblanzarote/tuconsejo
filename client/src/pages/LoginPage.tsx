import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocalAuth } from "@/hooks/useLocalAuth";
import { Eye, EyeOff, Loader2, Lock, User } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, register } = useLocalAuth();
  const [, navigate] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        const result = await login(username, password);
        if (!result.success) {
          toast.error(result.error ?? "Error al iniciar sesión");
          return;
        }
        navigate("/hoy");
      } else {
        const result = await register(username, password, name || username, email || undefined);
        if (!result.success) {
          toast.error(result.error ?? "Error al registrarse");
          return;
        }
        navigate("/onboarding");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-10 h-10 rounded-lg bg-border flex items-center justify-center mx-auto mb-4">
            <span className="text-lg leading-none">✦</span>
          </div>
          <h1 className="text-xl font-semibold text-foreground">
            Diario Personal
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tu espacio para reflexionar y crecer
          </p>
        </div>

        {/* Card */}
        <div className="rounded-xl p-6 border border-border bg-card">
          {/* Tabs */}
          <div className="flex rounded-xl bg-muted/50 p-1 mb-6">
            <button
              onClick={() => setMode("login")}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                mode === "login"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Iniciar sesión
            </button>
            <button
              onClick={() => setMode("register")}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                mode === "register"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Crear cuenta
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">Nombre completo</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre"
                  className="bg-input border-border"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">Usuario</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="nombre_usuario"
                  required
                  className="bg-input border-border pl-9"
                  autoComplete="username"
                />
              </div>
            </div>

            {mode === "register" && (
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">Email (opcional)</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="bg-input border-border"
                  autoComplete="email"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "register" ? "Mínimo 6 caracteres" : "Tu contraseña"}
                  required
                  className="bg-input border-border pl-9 pr-10"
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full bg-primary hover:bg-primary/90 mt-2"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {mode === "login" ? "Entrar al Consejo" : "Crear mi Consejo"}
            </Button>
          </form>

          {mode === "login" && (
            <p className="text-center text-xs text-muted-foreground mt-4">
              ¿Primera vez?{" "}
              <button
                onClick={() => setMode("register")}
                className="text-primary hover:underline"
              >
                Crea tu cuenta gratis
              </button>
            </p>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Aplicación local — tus datos se guardan en tu equipo
        </p>
      </div>
    </div>
  );
}
