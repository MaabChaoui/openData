import { createFileRoute } from "@tanstack/react-router";
import { DomainWorkspace } from "@/components/backend/DomainWorkspace";

export const Route = createFileRoute("/app/sap")({
  head: () => ({ meta: [{ title: "SAP — Backend connecté" }] }),
  component: SapPage,
});

function SapPage() {
  return (
    <DomainWorkspace
      domain="sap"
      title="Sinistres À Payer"
      subtitle="SAP · documents, runs et résultats backend"
      description="Le backend fournit désormais le stockage des classeurs SAP, les runs de calcul et leurs téléchargements."
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
