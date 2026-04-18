import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import {
  AlertCircle,
  Calculator,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Play,
  RefreshCw,
  Upload,
  XCircle,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

// ─── Types ─────────────────────────────────────────────────────────────────────

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
  primaryMetricLabel?: string;
  primaryCTALabel?: string;
  fields?: RunField[];
}

// ─── Utilities ─────────────────────────────────────────────────────────────────

function fmtAmount(value: number | null | undefined): string | null {
  if (value == null || Number.isNaN(value)) return null;
  return `${(value / 1_000_000).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} M DA`;
}

function fmtDatetime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDateShort(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
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
    if (value && typeof value === "object") return [{ group, ...(value as Record<string, unknown>) }];
    return [{ group, value }];
  });
}

function coerceFieldValue(field: RunField, value: string): string | number | undefined {
  if (field.type === "number") return value === "" ? undefined : Number(value);
  return value === "" ? undefined : value;
}

function buildInitialValues(fields: RunField[]): Record<string, string> {
  return Object.fromEntries(fields.map((f) => [f.key, f.defaultValue ?? ""]));
}

type RunStatus = "succeeded" | "failed" | string;

function runStatusVariant(status: RunStatus): {
  containerCls: string;
  label: string;
  Icon: typeof CheckCircle2;
} {
  if (status === "succeeded")
    return {
      containerCls: "border-emerald-200 bg-emerald-50 text-emerald-700",
      label: "Succès",
      Icon: CheckCircle2,
    };
  if (status === "failed")
    return { containerCls: "border-red-200 bg-red-50 text-red-600", label: "Échec", Icon: XCircle };
  return { containerCls: "border-amber-200 bg-amber-50 text-amber-700", label: status, Icon: Clock };
}

// ─── DomainWorkspace ──────────────────────────────────────────────────────────

