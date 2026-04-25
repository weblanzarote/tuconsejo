import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { MessageCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { cn } from "@/lib/utils";

const VISIBLE_KEY = "tuconsejo.chatFab.visible";
const LAST_AGENT_KEY = "tuconsejo.chatFab.lastAgent";
const VISIBILITY_EVENT = "tuconsejo.chatFab.visibility";
const HIDDEN_ROUTES = ["/login", "/onboarding"];

export function readChatFabVisible(): boolean {
  try {
    const raw = localStorage.getItem(VISIBLE_KEY);
    if (raw == null) return true;
    return raw === "1";
  } catch {
    return true;
  }
}

export function setChatFabVisible(value: boolean) {
  try {
    localStorage.setItem(VISIBLE_KEY, value ? "1" : "0");
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(VISIBILITY_EVENT, { detail: value }));
}

export function rememberChatAgent(agentId: string) {
  try {
    localStorage.setItem(LAST_AGENT_KEY, agentId);
  } catch {
    /* ignore */
  }
}

function readLastAgent(): string {
  try {
    return localStorage.getItem(LAST_AGENT_KEY) || "economia";
  } catch {
    return "economia";
  }
}

export default function ChatFab() {
  const [location, navigate] = useLocation();
  const [visible, setVisible] = useState<boolean>(() => readChatFabVisible());

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<boolean>;
      setVisible(Boolean(ce.detail));
    };
    window.addEventListener(VISIBILITY_EVENT, handler);
    return () => window.removeEventListener(VISIBILITY_EVENT, handler);
  }, []);

  const onChatRoute = location === "/chat" || location.startsWith("/chat/");
  const isHidden =
    !visible || onChatRoute || HIDDEN_ROUTES.some((r) => location === r || location.startsWith(r + "/"));

  if (isHidden) return null;

  const goToChat = () => {
    const last = readLastAgent();
    navigate(`/chat/${last}`);
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={goToChat}
          aria-label="Abrir chat con asesores"
          className={cn(
            "fixed bottom-5 right-5 z-40 lg:bottom-6 lg:right-6",
            "h-11 w-11 rounded-full flex items-center justify-center",
            "bg-foreground text-background shadow-lg",
            "border border-black/10 dark:border-white/10",
            "backdrop-blur-xl transition-all duration-150",
            "hover:scale-105 active:scale-95"
          )}
        >
          <MessageCircle className="h-5 w-5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" sideOffset={8}>
        Chat con asesores
      </TooltipContent>
    </Tooltip>
  );
}
