import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, Printer, Save } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Badge, SectionCard } from "@/components/ui/kpi-card";
import {
  ApiError,
  createBilanSnapshot,
  getBilanCurrent,
  listBilanHistory,
  type BilanCurrent,
  type BilanSnapshot,
} from "@/lib/backend-api";
import { useRole } from "@/lib/roles";

export const Route = createFileRoute("/app/balance")({
  head: () => ({ meta: [{ title: "Bilan des sinistres — L'Algérienne Vie" }] }),
  component: BilanPage,
});

function fmtAmount(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${(value / 1_000_000).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} M DA`;
}

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("fr-FR");
}

function BilanPage() {
  const { can } = useRole();
  const [current, setCurrent] = useState<BilanCurrent | null>(null);
  const [history, setHistory] = useState<BilanSnapshot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    setError(null);
    try {
      const [nextCurrent, nextHistory] = await Promise.all([getBilanCurrent(), listBilanHistory()]);
      setCurrent(nextCurrent);
      setHistory(nextHistory);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.detail : "Impossible de charger le bilan.");
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const handleSnapshot = async () => {
    setSaving(true);
    setError(null);
    try {
      await createBilanSnapshot();
      await refresh();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.detail : "Création du snapshot impossible.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Topbar title="Bilan des sinistres" subtitle="Vue dérivée du backend courant et historique des snapshots" />
      <div className="p-6 lg:p-8 space-y-6">
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          <SectionCard title="Bilan courant" description="Payload de `/bilan/current`" className="lg:col-span-2">
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {Object.entries(current?.totals ?? {}).map(([domain, amount]) => (
                <div key={domain} className="rounded-2xl border border-border bg-background px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{domain}</div>
                  <div className="mt-2 font-display text-2xl text-foreground">{fmtAmount(amount)}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    run source: {(current?.source_runs as Record<string, string | undefined> | undefined)?.[domain] ?? "—"}
                  </div>
                </div>
              ))}
              {Object.keys(current?.totals ?? {}).length === 0 && (
                <div className="text-sm text-muted-foreground">Aucun montant dérivé disponible.</div>
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Badge variant="success">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Généré le {fmtDate(current?.generated_at)}
              </Badge>
              <Badge variant="gold">Total {fmtAmount(current?.grand_total)}</Badge>
            </div>
          </SectionCard>

          <SectionCard title="Actions" description="Impression côté navigateur et snapshot serveur">
            <div className="space-y-3">
              <button
                onClick={() => window.print()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-border px-4 py-3 text-sm font-semibold text-foreground hover:border-gold/35 hover:bg-muted"
              >
                <Printer className="h-4 w-4" />
                Imprimer la page
              </button>
              <button
                onClick={() => void handleSnapshot()}
                disabled={!can("import") || saving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-primary px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {saving ? "Création..." : "Créer un snapshot"}
              </button>
              {!can("import") && (
                <div className="text-xs text-muted-foreground">
                  Le backend réserve la création de snapshots bilan au rôle `ADMIN`.
                </div>
              )}
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Historique des snapshots" description="Persistance `bilan_snapshot`">
          <div className="space-y-3">
            {history.map((snapshot) => (
              <div key={snapshot.snapshot_id} className="rounded-2xl border border-border bg-background px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-foreground">{snapshot.snapshot_id}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {fmtDate(snapshot.created_at ?? snapshot.generated_at)} · créateur {snapshot.created_by ?? "n/a"}
                    </div>
                  </div>
                  <Badge variant="info">
                    <Clock3 className="h-3.5 w-3.5" />
                    {fmtAmount(snapshot.grand_total)}
                  </Badge>
                </div>
                <div className="mt-3 grid sm:grid-cols-2 xl:grid-cols-5 gap-2">
                  {Object.entries(snapshot.totals).map(([domain, amount]) => (
                    <div key={domain} className="rounded-xl border border-border bg-card px-3 py-2">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{domain}</div>
                      <div className="mt-1 font-semibold text-foreground">{fmtAmount(amount)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {history.length === 0 && (
              <div className="text-sm text-muted-foreground">Aucun snapshot enregistré.</div>
            )}
          </div>
        </SectionCard>
      </div>
    </>
  );
}
