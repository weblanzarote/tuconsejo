import { trpc } from "@/lib/trpc";
import { useRef, useState } from "react";
import { Upload, Trash2, Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

function formatMoney(n: number): string {
  return `${n.toFixed(2)} €`;
}

function formatWhen(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return "—";
  return x.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
}

export default function FinancePage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const utils = trpc.useUtils();

  const { data: status, isLoading: statusLoading } = trpc.finance.status.useQuery();
  const { data: movements = [], isLoading: listLoading } = trpc.finance.list.useQuery(
    { limit: 200 },
    { enabled: status?.hasData === true }
  );

  const importFile = trpc.finance.importCaixaXls.useMutation({
    onSuccess: (r) => {
      void utils.finance.status.invalidate();
      void utils.finance.list.invalidate();
      toast.success(`Importados ${r.imported} movimientos (${r.from ?? "?"} → ${r.to ?? "?"})`);
    },
    onError: (e) => toast.error(e.message || "No se pudo importar"),
  });

  const clearData = trpc.finance.clear.useMutation({
    onSuccess: () => {
      void utils.finance.status.invalidate();
      void utils.finance.list.invalidate();
      toast.success("Datos bancarios eliminados de la app");
    },
    onError: () => toast.error("No se pudo borrar"),
  });

  const onPickFile = () => inputRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xls")) {
      toast.error("Selecciona un archivo .xls (exportación de CaixaBankNow).");
      return;
    }
    setBusy(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const res = reader.result;
          if (typeof res !== "string") {
            reject(new Error("Lectura inválida"));
            return;
          }
          const i = res.indexOf(",");
          resolve(i >= 0 ? res.slice(i + 1) : res);
        };
        reader.onerror = () => reject(reader.error ?? new Error("Error al leer"));
        reader.readAsDataURL(file);
      });
      await importFile.mutateAsync({ fileBase64: base64, fileName: file.name });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al leer el archivo");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          <Wallet className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Finanzas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Importa el <strong className="text-foreground/90">.xls</strong> de movimientos de CaixaBankNow. Los datos se
            guardan en tu cuenta y se resumen para{" "}
            <Link href="/chat/economia" className="underline underline-offset-2 hover:text-foreground">
              Alejandro (Economía)
            </Link>{" "}
            y el resto del consejo cuando chateas o usas la consulta rápida.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3 text-sm text-muted-foreground">
        <p className="font-medium text-foreground/90">Instrucciones</p>
        <ol className="list-decimal list-inside space-y-1.5">
          <li>En CaixaBankNow: descarga de movimientos en formato <code className="text-xs bg-muted px-1 rounded">.xls</code>.</li>
          <li>Pulsa &quot;Elegir archivo&quot; y selecciónalo. Cada importación <strong className="text-foreground/80">sustituye</strong> la anterior en la app.</li>
          <li>No almacenamos credenciales del banco: solo el fichero que tú subes.</li>
        </ol>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input ref={inputRef} type="file" accept=".xls,application/vnd.ms-excel" className="hidden" onChange={onFile} />
        <button
          type="button"
          onClick={onPickFile}
          disabled={busy || importFile.isPending}
          className={cn(
            "inline-flex items-center gap-2 rounded-xl border border-border bg-foreground/10 px-4 py-2.5 text-sm font-medium",
            "hover:bg-foreground/15 transition-colors cursor-pointer disabled:opacity-50"
          )}
        >
          {busy || importFile.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Elegir archivo .xls
        </button>
        {status?.hasData && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm("¿Borrar todos los movimientos importados de esta app?")) {
                void clearData.mutateAsync();
              }
            }}
            disabled={clearData.isPending}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-destructive transition-colors cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            Borrar importación
          </button>
        )}
      </div>

      {statusLoading ? (
        <div className="h-24 rounded-xl border border-border/40 bg-muted/20 animate-pulse" />
      ) : status?.hasData ? (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-1">
            <p>
              <span className="text-foreground/80">Última importación:</span> {formatWhen(status.lastImportedAt ?? null)}{" "}
              · <span className="text-foreground/80">{status.movementCount}</span> movimientos
            </p>
            {status.accountHint && (
              <p>
                <span className="text-foreground/80">Cuenta (según archivo):</span>{" "}
                <span className="font-mono text-xs">{status.accountHint}</span>
              </p>
            )}
            {status.fileName && (
              <p>
                <span className="text-foreground/80">Archivo:</span> {status.fileName}
              </p>
            )}
          </div>

          {listLoading ? (
            <div className="h-40 rounded-xl border border-border/40 bg-muted/20 animate-pulse" />
          ) : (
            <div className="rounded-xl border border-border/50 overflow-hidden">
              <div className="max-h-[420px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/90 backdrop-blur-sm border-b border-border">
                    <tr className="text-left text-xs text-muted-foreground uppercase tracking-wide">
                      <th className="px-3 py-2 font-medium">Fecha</th>
                      <th className="px-3 py-2 font-medium">Movimiento</th>
                      <th className="px-3 py-2 font-medium text-right">Importe</th>
                      <th className="px-3 py-2 font-medium text-right">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((row) => (
                      <tr key={row.id} className="border-b border-border/40 hover:bg-muted/30">
                        <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{row.bookedDate}</td>
                        <td className="px-3 py-2">
                          <span className="text-foreground">{row.description}</span>
                          {row.extra ? (
                            <span className="block text-xs text-muted-foreground truncate max-w-[220px]">{row.extra}</span>
                          ) : null}
                        </td>
                        <td
                          className={cn(
                            "px-3 py-2 text-right font-mono tabular-nums",
                            row.amount < 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                          )}
                        >
                          {formatMoney(row.amount)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-muted-foreground">
                          {row.balance != null ? formatMoney(row.balance) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Aún no has importado ningún extracto.</p>
      )}
    </div>
  );
}