export function DomainWorkspace({
  domain,
  title,
  subtitle,
  description,
  primaryMetricLabel = "Provision estimée",
  primaryCTALabel,
  fields = [],
}: DomainWorkspaceProps) {
  const { can } = useRole();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [documents, setDocuments] = useState<DomainDocument[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [latestRun, setLatestRun] = useState<DomainRun | null>(null);
  const [resultPayload, setResultPayload] = useState<unknown>(null);
  const [rowsPayload, setRowsPayload] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() =>
    buildInitialValues(fields),
  );

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextDocs, summary] = await Promise.all([
        listDomainDocuments(domain),
        getDashboardSummary(),
      ]);
      setDocuments(nextDocs);
      setSelectedDocumentId((current) => {
        if (current && nextDocs.some((d) => d.document_id === current)) return current;
        return nextDocs[0]?.document_id ?? "";
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
      setError(
        cause instanceof ApiError ? cause.detail : "Impossible de charger les données du domaine.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [domain]);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !can("import")) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded = await uploadDomainDocument(domain, file, file.name);
      await refresh();
      setSelectedDocumentId(uploaded.document_id);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.detail : "Import impossible.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const runCalculation = async () => {
    if (!selectedDocumentId) {
      setError("Sélectionnez une source documentaire avant de lancer un calcul.");
      return;
    }
    setRunning(true);
    setError(null);
    try {
      const parameters = Object.fromEntries(
        fields
          .map((f) => [f.key, coerceFieldValue(f, fieldValues[f.key] ?? "")] as const)
          .filter((entry) => entry[1] !== undefined),
      );
      for (const field of fields) {
        if (field.required && parameters[field.key] === undefined) {
          throw new ApiError(422, `Le paramètre « ${field.label} » est requis.`);
        }
      }
      const run = await createDomainRun(domain, { document_id: selectedDocumentId, parameters });
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

  // ── Derived state ────────────────────────────────────────────────────────────
  const selectedDocument =
    documents.find((d) => d.document_id === selectedDocumentId) ?? null;
  const allRows = normalizeRows(rowsPayload);
  const previewRows = allRows.slice(0, 10);
  const rowColumns = Array.from(
    new Set(previewRows.flatMap((row) => Object.keys(row))),
  ).slice(0, 7);
  const headlineTotal = extractHeadlineTotal(resultPayload);
  const formattedTotal = fmtAmount(headlineTotal);
  const hasResult = latestRun?.status === "succeeded" && formattedTotal !== null;
  const ctaLabel = primaryCTALabel ?? `Calculer — ${domain.toUpperCase()}`;
  const runVariant = latestRun ? runStatusVariant(latestRun.status) : null;

  // ── Summary strip values ─────────────────────────────────────────────────────
  const summaryRunLabel = latestRun
    ? `${runStatusVariant(latestRun.status).label} · ${fmtDateShort(latestRun.finished_at ?? latestRun.started_at)}`
    : "Jamais effectué";

  return (
    <>
      <Topbar title={title} subtitle={subtitle} />

      <div className="px-6 lg:px-8 py-6 space-y-5 max-w-[1440px]">

        {/* ── Description + actions ──────────────────────────────── */}
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">{description}</p>
          <button
            onClick={() => void refresh()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors disabled:opacity-50 flex-shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Actualiser
          </button>
        </div>

        {/* ── Error banner ───────────────────────────────────────── */}
        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* ── Summary strip ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 rounded-xl border border-border bg-card overflow-hidden divide-x divide-y lg:divide-y-0 divide-border">
          <SummaryChip
            label="Source active"
            value={loading ? "…" : (selectedDocument?.original_filename ?? "Aucune source")}
            icon={<FileSpreadsheet className="h-3.5 w-3.5" />}
            muted={!selectedDocument}
          />
          <SummaryChip
            label="Dernier calcul"
            value={loading ? "…" : summaryRunLabel}
            icon={<Calculator className="h-3.5 w-3.5" />}
            accent={
              latestRun?.status === "succeeded"
                ? "success"
                : latestRun?.status === "failed"
                ? "danger"
                : undefined
            }
            muted={!latestRun}
          />
          <SummaryChip
            label="Lignes traitées"
            value={loading ? "…" : allRows.length > 0 ? allRows.length.toLocaleString("fr-FR") : "—"}
            icon={<FileText className="h-3.5 w-3.5" />}
            muted={allRows.length === 0}
          />
          <SummaryChip
            label="Sources disponibles"
            value={loading ? "…" : documents.length.toLocaleString("fr-FR")}
            icon={<FileSpreadsheet className="h-3.5 w-3.5" />}
            muted={documents.length === 0}
          />
        </div>

        {/* ── Main two-column work area ──────────────────────────── */}
        <div className="grid lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_420px] gap-5 items-start">

          {/* LEFT: Workflow steps */}
          <div className="space-y-3.5">

            {/* Step 1 — Source documentaire */}
            <WorkCard
              step="1"
              title="Source documentaire"
              subtitle="Sélectionnez le fichier sur lequel porter le calcul"
            >
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Chargement des sources…
                </div>
              ) : documents.length === 0 ? (
                <div className="py-6 text-center">
                  <FileSpreadsheet className="h-8 w-8 text-muted-foreground/25 mx-auto mb-2" />
                  <p className="text-sm font-medium text-muted-foreground">
                    Aucune source disponible
                  </p>
                  {can("import") && (
                    <p className="text-xs text-muted-foreground/70 mt-1 max-w-[220px] mx-auto">
                      Importez un fichier Excel pour démarrer.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  {documents.map((doc) => {
                    const active = doc.document_id === selectedDocumentId;
                    return (
                      <div
                        key={doc.document_id}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                          active
                            ? "bg-primary/5 border border-primary/15 text-foreground"
                            : "border border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        <button
                          onClick={() => setSelectedDocumentId(doc.document_id)}
                          className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
                        >
                          <span
                            className={`h-2 w-2 rounded-full flex-shrink-0 transition-colors ${
                              active ? "bg-primary" : "bg-border"
                            }`}
                          />
                          <span className="flex-1 truncate font-medium text-[13px]">
                            {doc.original_filename}
                          </span>
                          <span className="text-[11px] text-muted-foreground flex-shrink-0">
                            {fmtDateShort(doc.created_at)}
                          </span>
                        </button>
                        {active && doc.downloads && (
                          <span className="flex gap-1 flex-shrink-0">
                            {(["xlsx", "csv", "txt"] as const).map((fmt) => (
                              <button
                                key={fmt}
                                onClick={() =>
                                  void downloadAuthorizedFile(
                                    doc.downloads![fmt],
                                    doc.original_filename,
                                  )
                                }
                                className="px-1.5 py-0.5 text-[10px] rounded border border-border hover:border-primary/30 text-muted-foreground hover:text-foreground transition-colors"
                              >
                                {fmt.toUpperCase()}
                              </button>
                            ))}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {can("import") && (
                <div className={`${documents.length > 0 ? "mt-3 pt-3 border-t border-border" : ""}`}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="sr-only"
                    onChange={(e) => void handleFileChange(e)}
                    disabled={uploading}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="inline-flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border hover:border-primary/35 rounded-lg px-3 py-2 transition-colors w-full disabled:opacity-50"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Import en cours…
                      </>
                    ) : (
                      <>
                        <Upload className="h-3.5 w-3.5" />
                        Importer un nouveau fichier .xlsx
                      </>
                    )}
                  </button>
                </div>
              )}
            </WorkCard>

            {/* Step 2 — Paramètres (conditional) */}
            {fields.length > 0 && (
              <WorkCard
                step="2"
                title="Paramètres de calcul"
                subtitle="Définissez les paramètres avant d'exécuter"
              >
                <div className="grid sm:grid-cols-2 gap-3">
                  {fields.map((field) => (
                    <label key={field.key} className="block">
                      <span className="mb-1 block text-xs font-medium text-foreground">
                        {field.label}
                        {field.required && (
                          <span className="ml-0.5 text-red-500">*</span>
                        )}
                      </span>
                      {field.type === "select" ? (
                        <select
                          value={fieldValues[field.key] ?? ""}
                          onChange={(e) =>
                            setFieldValues((c) => ({
                              ...c,
                              [field.key]: e.target.value,
                            }))
                          }
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary/50"
                        >
                          <option value="">Choisir…</option>
                          {field.options?.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={field.type}
                          value={fieldValues[field.key] ?? ""}
                          onChange={(e) =>
                            setFieldValues((c) => ({
                              ...c,
                              [field.key]: e.target.value,
                            }))
                          }
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary/50"
                        />
                      )}
                    </label>
                  ))}
                </div>
              </WorkCard>
            )}

            {/* Step 3 — Lancer le calcul */}
            <WorkCard
              step={fields.length > 0 ? "3" : "2"}
              title="Lancer le calcul"
              subtitle="Exécute le moteur actuariel sur la source sélectionnée"
            >
              <button
                onClick={() => void runCalculation()}
                disabled={!can("import") || running || !selectedDocument}
                className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl px-5 py-3.5 text-sm font-semibold text-white transition-all
                  bg-primary hover:bg-primary/90 active:scale-[0.99] shadow-sm hover:shadow-md
                  disabled:cursor-not-allowed disabled:opacity-50"
              >
                {running ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Calcul en cours…
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    {ctaLabel}
                  </>
                )}
              </button>

              {!can("import") && (
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Rôle ADMIN requis pour lancer un calcul.
                </p>
              )}
              {can("import") && !selectedDocument && documents.length > 0 && (
                <p className="mt-2 text-center text-xs text-amber-600">
                  Sélectionnez une source pour activer le calcul.
                </p>
              )}
            </WorkCard>
          </div>

          {/* RIGHT: Result column */}
          <div className="space-y-3.5 lg:sticky lg:top-[5.5rem]">

            {/* ── Primary KPI hero ───────────────────────────────── */}
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              {/* Card header */}
              <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border">
                <div>
                  <div className="text-[9.5px] font-bold tracking-[0.22em] uppercase text-muted-foreground/70 mb-0.5">
                    Résultat principal
                  </div>
                  <div className="text-[15px] font-semibold text-foreground leading-tight">
                    {primaryMetricLabel}
                  </div>
                </div>
                {runVariant && latestRun && (
                  <span
                    className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border flex-shrink-0 ${runVariant.containerCls}`}
                  >
                    <runVariant.Icon className="h-3 w-3" />
                    {runVariant.label}
                  </span>
                )}
              </div>

              {/* KPI value */}
              <div className="px-5 py-10 text-center">
                {loading ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-7 w-7 text-muted-foreground/30 animate-spin" />
                    <p className="text-xs text-muted-foreground">Chargement…</p>
                  </div>
                ) : hasResult ? (
                  <>
                    {/* The result: impossible to miss */}
                    <div
                      className="text-[3.4rem] font-bold tabular-nums tracking-tight leading-none text-foreground"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {formattedTotal}
                    </div>
                    <div className="mt-3 text-xs text-muted-foreground">
                      Calculé le{" "}
                      {fmtDatetime(latestRun?.finished_at ?? latestRun?.started_at)}
                    </div>
                  </>
                ) : latestRun?.status === "failed" ? (
                  <div className="flex flex-col items-center gap-2.5">
                    <XCircle className="h-9 w-9 text-red-400" />
                    <p className="text-sm font-semibold text-red-600">Le calcul a échoué</p>
                    <p className="text-xs text-muted-foreground max-w-[220px]">
                      {latestRun.error_message ??
                        "Consultez l'onglet Artefacts pour le détail de l'erreur."}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="text-[3rem] font-bold tabular-nums text-muted-foreground/20 leading-none select-none">
                      —
                    </div>
                    <p className="text-sm text-muted-foreground max-w-[230px]">
                      Aucun résultat disponible. Sélectionnez une source et lancez le calcul
                      pour obtenir la{" "}
                      <span className="font-medium text-foreground">
                        {primaryMetricLabel.toLowerCase()}
                      </span>
                      .
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* ── Run status card ────────────────────────────────── */}
            {latestRun && (
              <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border text-sm">
                <div className="px-4 py-3 bg-muted/30">
                  <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground/60">
                    Dernier run
                  </span>
                </div>
                <RunMetaRow
                  label="Source"
                  value={
                    selectedDocument?.original_filename ?? latestRun.document_version_id
                  }
                />
                <RunMetaRow label="Démarré" value={fmtDatetime(latestRun.started_at)} />
                <RunMetaRow
                  label="Terminé"
                  value={fmtDatetime(latestRun.finished_at)}
                />
                <RunMetaRow label="Run ID" value={latestRun.run_id} mono />
                <div className="px-4 py-3 flex flex-wrap gap-1.5">
                  {(
                    [
                      {
                        label: "Résultat",
                        url: latestRun.artifacts.result,
                        file: `${domain}-result.json`,
                      },
                      {
                        label: "Lignes",
                        url: latestRun.artifacts.rows,
                        file: `${domain}-rows.json`,
                      },
                      {
                        label: "Rapport",
                        url: latestRun.artifacts.cleaning_report,
                        file: `${domain}-cleaning-report.json`,
                      },
                    ] as const
                  ).map(({ label, url, file }) => (
                    <button
                      key={label}
                      onClick={() => void downloadAuthorizedFile(url, file)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-primary/25 transition-colors bg-muted/20 hover:bg-muted/50"
                    >
                      <Download className="h-3 w-3" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Detail tabs ────────────────────────────────────────── */}
        <Tabs defaultValue="rows">
          <TabsList className="h-auto gap-0.5 p-1">
            <TabsTrigger value="rows" className="text-xs px-3.5 py-1.5">
              Aperçu des lignes calculées
              {allRows.length > 0 && (
                <span className="ml-1.5 rounded bg-muted-foreground/15 px-1.5 py-0.5 text-[10px] tabular-nums">
                  {allRows.length.toLocaleString("fr-FR")}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="artifacts" className="text-xs px-3.5 py-1.5">
              Artefacts
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs px-3.5 py-1.5">
              Historique des runs
            </TabsTrigger>
          </TabsList>

          {/* Tab: Lignes */}
          <TabsContent value="rows" className="mt-3">
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {previewRows.length === 0 ? (
                <EmptyTabState
                  icon={<FileText className="h-8 w-8 text-muted-foreground/25" />}
                  message="Aucune ligne calculée disponible."
                  hint="Lancez un calcul pour voir l'aperçu des lignes ici."
                />
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          {rowColumns.map((col) => (
                            <th
                              key={col}
                              className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap"
                            >
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {previewRows.map((row, i) => (
                          <tr key={i} className="hover:bg-muted/25 transition-colors">
                            {rowColumns.map((col) => (
                              <td
                                key={col}
                                className="px-4 py-2.5 text-foreground whitespace-nowrap"
                              >
                                {typeof row[col] === "number"
                                  ? Number(row[col]).toLocaleString("fr-FR", {
                                      maximumFractionDigits: 4,
                                    })
                                  : String(row[col] ?? "—")}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {allRows.length > 10 && (
                    <div className="border-t border-border bg-muted/20 px-4 py-2.5 text-[11px] text-muted-foreground">
                      10 premières lignes affichées sur{" "}
                      {allRows.length.toLocaleString("fr-FR")} au total.
                    </div>
                  )}
                </>
              )}
            </div>
          </TabsContent>

          {/* Tab: Artefacts */}
          <TabsContent value="artifacts" className="mt-3">
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {!latestRun ? (
                <EmptyTabState
                  icon={<Download className="h-8 w-8 text-muted-foreground/25" />}
                  message="Aucun artefact disponible."
                  hint="Les artefacts seront générés après le premier calcul."
                />
              ) : (
                <div className="p-5 space-y-4">
                  <div className="flex flex-wrap gap-2 border-b border-border pb-4">
                    {(
                      [
                        {
                          label: "Résultat JSON",
                          url: latestRun.artifacts.result,
                          file: `${domain}-result.json`,
                        },
                        {
                          label: "Lignes JSON",
                          url: latestRun.artifacts.rows,
                          file: `${domain}-rows.json`,
                        },
                        {
                          label: "Rapport de nettoyage",
                          url: latestRun.artifacts.cleaning_report,
                          file: `${domain}-cleaning-report.json`,
                        },
                      ] as const
                    ).map(({ label, url, file }) => (
                      <button
                        key={label}
                        onClick={() => void downloadAuthorizedFile(url, file)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/25 transition-colors"
                      >
                        <Download className="h-3.5 w-3.5" />
                        {label}
                      </button>
                    ))}
                  </div>
                  <div>
                    <div className="mb-2 text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground/60">
                      Résultat brut
                    </div>
                    <pre className="max-h-80 overflow-auto rounded-lg bg-slate-950 p-4 text-[11px] leading-relaxed text-slate-200">
                      {JSON.stringify(resultPayload, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Tab: Historique */}
          <TabsContent value="history" className="mt-3">
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {!latestRun ? (
                <EmptyTabState
                  icon={<Clock className="h-8 w-8 text-muted-foreground/25" />}
                  message="Aucun historique disponible."
                  hint="L'historique des calculs s'affichera ici après le premier run."
                />
              ) : (
                <div className="divide-y divide-border">
                  <div className="bg-muted/30 px-5 py-3">
                    <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground/60">
                      Runs enregistrés
                    </span>
                  </div>
                  {runVariant && (
                    <div className="flex items-center gap-4 px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border flex-shrink-0 ${runVariant.containerCls}`}
                      >
                        <runVariant.Icon className="h-3 w-3" />
                        {runVariant.label}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium text-foreground">
                          Run du {fmtDatetime(latestRun.started_at)}
                        </div>
                        <div className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                          {latestRun.run_id}
                        </div>
                      </div>
                      {formattedTotal && (
                        <div className="flex-shrink-0 text-right">
                          <div className="text-[13px] font-semibold tabular-nums text-foreground">
                            {formattedTotal}
                          </div>
                          <div className="mt-0.5 text-[10px] text-muted-foreground">
                            {primaryMetricLabel}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function SummaryChip({
  label,
  value,
  icon,
  accent,
  muted = false,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
  accent?: "success" | "danger";
  muted?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-3.5">
      <span
        className={`flex-shrink-0 transition-colors ${
          muted
            ? "text-muted-foreground/30"
            : accent === "success"
            ? "text-emerald-600"
            : accent === "danger"
            ? "text-red-500"
            : "text-primary/60"
        }`}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/55 leading-none mb-0.5">
          {label}
        </div>
        <div
          className={`truncate text-[13px] font-semibold leading-tight ${
            muted
              ? "text-muted-foreground/40"
              : accent === "success"
              ? "text-emerald-700"
              : accent === "danger"
              ? "text-red-600"
              : "text-foreground"
          }`}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

function WorkCard({
  step,
  title,
  subtitle,
  children,
}: {
  step: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border bg-muted/20 px-4 py-3.5">
        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
          {step}
        </span>
        <div>
          <div className="text-[13px] font-semibold leading-tight text-foreground">{title}</div>
          {subtitle && (
            <div className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</div>
          )}
        </div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function RunMetaRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <span className="flex-shrink-0 text-[11px] font-medium text-muted-foreground">{label}</span>
      <span
        className={`max-w-[65%] truncate text-right text-[12px] text-foreground ${
          mono ? "font-mono" : "font-medium"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function EmptyTabState({
  icon,
  message,
  hint,
}: {
  icon: ReactNode;
  message: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
      {icon}
      <p className="text-sm font-medium text-muted-foreground">{message}</p>
      {hint && (
        <p className="max-w-[280px] text-xs text-muted-foreground/60">{hint}</p>
      )}
    </div>
  );
}
