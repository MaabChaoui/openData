import { createFileRoute } from "@tanstack/react-router";
import { DomainWorkspace } from "@/components/backend/DomainWorkspace";

export const Route = createFileRoute("/app/pb")({
  head: () => ({ meta: [{ title: "PB — Backend connecté" }] }),
  component: PbPage,
});

function PbPage() {
  return (
    <DomainWorkspace
      domain="pb"
      title="Participation aux Bénéfices"
      subtitle="PB · documents, runs et résultats backend"
      description="Le frontend exploite ici le flux backend existant: documents versionnés, exécution PB et restitution des artefacts."
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
