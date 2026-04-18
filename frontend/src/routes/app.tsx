import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AuthGate } from "@/components/backend/AuthGate";
import { Sidebar } from "@/components/layout/Sidebar";
import { useRole } from "@/lib/roles";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { initializing, isAuthenticated } = useRole();

  if (initializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="rounded-2xl border border-border bg-card px-6 py-4 text-sm text-muted-foreground shadow-soft">
          Initialisation de la session backend...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthGate />;
  }

  return (
    <div className="h-screen flex overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
