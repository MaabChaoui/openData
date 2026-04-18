import { createFileRoute } from "@tanstack/react-router";
import { DomainWorkspace } from "@/components/backend/DomainWorkspace";

export const Route = createFileRoute("/app/pe")({
  head: () => ({ meta: [{ title: "PE — Backend connecté" }] }),
  component: PePage,
});

function PePage() {
  return (
    <DomainWorkspace
      domain="pe"
      title="Provision d'Égalisation"
      subtitle="PE · documents, runs et résultats backend"
      description="Cette vue s'appuie directement sur les endpoints PE disponibles pour les uploads, runs et artefacts."
      fields={[
        {
          key: "positive_result_coefficient",
          label: "Coefficient résultat positif",
          type: "number",
          defaultValue: "0.95",
        },
        {
          key: "historical_average_coefficient",
          label: "Coefficient moyenne historique",
          type: "number",
          defaultValue: "1",
        },
      ]}
    />
  );
}
