import { useEffect, useState } from "react";
import { Calculator, Download, FileSpreadsheet, Play, RefreshCw, ShieldAlert } from "lucide-react";
import { FileUploadZone } from "@/components/ui/file-upload-zone";
import { Badge, KpiCard, SectionCard } from "@/components/ui/kpi-card";
import {
  ApiError,
  createDomainRun,
  downloadAuthorizedFile,
  getDashboardSummary,
  getDomainRun,
  getDomainRunRows,
  getJsonArtifact,
  listDomainDocuments,
  uploadDomainDocument,
  type Domain,
  type DomainDocument,
  type DomainRun,
} from "@/lib/backend-api";
import { useRole } from "@/lib/roles";
import { Topbar } from "@/components/layout/Topbar";

interface RunField {
  key: string;
  label: string;
  type: "date" | "number" | "select";
  required?: boolean;
  defaultValue?: string;
  options?: Array<{ label: string; value: string }>;
}

interface DomainWorkspaceProps {
  domain: Domain;
  title: string;
  subtitle: string;
  description: string;
  fields?: RunField[];
}

function fmtAmount(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${(value / 1_000_000).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} M DA`;
}

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("fr-FR");
}

function extractHeadlineTotal(result: unknown): number | null {
  if (!result || typeof result !== "object") return null;
  if ("total_amount" in result && typeof result.total_amount === "number") return result.total_amount;
  if ("total_ibnr" in result && typeof result.total_ibnr === "number") return result.total_ibnr;

  let total = 0;
  let found = false;
  for (const value of Object.values(result)) {
    if (value && typeof value === "object" && "total_ibnr" in value && typeof value.total_ibnr === "number") {
      total += value.total_ibnr;
      found = true;
    }
  }
  return found ? total : null;
}

function normalizeRows(rows: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(rows)) {
    return rows.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
  }
  if (!rows || typeof rows !== "object") return [];

  return Object.entries(rows).flatMap(([group, value]) => {
    if (Array.isArray(value)) {
      return value
        .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
        .map((row) => ({ group, ...row }));
    }
    if (value && typeof value === "object") {
      return [{ group, ...(value as Record<string, unknown>) }];
    }
    return [{ group, value }];
  });
}

function coerceFieldValue(field: RunField, value: string) {
  if (field.type === "number") {
    return value === "" ? undefined : Number(value);
  }
  return value === "" ? undefined : value;
}

function buildInitialValues(fields: RunField[]) {
  return Object.fromEntries(fields.map((field) => [field.key, field.defaultValue ?? ""]));
}

export function DomainWorkspace({
  domain,
  title,
  subtitle,
  description,
  fields = [],
}: DomainWorkspaceProps) {
  const { can } = useRole();
  const [documents, setDocuments] = useState<DomainDocument[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [latestRun, setLatestRun] = useState<DomainRun | null>(null);
  const [resultPayload, setResultPayload] = useState<unknown>(null);
  const [rowsPayload, setRowsPayload] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() => buildInitialValues(fields));

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextDocuments, summary] = await Promise.all([
        listDomainDocuments(domain),
        getDashboardSummary(),
      ]);
      setDocuments(nextDocuments);
      setSelectedDocumentId((current) => {
        if (current && nextDocuments.some((document) => document.document_id === current)) return current;
        return nextDocuments[0]?.document_id ?? "";
      });

      const runId = summary.domains[domain]?.run_id;
      if (runId) {
        const run = await getDomainRun(domain, runId);
        setLatestRun(run);
        const [result, rows] = await Promise.all([
          getJsonArtifact<unknown>(run.artifacts.result),
          getDomainRunRows(domain, run.run_id),
        ]);
        setResultPayload(result);
        setRowsPayload(rows);
      } else {
        setLatestRun(null);
        setResultPayload(null);
        setRowsPayload(null);
      }
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.detail : "Impossible de charger les données du domaine.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [domain]);

  const handleUpload = async (_buffer: ArrayBuffer, file: File) => {
    if (!can("import")) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded = await uploadDomainDocument(domain, file, file.name);
      await refresh();
      setSelectedDocumentId(uploaded.document_id);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.detail : "Upload impossible.");
    } finally {
      setUploading(false);
    }
  };

  const runCalculation = async () => {
    if (!selectedDocumentId) {
      setError("Sélectionnez un document avant de lancer un calcul.");
      return;
    }
    setRunning(true);
    setError(null);
    try {
      const parameters = Object.fromEntries(
        fields
          .map((field) => [field.key, coerceFieldValue(field, fieldValues[field.key] ?? "")] as const)
          .filter((entry) => entry[1] !== undefined),
      );

      for (const field of fields) {
        if (field.required && parameters[field.key] === undefined) {
          throw new ApiError(422, `Le paramètre "${field.label}" est requis.`);
        }
      }

      const run = await createDomainRun(domain, {
        document_id: selectedDocumentId,
        parameters,
      });
      setLatestRun(run);
      const [result, rows] = await Promise.all([
        getJsonArtifact<unknown>(run.artifacts.result),
        getDomainRunRows(domain, run.run_id),
      ]);
      setResultPayload(result);
      setRowsPayload(rows);
      await refresh();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.detail : "Le calcul a échoué.");
    } finally {
      setRunning(false);
    }
  };

  const selectedDocument = documents.find((document) => document.document_id === selectedDocumentId) ?? documents[0] ?? null;
  const normalizedRows = normalizeRows(rowsPayload).slice(0, 8);
  const rowColumns = Array.from(new Set(normalizedRows.flatMap((row) => Object.keys(row)))).slice(0, 6);
  const headlineTotal = extractHeadlineTotal(resultPayload);

  return (
    <>
      <Topbar title={title} subtitle={subtitle} />
      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-foreground">{description}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Domaine backend: <span className="font-mono text-foreground">{domain}</span>
            </div>
          </div>
          <button
            onClick={() => void refresh()}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-foreground transition-colors hover:border-gold/40 hover:bg-muted"
          >
            <RefreshCw className="h-4 w-4" />
            Actualiser
          </button>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Documents"
            value={documents.length.toLocaleString("fr-FR")}
            hint="catalogués dans ce domaine"
            icon={<FileSpreadsheet className="h-4 w-4" />}
            accent="primary"
          />
          <KpiCard
            label="Dernier calcul"
            value={latestRun?.status ?? "—"}
            hint={latestRun ? fmtDate(latestRun.finished_at ?? latestRun.started_at) : "aucun run"}
            icon={<Calculator className="h-4 w-4" />}
          />
          <KpiCard
            label="Provision"
            value={fmtAmount(headlineTotal)}
            hint="issue du dernier résultat"
            icon={<ShieldAlert className="h-4 w-4" />}
            accent="gold"
          />
          <KpiCard
            label="Lignes résultat"
            value={normalizeRows(rowsPayload).length.toLocaleString("fr-FR")}
            hint="aperçu chargeable"
            icon={<Play className="h-4 w-4" />}
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <SectionCard title="Documents disponibles" description="Versions stockées et téléchargements exportés">
            {loading ? (
              <div className="text-sm text-muted-foreground">Chargement des documents...</div>
            ) : documents.length === 0 ? (
              <div className="text-sm text-muted-foreground">Aucun document chargé pour ce domaine.</div>
            ) : (
              <div className="space-y-3">
                {documents.map((document) => {
                  const active = document.document_id === selectedDocumentId;
                  return (
                    <div
                      key={document.document_id}
                      className={`rounded-2xl border px-4 py-3 transition-colors ${
                        active ? "border-gold/45 bg-gold/5" : "border-border bg-background"
                      }`}
                    >
                      <button
                        onClick={() => setSelectedDocumentId(document.document_id)}
                        className="w-full text-left"
                      >
                        <div className="text-sm font-semibold text-foreground">{document.original_filename}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Créé le {fmtDate(document.created_at)} · version {document.current_version_id}
                        </div>
                      </button>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant={active ? "gold" : "info"}>{document.status}</Badge>
                        {document.downloads && (
                          <>
                            <button
                              onClick={() => void downloadAuthorizedFile(document.downloads!.xlsx, `${document.original_filename}`)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs text-foreground hover:border-gold/35"
                            >
                              <Download className="h-3.5 w-3.5" />
                              XLSX
                            </button>
                            <button
                              onClick={() => void downloadAuthorizedFile(document.downloads!.csv, `${document.original_filename.replace(/\.xlsx$/i, "")}.csv`)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs text-foreground hover:border-gold/35"
                            >
                              <Download className="h-3.5 w-3.5" />
                              CSV
                            </button>
                            <button
                              onClick={() => void downloadAuthorizedFile(document.downloads!.txt, `${document.original_filename.replace(/\.xlsx$/i, "")}.txt`)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs text-foreground hover:border-gold/35"
                            >
                              <Download className="h-3.5 w-3.5" />
                              TXT
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Lancer un calcul"
            description="Exécute le moteur backend sur le document sélectionné"
            action={<Badge variant={can("import") ? "success" : "warning"}>{can("import") ? "ADMIN" : "lecture seule"}</Badge>}
          >
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">Document source</label>
                <select
                  value={selectedDocumentId}
                  onChange={(event) => setSelectedDocumentId(event.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-gold"
                >
                  <option value="">Sélectionner un document</option>
                  {documents.map((document) => (
                    <option key={document.document_id} value={document.document_id}>
                      {document.original_filename}
                    </option>
                  ))}
                </select>
              </div>

              {fields.map((field) => (
                <label key={field.key} className="block">
                  <span className="mb-1.5 block text-xs font-medium text-foreground">{field.label}</span>
                  {field.type === "select" ? (
                    <select
                      value={fieldValues[field.key] ?? ""}
                      onChange={(event) => setFieldValues((current) => ({ ...current, [field.key]: event.target.value }))}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-gold"
                    >
                      <option value="">Choisir</option>
                      {field.options?.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type}
                      value={fieldValues[field.key] ?? ""}
                      onChange={(event) => setFieldValues((current) => ({ ...current, [field.key]: event.target.value }))}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-gold"
                    />
                  )}
                </label>
              ))}

              <button
                onClick={() => void runCalculation()}
                disabled={!can("import") || running || !selectedDocument}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-primary px-4 py-3 text-sm font-semibold text-white shadow-soft transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Play className="h-4 w-4" />
                {running ? "Calcul en cours..." : "Lancer le calcul"}
              </button>

              {!can("import") && (
                <div className="text-xs text-muted-foreground">
                  Le backend réserve l'upload et l'exécution des runs au rôle `ADMIN`.
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Upload XLSX" description="Envoie un nouveau classeur au backend pour ce domaine">
            {can("import") ? (
              <FileUploadZone
                onFile={(buffer, file) => void handleUpload(buffer, file)}
                loading={uploading}
                error={null}
                title={`Charger un fichier ${domain.toUpperCase()}`}
                description="Le backend attend le corps brut du classeur Excel et crée une version persistée."
              />
            ) : (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                Lecture seule pour ce compte. Connectez-vous avec un rôle `ADMIN` pour charger un nouveau fichier.
              </div>
            )}
          </SectionCard>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <SectionCard
            title="Dernier run"
            description="Métadonnées backend et artefacts générés"
            action={latestRun ? <Badge variant={latestRun.status === "succeeded" ? "success" : "warning"}>{latestRun.status}</Badge> : undefined}
          >
            {!latestRun ? (
              <div className="text-sm text-muted-foreground">Aucun run disponible pour ce domaine.</div>
            ) : (
              <div className="space-y-3">
                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl border border-border bg-background px-3 py-2.5">
                    <div className="text-xs text-muted-foreground">Run ID</div>
                    <div className="mt-1 font-mono text-foreground">{latestRun.run_id}</div>
                  </div>
                  <div className="rounded-xl border border-border bg-background px-3 py-2.5">
                    <div className="text-xs text-muted-foreground">Version source</div>
                    <div className="mt-1 font-mono text-foreground">{latestRun.document_version_id}</div>
                  </div>
                  <div className="rounded-xl border border-border bg-background px-3 py-2.5">
                    <div className="text-xs text-muted-foreground">Démarré</div>
                    <div className="mt-1 text-foreground">{fmtDate(latestRun.started_at)}</div>
                  </div>
                  <div className="rounded-xl border border-border bg-background px-3 py-2.5">
                    <div className="text-xs text-muted-foreground">Terminé</div>
                    <div className="mt-1 text-foreground">{fmtDate(latestRun.finished_at)}</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => void downloadAuthorizedFile(latestRun.artifacts.result, `${domain}-result.json`)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-foreground hover:border-gold/35"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Résultat JSON
                  </button>
                  <button
                    onClick={() => void downloadAuthorizedFile(latestRun.artifacts.rows, `${domain}-rows.json`)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-foreground hover:border-gold/35"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Lignes JSON
                  </button>
                  <button
                    onClick={() => void downloadAuthorizedFile(latestRun.artifacts.cleaning_report, `${domain}-cleaning-report.json`)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-foreground hover:border-gold/35"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Cleaning report
                  </button>
                </div>

                <pre className="max-h-64 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">
                  {JSON.stringify(resultPayload, null, 2)}
                </pre>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Aperçu des lignes" description="Premières lignes du payload rows_json">
            {normalizedRows.length === 0 ? (
              <div className="text-sm text-muted-foreground">Aucune ligne calculée disponible.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      {rowColumns.map((column) => (
                        <th key={column} className="px-3 py-2 font-medium">{column}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {normalizedRows.map((row, index) => (
                      <tr key={index} className="border-b border-border/60 last:border-0">
                        {rowColumns.map((column) => (
                          <td key={column} className="px-3 py-2 text-foreground">
                            {typeof row[column] === "number"
                              ? Number(row[column]).toLocaleString("fr-FR", { maximumFractionDigits: 4 })
                              : String(row[column] ?? "—")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </>
  );
}
