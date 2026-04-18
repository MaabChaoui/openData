import { createFileRoute } from "@tanstack/react-router";
import { DomainWorkspace } from "@/components/backend/DomainWorkspace";

export const Route = createFileRoute("/app/ppna")({
  head: () => ({ meta: [{ title: "PPNA — L'Algérienne Vie" }] }),
  component: PpnaPage,
});

function PpnaPage() {
  return (
    <DomainWorkspace
      domain="ppna"
      title="Primes Non Acquises"
      subtitle="Calcul de la fraction de prime correspondant à la période non couverte"
      description="Provision pour primes non acquises — fraction des primes émises rattachée aux exercices futurs."
      primaryMetricLabel="PPNA estimée"
      primaryCTALabel="Calculer la PPNA"
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
