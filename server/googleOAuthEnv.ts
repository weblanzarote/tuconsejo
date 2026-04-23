/**
 * Credenciales OAuth2 de Google (Gmail / Calendar) leídas una sola vez del entorno.
 * Un solo sitio evita espacios en .env y mensajes de error incoherentes entre rutas.
 */

export const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID ?? "").trim();
export const GOOGLE_CLIENT_SECRET = (process.env.GOOGLE_CLIENT_SECRET ?? "").trim();

export function assertGoogleOAuthClientConfigured(): void {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error(
      "[Google] Faltan GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET en el entorno (.env). " +
        "Deben ser el ID y el secreto del cliente OAuth tipo «Aplicación web» en Google Cloud Console."
    );
  }
}

/** Convierte la respuesta JSON del endpoint token en texto útil para logs y toasts. */
export function describeGoogleTokenEndpointError(httpBody: string): string {
  try {
    const j = JSON.parse(httpBody) as { error?: string; error_description?: string };
    if (j.error === "invalid_client") {
      return (
        "OAuth invalid_client: Google no reconoce el cliente (client_id / client_secret). " +
        "Comprueba en .env que GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET coinciden exactamente con " +
        "Google Cloud → APIs y servicios → Credenciales → tu OAuth 2.0 Client ID de tipo «Aplicación web» " +
        "(no uses el ID de cliente de Android/iOS). Si cambiaste de proyecto o borraste el cliente, " +
        "crea uno nuevo, actualiza .env y reinicia el servidor; luego desconecta y vuelve a conectar Gmail en la app."
      );
    }
    if (j.error === "invalid_grant") {
      return (
        "OAuth invalid_grant: el refresh token caducó o fue revocado. " +
        "Desconecta la cuenta Gmail en la app y vuelve a iniciar el flujo «Conectar Gmail»."
      );
    }
    if (j.error) {
      return `${j.error}${j.error_description ? `: ${j.error_description}` : ""}`;
    }
  } catch {
    /* no es JSON */
  }
  return httpBody.length > 400 ? `${httpBody.slice(0, 400)}…` : httpBody;
}
