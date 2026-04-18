import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download, FileSpreadsheet, Search } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Badge, SectionCard } from "@/components/ui/kpi-card";
import { FileUploadZone } from "@/components/ui/file-upload-zone";
import {
  ApiError,
  downloadAuthorizedFile,
  searchDocuments,
  uploadDomainDocument,
  type Domain,
  type DomainDocument,
} from "@/lib/backend-api";
import { useRole } from "@/lib/roles";

export const Route = createFileRoute("/app/import")({
  head: () => ({ meta: [{ title: "Import & validation — L'Algérienne Vie" }] }),
  component: ImportPage,
});

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("fr-FR");
}

function ImportPage() {
  const { can } = useRole();
  const [documents, setDocuments] = useState<DomainDocument[]>([]);
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState<Domain>("ppna");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async (nextQuery = query) => {
    setLoading(true);
    setError(null);
    try {
      const payload = await searchDocuments(nextQuery);
      setDocuments(payload);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.detail : "Impossible de charger le catalogue documentaire.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh("");
  }, []);

  const handleUpload = async (_buffer: ArrayBuffer, file: File) => {
    if (!can("import")) return;
    setUploading(true);
    setError(null);
    try {
      await uploadDomainDocument(domain, file, file.name);
      await refresh();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.detail : "Upload impossible.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <Topbar title="Import & validation des données" subtitle="Catalogue documentaire backend par domaine" />
      <div className="p-6 lg:p-8 space-y-6">
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          <SectionCard title="Upload vers le backend" description="Le backend attend un corps XLSX brut avec le nom de fichier en query string">
            {can("import") ? (
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-foreground">Domaine cible</label>
                  <select
                    value={domain}
                    onChange={(event) => setDomain(event.target.value as Domain)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-gold"
                  >
                    {(["ppna", "sap", "pe", "pb", "ibnr"] as const).map((value) => (
                      <option key={value} value={value}>{value.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
                <FileUploadZone
                  onFile={(buffer, file) => void handleUpload(buffer, file)}
                  loading={uploading}
                  error={null}
                  title="Déposer un fichier Excel"
                  description="Le fichier sera versionné dans le domaine choisi et immédiatement visible dans le catalogue."
                />
              </div>
            ) : (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                Ce compte ne peut pas importer. Le backend réserve cette action au rôle `ADMIN`.
              </div>
            )}
          </SectionCard>

          <SectionCard title="Recherche" description="Interroge `/documents/search` sur tous les domaines" className="lg:col-span-2">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex-1 flex items-center gap-2 rounded-xl border border-border bg-background px-3">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void refresh(event.currentTarget.value);
                    }
                  }}
                  placeholder="Nom de fichier ou fragment"
                  className="w-full bg-transparent py-2.5 text-sm outline-none"
                />
              </div>
              <button
                onClick={() => void refresh()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-primary px-4 py-2.5 text-sm font-semibold text-white"
              >
                <Search className="h-4 w-4" />
                Rechercher
              </button>
            </div>

            <div className="mt-5 grid sm:grid-cols-3 gap-3">
              {[
                ["Documents", String(documents.length)],
                ["Domaines couverts", String(new Set(documents.map((document) => document.domain)).size)],
                ["Mode", can("import") ? "administration" : "lecture"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-border bg-background px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
                  <div className="mt-2 font-display text-2xl text-foreground">{value}</div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Catalogue des documents" description="Résultats agrégés backend, tous domaines confondus">
          {loading ? (
            <div className="text-sm text-muted-foreground">Chargement du catalogue...</div>
          ) : documents.length === 0 ? (
            <div className="text-sm text-muted-foreground">Aucun document trouvé.</div>
          ) : (
            <div className="space-y-3">
              {documents.map((document) => (
                <div key={document.document_id} className="flex flex-col gap-3 rounded-2xl border border-border bg-background px-4 py-4 lg:flex-row lg:items-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/8 text-primary">
                    <FileSpreadsheet className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-foreground">{document.original_filename}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {document.document_id} · {fmtDate(document.created_at)} · version {document.current_version_id}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="info">{document.domain.toUpperCase()}</Badge>
                    <Badge variant="gold">{document.status}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {document.downloads ? (
                      <>
                        <button
                          onClick={() => void downloadAuthorizedFile(document.downloads!.xlsx, document.original_filename)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-foreground hover:border-gold/35"
                        >
                          <Download className="h-3.5 w-3.5" />
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
                      <span className="text-xs text-muted-foreground">Téléchargements disponibles dans la fiche domaine.</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </>
  );
}
