import { createFileRoute } from "@tanstack/react-router";
import { DomainWorkspace } from "@/components/backend/DomainWorkspace";

export const Route = createFileRoute("/app/pe")({
  head: () => ({ meta: [{ title: "PE — L'Algérienne Vie" }] }),
  component: PePage,
});

function PePage() {
  return (
    <DomainWorkspace
      domain="pe"
      title="Provision d'Égalisation"
      subtitle="Lissage des résultats techniques sur plusieurs exercices"
      description="Provision destinée à faire face aux fluctuations de sinistralité — constituée en période favorable."
      primaryMetricLabel="PE estimée"
      primaryCTALabel="Calculer la PE"
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
