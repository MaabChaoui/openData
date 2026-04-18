import { createFileRoute } from "@tanstack/react-router";
import { DomainWorkspace } from "@/components/backend/DomainWorkspace";

export const Route = createFileRoute("/app/sap")({
  head: () => ({ meta: [{ title: "SAP — L'Algérienne Vie" }] }),
  component: SapPage,
});

function SapPage() {
  return (
    <DomainWorkspace
      domain="sap"
      title="Sinistres À Payer"
      subtitle="Évaluation des sinistres déclarés en cours de règlement"
      description="Provision SAP — couvre les sinistres déclarés mais non encore intégralement liquidés à la clôture."
      primaryMetricLabel="SAP estimée"
      primaryCTALabel="Calculer la SAP"
      fields={[
        {
          key: "closing_date",
          label: "Date de clôture",
          type: "date",
          required: true,
          defaultValue: new Date().toISOString().slice(0, 10),
        },
      ]}
    />
  );
}
