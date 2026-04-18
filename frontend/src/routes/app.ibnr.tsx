import { createFileRoute } from "@tanstack/react-router";
import { DomainWorkspace } from "@/components/backend/DomainWorkspace";

export const Route = createFileRoute("/app/ibnr")({
  head: () => ({ meta: [{ title: "IBNR — L'Algérienne Vie" }] }),
  component: IbnrPage,
});

function IbnrPage() {
  return (
    <DomainWorkspace
      domain="ibnr"
      title="Sinistres Tardifs"
      subtitle="Estimation des sinistres survenus mais non encore déclarés"
      description="Provision IBNR — réservation des sinistres survenus et non déclarés à la date de clôture."
      primaryMetricLabel="IBNR estimée"
      primaryCTALabel="Calculer l'IBNR"
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
