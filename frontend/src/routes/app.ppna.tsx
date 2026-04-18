import { createFileRoute } from "@tanstack/react-router";
import { DomainWorkspace } from "@/components/backend/DomainWorkspace";

export const Route = createFileRoute("/app/ppna")({
  head: () => ({ meta: [{ title: "PPNA — Backend connecté" }] }),
  component: PpnaPage,
});

function PpnaPage() {
  return (
    <DomainWorkspace
      domain="ppna"
      title="Primes Non Acquises"
      subtitle="PPNA · documents, runs et résultats backend"
      description="Le frontend consomme maintenant le catalogue documentaire, les runs et les artefacts PPNA exposés par l'API."
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
