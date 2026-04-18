import { createFileRoute } from "@tanstack/react-router";
import { DomainWorkspace } from "@/components/backend/DomainWorkspace";

export const Route = createFileRoute("/app/pb")({
  head: () => ({ meta: [{ title: "PB — L'Algérienne Vie" }] }),
  component: PbPage,
});

function PbPage() {
  return (
    <DomainWorkspace
      domain="pb"
      title="Participation aux Bénéfices"
      subtitle="Quote-part des résultats techniques attribuée aux assurés"
      description="Provision PB — part des bénéfices techniques et financiers contractuellement reversée aux assurés."
      primaryMetricLabel="PB estimée"
      primaryCTALabel="Calculer la PB"
      fields={[
        {
          key: "default_loss_ratio_threshold",
          label: "Seuil de loss ratio",
          type: "number",
          defaultValue: "0.7",
        },
        {
          key: "default_pb_rate",
          label: "Taux PB par défaut",
          type: "number",
          defaultValue: "0.85",
        },
      ]}
    />
  );
}
