import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download, FileJson, FileSpreadsheet } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Badge, SectionCard } from "@/components/ui/kpi-card";
import {
  ApiError,
  downloadAuthorizedFile,
  getDashboardSummary,
  getDomainRun,
  listDomainDocuments,
  type Domain,
  type DomainDocument,
} from "@/lib/backend-api";

export const Route = createFileRoute("/app/exports")({
  head: () => ({ meta: [{ title: "Exports & rapports — L'Algérienne Vie" }] }),
  component: ExportsPage,
});

interface DomainExportState {
  documents: DomainDocument[];
  resultArtifact?: string;
  rowsArtifact?: string;
  cleaningReportArtifact?: string;
}

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("fr-FR");
}

function ExportsPage() {
  const [exportsByDomain, setExportsByDomain] = useState<Partial<Record<Domain, DomainExportState>>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const domains: Domain[] = ["ppna", "sap", "pe", "pb", "ibnr"];

    void Promise.all([
      getDashboardSummary(),
      Promise.all(domains.map((domain) => listDomainDocuments(domain))),
    ])
      .then(async ([summary, documentLists]) => {
        const base: Partial<Record<Domain, DomainExportState>> = {};
        domains.forEach((domain, index) => {
          base[domain] = { documents: documentLists[index] };
        });

        await Promise.all(
          domains.map(async (domain) => {
            const runId = summary.domains[domain]?.run_id;
            if (!runId) return;
            const run = await getDomainRun(domain, runId);
            base[domain] = {
              ...(base[domain] ?? { documents: [] }),
              resultArtifact: run.artifacts.result,
              rowsArtifact: run.artifacts.rows,
              cleaningReportArtifact: run.artifacts.cleaning_report,
            };
          }),
        );

        if (active) setExportsByDomain(base);
      })
      .catch((cause) => {
        if (active) {
          setError(cause instanceof ApiError ? cause.detail : "Impossible de charger les exports.");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <Topbar title="Exports & rapports" subtitle="Téléchargements backend disponibles par domaine" />
      <div className="p-6 lg:p-8 space-y-6">
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <SectionCard title="Artefacts de run" description="Résultat, lignes et cleaning report du dernier run réussi par domaine">
          <div className="grid lg:grid-cols-2 gap-4">
            {(["ppna", "sap", "pe", "pb", "ibnr"] as const).map((domain) => {
              const item = exportsByDomain[domain];
              return (
                <div key={domain} className="rounded-2xl border border-border bg-background px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold uppercase text-foreground">{domain}</div>
                    <Badge variant={item?.resultArtifact ? "success" : "warning"}>
                      {item?.resultArtifact ? "artefacts prêts" : "aucun run"}
                    </Badge>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {item?.resultArtifact && (
                      <button
                        onClick={() => void downloadAuthorizedFile(item.resultArtifact!, `${domain}-result.json`)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-foreground hover:border-gold/35"
                      >
                        <FileJson className="h-3.5 w-3.5" />
                        Result
                      </button>
                    )}
                    {item?.rowsArtifact && (
                      <button
                        onClick={() => void downloadAuthorizedFile(item.rowsArtifact!, `${domain}-rows.json`)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-foreground hover:border-gold/35"
                      >
                        <FileJson className="h-3.5 w-3.5" />
                        Rows
                      </button>
                    )}
                    {item?.cleaningReportArtifact && (
                      <button
                        onClick={() => void downloadAuthorizedFile(item.cleaningReportArtifact!, `${domain}-cleaning-report.json`)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-foreground hover:border-gold/35"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Cleaning report
                      </button>
                    )}
                    {!item?.resultArtifact && (
                      <span className="text-xs text-muted-foreground">Lancez d'abord un run dans la page domaine.</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard title="Documents exportables" description="Derniers documents versionnés par domaine">
          <div className="space-y-4">
            {(["ppna", "sap", "pe", "pb", "ibnr"] as const).map((domain) => (
              <div key={domain} className="rounded-2xl border border-border bg-background px-4 py-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold uppercase text-foreground">{domain}</div>
                  <Badge variant="info">{exportsByDomain[domain]?.documents.length ?? 0} document(s)</Badge>
                </div>
                <div className="space-y-2">
                  {(exportsByDomain[domain]?.documents ?? []).slice(0, 3).map((document) => (
                    <div key={document.document_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground">{document.original_filename}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{fmtDate(document.created_at)}</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {document.downloads ? (
                          <>
                            <button
                              onClick={() => void downloadAuthorizedFile(document.downloads!.xlsx, document.original_filename)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-foreground hover:border-gold/35"
                            >
                              <FileSpreadsheet className="h-3.5 w-3.5" />
                              XLSX
                            </button>
                            <button
                              onClick={() => void downloadAuthorizedFile(document.downloads!.csv, `${document.original_filename.replace(/\.xlsx$/i, "")}.csv`)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-foreground hover:border-gold/35"
                            >
                              <Download className="h-3.5 w-3.5" />
                              CSV
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">Ouvrir la fiche domaine pour les téléchargements.</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {(exportsByDomain[domain]?.documents.length ?? 0) === 0 && (
                    <div className="text-xs text-muted-foreground">Aucun document disponible pour ce domaine.</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </>
  );
}
