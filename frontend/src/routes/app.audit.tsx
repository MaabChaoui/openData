import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GitBranch, ShieldCheck } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Badge, SectionCard } from "@/components/ui/kpi-card";
import { ApiError, listAuditEvents, type AuditEvent } from "@/lib/backend-api";

export const Route = createFileRoute("/app/audit")({
  head: () => ({ meta: [{ title: "Audit & traçabilité — L'Algérienne Vie" }] }),
  component: AuditPage,
});

function fmtDate(value: string) {
  return new Date(value).toLocaleString("fr-FR");
}

function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void listAuditEvents(100)
      .then((payload) => {
        if (active) setEvents(payload);
      })
      .catch((cause) => {
        if (active) {
          setError(cause instanceof ApiError ? cause.detail : "Impossible de charger l'audit trail.");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <Topbar title="Audit & traçabilité" subtitle="Journal complet des opérations persistées par le backend" />
      <div className="p-6 lg:p-8 space-y-6">
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-5">
          {[
            { label: "Événements chargés", value: String(events.length), hint: "limite API 100" },
            {
              label: "Cibles distinctes",
              value: String(new Set(events.map((event) => `${event.target_type}:${event.target_id}`)).size),
              hint: "ressources suivies",
            },
            {
              label: "Chaîne d'audit",
              value: events.length > 0 ? "active" : "vide",
              hint: events[0]?.event_hash.slice(0, 12) ?? "aucun hash",
            },
          ].map((card, index) => (
            <div
              key={card.label}
              className={`rounded-2xl border px-5 py-5 shadow-soft ${index === 2 ? "bg-gradient-primary text-white border-transparent" : "bg-card border-border"}`}
            >
              <div className={`text-[10px] uppercase tracking-[0.18em] ${index === 2 ? "text-gold" : "text-muted-foreground"}`}>
                {card.label}
              </div>
              <div className={`mt-2 font-display text-3xl ${index === 2 ? "text-white" : "text-foreground"}`}>{card.value}</div>
              <div className={`mt-1 text-xs ${index === 2 ? "text-white/65" : "text-muted-foreground"}`}>{card.hint}</div>
            </div>
          ))}
        </div>

        <SectionCard title="Journal d'activité" description="Chaque événement embarque son payload, son hash et sa référence au précédent">
          <div className="space-y-3">
            {events.map((event) => (
              <div key={event.event_id} className="rounded-2xl border border-border bg-background px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-foreground">{event.action}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {event.target_type} · {event.target_id} · {fmtDate(event.occurred_at)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="info">{event.target_type}</Badge>
                    <Badge variant="gold">{event.actor_user_id ?? "system"}</Badge>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <div className="rounded-xl border border-border bg-card px-3 py-2.5">
                    <div className="text-[11px] text-muted-foreground">Hash courant</div>
                    <div className="mt-1 font-mono text-xs text-foreground break-all">{event.event_hash}</div>
                  </div>
                  <div className="rounded-xl border border-border bg-card px-3 py-2.5">
                    <div className="text-[11px] text-muted-foreground">Hash précédent</div>
                    <div className="mt-1 font-mono text-xs text-foreground break-all">{event.previous_event_hash ?? "—"}</div>
                  </div>
                </div>
                <pre className="mt-3 max-h-48 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">
                  {JSON.stringify(event.payload, null, 2)}
                </pre>
              </div>
            ))}
            {events.length === 0 && (
              <div className="text-sm text-muted-foreground">Aucun événement d'audit disponible.</div>
            )}
          </div>
        </SectionCard>

        <div className="rounded-2xl bg-gradient-primary p-6 text-white shadow-elegant">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-9 w-9 text-gold" />
            <div>
              <div className="font-display text-lg">Traçabilité branchée sur le backend</div>
              <div className="text-sm text-white/70">
                Cette page ne lit plus un jeu de données simulé: elle rend directement les `audit_event` persistés.
              </div>
            </div>
          </div>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.16em]">
            <GitBranch className="h-3.5 w-3.5 text-gold" />
            Hash chain visible
          </div>
        </div>
      </div>
    </>
  );
}
