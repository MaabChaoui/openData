import { createFileRoute } from "@tanstack/react-router";
import { DomainWorkspace } from "@/components/backend/DomainWorkspace";

export const Route = createFileRoute("/app/ibnr")({
  head: () => ({ meta: [{ title: "IBNR — Backend connecté" }] }),
  component: IbnrPage,
});

function IbnrPage() {
  return (
    <DomainWorkspace
      domain="ibnr"
      title="Atelier IBNR"
      subtitle="IBNR · documents, runs et résultats backend"
      description="Cette page est reliée aux runs IBNR de l'API, y compris les artefacts JSON et l'aperçu des lignes calculées."
      fields={[
        {
          key: "closing_year",
          label: "Année de clôture",
          type: "number",
          defaultValue: String(new Date().getFullYear()),
        },
        {
          key: "segment_by",
          label: "Segmenter par",
          type: "select",
          options: [
            { label: "Aucun", value: "" },
            { label: "Produit", value: "product" },
          ],
        },
      ]}
    />
  );
}
