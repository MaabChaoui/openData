import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Activity, AlertTriangle, ArrowUpRight, CheckCircle2, Clock3, FileClock } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Badge, KpiCard, SectionCard } from "@/components/ui/kpi-card";
import {
  ApiError,
  getBilanCurrent,
  getDashboardAlerts,
  getDashboardCompletion,
  getDashboardSummary,
  getDashboardTimeline,
  type BilanCurrent,
  type DashboardAlerts,
  type DashboardCompletion,
  type DashboardSummary,
  type DashboardTimeline,
} from "@/lib/backend-api";
import { useRole } from "@/lib/roles";

export const Route = createFileRoute("/app/")({
  head: () => ({ meta: [{ title: "Tableau de bord global — L'Algérienne Vie" }] }),
  component: GlobalDashboard,
});

function fmtAmount(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${(value / 1_000_000).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} M DA`;
}

function GlobalDashboard() {
  const { info } = useRole();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [alerts, setAlerts] = useState<DashboardAlerts | null>(null);
  const [completion, setCompletion] = useState<DashboardCompletion | null>(null);
  const [timeline, setTimeline] = useState<DashboardTimeline | null>(null);
  const [bilan, setBilan] = useState<BilanCurrent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([
      getDashboardSummary(),
      getDashboardAlerts(),
      getDashboardCompletion(),
      getDashboardTimeline(),
      getBilanCurrent(),
    ])
      .then(([nextSummary, nextAlerts, nextCompletion, nextTimeline, nextBilan]) => {
        if (!active) return;
        setSummary(nextSummary);
        setAlerts(nextAlerts);
        setCompletion(nextCompletion);
        setTimeline(nextTimeline);
        setBilan(nextBilan);
      })
      .catch((cause) => {
        if (!active) return;
        setError(cause instanceof ApiError ? cause.detail : "Impossible de charger le tableau de bord.");
      });
    return () => {
      active = false;
    };
  }, []);

  const completedDomains = summary?.completed_domains ?? 0;
  const expectedDomains = summary?.expected_domains ?? 5;
  const completionRate = expectedDomains > 0 ? (completedDomains / expectedDomains) * 100 : 0;

  return (
    <>
      <Topbar
        title={`Bonjour, ${info.user}`}
        subtitle={`Cockpit ${info.label} · données backend synchronisées`}
      />
      <div className="p-6 lg:p-8 space-y-6">
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Bilan courant"
            value={fmtAmount(bilan?.grand_total)}
            hint="agrégé depuis les runs disponibles"
            icon={<Activity className="h-4 w-4" />}
            accent="primary"
          />
          <KpiCard
            label="Domaines calculés"
            value={`${completedDomains}/${expectedDomains}`}
            hint={`${completionRate.toFixed(0)} % de couverture`}
            icon={<CheckCircle2 className="h-4 w-4" />}
          />
          <KpiCard
            label="Alertes actives"
            value={String(alerts?.alerts.length ?? 0)}
            hint="générées par le backend"
            icon={<AlertTriangle className="h-4 w-4" />}
            accent="gold"
          />
          <KpiCard
            label="Derniers événements"
            value={String(timeline?.events.length ?? 0)}
            hint="journal d'audit récent"
            icon={<Clock3 className="h-4 w-4" />}
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <SectionCard title="Couverture par domaine" description="Totaux remontés par le dashboard summary">
            <div className="space-y-3">
              {(["ppna", "sap", "pe", "pb", "ibnr"] as const).map((domain) => {
                const item = summary?.domains[domain];
                const isComplete = completion?.domains[domain]?.completed;
                return (
                  <div key={domain} className="rounded-2xl border border-border bg-background px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold uppercase text-foreground">{domain}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {item ? `Run ${item.run_id}` : "Aucun run réussi"}
                        </div>
                      </div>
                      <Badge variant={isComplete ? "success" : "warning"}>{isComplete ? "calculé" : "en attente"}</Badge>
                    </div>
                    <div className="mt-3 flex items-end justify-between">
                      <div className="font-display text-2xl text-foreground">{fmtAmount(item?.total)}</div>
                      <Link to={`/app/${domain}`} className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-gold-deep">
                        Ouvrir <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard title="Alertes backend" description="Synthèse `dashboard/alerts`" className="lg:col-span-2">
            {!alerts || alerts.alerts.length === 0 ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                Aucune alerte ouverte.
              </div>
            ) : (
              <div className="space-y-3">
                {alerts.alerts.map((alert, index) => (
                  <div key={`${alert.type}-${index}`} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                      <AlertTriangle className="h-4 w-4" />
                      {String(alert.type)}
                    </div>
                    <div className="mt-1 text-sm text-amber-700">{String(alert.message)}</div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <SectionCard title="Bilan courant détaillé" description="Payload `bilan/current`">
            <div className="space-y-3">
              {Object.entries(bilan?.totals ?? {}).length === 0 ? (
                <div className="text-sm text-muted-foreground">Aucun total disponible.</div>
              ) : (
                Object.entries(bilan?.totals ?? {}).map(([domain, amount]) => (
                  <div key={domain} className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3">
                    <div>
                      <div className="text-sm font-semibold uppercase text-foreground">{domain}</div>
                      <div className="text-xs text-muted-foreground">
                        source run: {(bilan?.source_runs as Record<string, string | undefined> | undefined)?.[domain] ?? "—"}
                      </div>
                    </div>
                    <div className="font-semibold text-foreground">{fmtAmount(amount)}</div>
                  </div>
                ))
              )}
            </div>
          </SectionCard>

          <SectionCard title="Timeline récente" description="Événements issus de l'audit trail">
            <div className="space-y-3">
              {(timeline?.events ?? []).slice(0, 8).map((event) => (
                <div key={event.event_id} className="rounded-2xl border border-border bg-background px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-foreground">{event.action}</div>
                    <Badge variant="info">{event.target_type}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {event.target_id} · {new Date(event.occurred_at).toLocaleString("fr-FR")}
                  </div>
                </div>
              ))}
              {(timeline?.events ?? []).length === 0 && (
                <div className="text-sm text-muted-foreground">Aucun événement récent.</div>
              )}
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Raccourcis" description="Pages maintenant branchées sur l'API">
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {[
              ["/app/import", "Import & catalogage", "Uploads versionnés par domaine"],
              ["/app/audit", "Audit", "Journal et hashes d'événements"],
              ["/app/balance", "Bilan", "Courant et historique des snapshots"],
              ["/app/exports", "Exports", "Artefacts et téléchargements"],
            ].map(([to, label, body]) => (
              <Link
                key={to}
                to={to}
                className="rounded-2xl border border-border bg-background px-4 py-4 transition-colors hover:border-gold/40 hover:bg-gold/5"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <FileClock className="h-4 w-4 text-primary" />
                  {label}
                </div>
                <div className="mt-2 text-sm text-muted-foreground">{body}</div>
              </Link>
            ))}
          </div>
        </SectionCard>
      </div>
    </>
  );
}
