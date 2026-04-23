import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useLocalAuth } from "./hooks/useLocalAuth";
import { Loader2 } from "lucide-react";
// Páginas
import LoginPage from "./pages/LoginPage";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Chat from "./pages/Chat";
import Boardroom from "./pages/Boardroom";
import VaultPage from "./pages/VaultPage";
import TodayPage from "./pages/TodayPage";
import DiaryHistoryPage from "./pages/DiaryHistoryPage";
import AsesoresPage from "./pages/AsesoresPage";
import CorreosPage from "./pages/CorreosPage";
import ApuntesPage from "./pages/ApuntesPage";
import FinancePage from "./pages/FinancePage";
// Layout
import MinimalLayout from "./components/MinimalLayout";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, loading } = useLocalAuth();
  const [, navigate] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    navigate("/login");
    return null;
  }

  return (
    <MinimalLayout>
      <Component />
    </MinimalLayout>
  );
}

function Router() {
  const { user, loading } = useLocalAuth();
  const [, navigate] = useLocation();

  function HomeRedirect() {
    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }
    if (!user) {
      navigate("/login");
      return null;
    }
    if (!user.onboardingCompleted) {
      navigate("/onboarding");
      return null;
    }
    navigate("/hoy");
    return null;
  }

  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/login" component={LoginPage} />
      <Route path="/onboarding" component={Onboarding} />
      {/* Secciones principales */}
      <Route path="/hoy">
        {() => <ProtectedRoute component={TodayPage} />}
      </Route>
      <Route path="/diario">
        {() => <ProtectedRoute component={DiaryHistoryPage} />}
      </Route>
      <Route path="/correos">
        {() => <ProtectedRoute component={CorreosPage} />}
      </Route>
      <Route path="/asesores">
        {() => <ProtectedRoute component={AsesoresPage} />}
      </Route>
      <Route path="/apuntes">
        {() => <ProtectedRoute component={ApuntesPage} />}
      </Route>
      <Route path="/finanzas">
        {() => <ProtectedRoute component={FinancePage} />}
      </Route>
      {/* Perfil (antes Vault/Bóveda) — accesible desde el avatar de usuario */}
      <Route path="/perfil">
        {() => <ProtectedRoute component={VaultPage} />}
      </Route>
      {/* Alias de compatibilidad */}
      <Route path="/vault">
        {() => <ProtectedRoute component={VaultPage} />}
      </Route>
      <Route path="/notas">
        {() => <ProtectedRoute component={ApuntesPage} />}
      </Route>
      <Route path="/senales">
        {() => <ProtectedRoute component={CorreosPage} />}
      </Route>
      {/* Rutas secundarias */}
      <Route path="/dashboard">
        {() => <ProtectedRoute component={Dashboard} />}
      </Route>
      <Route path="/chat">
        {() => <ProtectedRoute component={Chat} />}
      </Route>
      <Route path="/chat/:agentId">
        {() => <ProtectedRoute component={Chat} />}
      </Route>
      <Route path="/boardroom">
        {() => <ProtectedRoute component={Boardroom} />}
      </Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        {/* Fondo global oscuro difuminado */}
        <div className="fixed inset-0 z-[-1] bg-[url('/assets/background-dark.webp')] bg-cover bg-center bg-no-repeat opacity-40" />

        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
