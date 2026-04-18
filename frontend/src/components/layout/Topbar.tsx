import { useState } from "react";
import { Bell, Calendar, ChevronDown, LogOut, Search } from "lucide-react";
import { useRole } from "@/lib/roles";

export function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  const { info, user, logout } = useRole();
  const [open, setOpen] = useState(false);
  const Icon = info.icon;

  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <header className="sticky top-0 z-30 bg-card/95 backdrop-blur-md border-b border-border">
      <div className="flex items-center gap-4 px-6 lg:px-8 h-[4.5rem]">
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-[1.5rem] font-semibold text-foreground truncate leading-tight tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[11px] text-muted-foreground truncate mt-0.5 tracking-wide">{subtitle}</p>
          )}
        </div>

        <div className="hidden xl:flex items-center gap-1.5 text-[11px] text-primary/65 bg-primary/5 px-3 py-1.5 rounded-full border border-primary/10 font-medium">
          <Calendar className="h-3 w-3 text-gold" />
          <span className="capitalize">{today}</span>
        </div>

        <div className="hidden md:flex items-center gap-2 bg-muted/60 px-3.5 py-2 rounded-lg border border-primary/15 hover:border-gold/50 focus-within:border-gold/60 focus-within:bg-card transition-all w-72 shadow-xs">
          <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <input
            placeholder="Documents, runs, domaines..."
            className="bg-transparent outline-none text-sm flex-1 text-foreground placeholder:text-muted-foreground/55"
          />
        </div>

        <button className="relative h-9 w-9 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-all border border-transparent hover:border-gold/25 hover:shadow-sm">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-[7px] w-[7px] rounded-full bg-gold ring-2 ring-card shadow-sm" />
        </button>

        <div className="relative">
          <button
            onClick={() => setOpen((current) => !current)}
            className="flex items-center gap-3 pl-2 pr-3 py-1.5 rounded-xl hover:bg-muted transition-all border border-transparent hover:border-border hover:shadow-sm"
          >
            <div
              className="h-8 w-8 rounded-full flex items-center justify-center shadow-sm ring-2 ring-gold/20"
              style={{ background: "var(--gradient-hero)" }}
            >
              <Icon className="h-4 w-4 text-gold" />
            </div>
            <div className="hidden md:block text-left leading-tight">
              <div className="text-[13px] font-semibold text-foreground">{user?.username ?? info.user}</div>
              <div className="text-[10px] text-muted-foreground font-medium">{info.label}</div>
            </div>
            <ChevronDown
              className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            />
          </button>

          {open && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
              <div className="absolute right-0 mt-2 w-72 bg-card border border-border rounded-2xl shadow-elegant overflow-hidden z-50">
                <div className="relative px-4 py-3.5 border-b border-border overflow-hidden">
                  <div className="text-[9.5px] tracking-[0.22em] uppercase text-muted-foreground font-bold">
                    Session backend
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  <div className="rounded-xl border border-border bg-muted/35 p-3">
                    <div className="text-sm font-semibold text-foreground">{user?.username ?? info.user}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{info.description}</div>
                    <div className="mt-2 text-[11px] text-muted-foreground">
                      Rôle API: <span className="font-semibold text-foreground">{user?.role ?? info.backendRole}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Statut: <span className="font-semibold text-foreground">{user?.status ?? "N/A"}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setOpen(false);
                      void logout();
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                  >
                    <LogOut className="h-4 w-4" />
                    Déconnexion
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="h-[2px] bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
    </header>
  );
}
