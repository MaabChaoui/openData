import { useEffect, useState } from "react";
import { Activity, LockKeyhole, Server, ShieldCheck } from "lucide-react";
import { ApiError, getApiBaseUrl, getHealth } from "@/lib/backend-api";
import { useRole } from "@/lib/roles";

type Mode = "login" | "bootstrap";

export function AuthGate() {
  const { login, bootstrap } = useRole();
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("secret123");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<"checking" | "online" | "offline">("checking");

  useEffect(() => {
    let active = true;
    void getHealth()
      .then(() => {
        if (active) setHealth("online");
      })
      .catch(() => {
        if (active) setHealth("offline");
      });
    return () => {
      active = false;
    };
  }, []);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      if (mode === "login") {
        await login(username, password);
      } else {
        await bootstrap(username, password);
      }
    } catch (cause) {
      if (cause instanceof ApiError) {
        setError(cause.detail);
      } else {
        setError("Impossible de contacter le backend.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[1.15fr_0.85fr]">
        <section className="relative overflow-hidden bg-gradient-hero px-8 py-14 text-white lg:px-14">
          <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "30px 30px" }} />
          <div className="relative mx-auto flex h-full max-w-2xl flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-gold">
                <ShieldCheck className="h-3.5 w-3.5" />
                Frontend connecté au backend
              </div>
              <h1 className="mt-6 font-display text-5xl leading-tight">
                L'Algérienne Vie
                <span className="block text-gold">Plateforme technique</span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-white/72">
                Authentifiez-vous pour charger des classeurs, lancer les calculs disponibles et consulter les bilans, documents et traces d'audit déjà exposés par l'API.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                ["Documents", "Upload XLSX versionné par domaine"],
                ["Calculs", "Runs synchrones PPNA, SAP, PE, PB, IBNR"],
                ["Traçabilité", "Audit, bilan courant et historique"],
              ].map(([title, body]) => (
                <div key={title} className="rounded-2xl border border-white/12 bg-white/8 p-4 backdrop-blur-sm">
                  <div className="text-sm font-semibold text-white">{title}</div>
                  <div className="mt-1 text-sm text-white/62">{body}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center px-6 py-10 lg:px-10">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-7 shadow-elegant">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-foreground">Accès API</div>
                <div className="text-xs text-muted-foreground">Base: {getApiBaseUrl()}</div>
              </div>
              <div
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  health === "online"
                    ? "bg-emerald-50 text-emerald-700"
                    : health === "offline"
                    ? "bg-red-50 text-red-600"
                    : "bg-amber-50 text-amber-700"
                }`}
              >
                <Server className="h-3.5 w-3.5" />
                {health === "checking" ? "Vérification" : health === "online" ? "En ligne" : "Hors ligne"}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-muted p-1">
              <button
                onClick={() => setMode("login")}
                className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${mode === "login" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
              >
                Connexion
              </button>
              <button
                onClick={() => setMode("bootstrap")}
                className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${mode === "bootstrap" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
              >
                Initialisation
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-foreground">Nom d'utilisateur</span>
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-gold"
                  placeholder="admin"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-foreground">Mot de passe</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-gold"
                  placeholder="••••••••"
                />
              </label>
            </div>

            {error && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              onClick={submit}
              disabled={submitting || !username || !password}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-primary px-4 py-3 text-sm font-semibold text-white shadow-soft transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <Activity className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
              {mode === "login" ? "Se connecter" : "Créer le premier administrateur"}
            </button>

            <div className="mt-4 text-xs leading-6 text-muted-foreground">
              {mode === "login"
                ? "Utilisez un compte existant créé côté backend."
                : "Utilisez cette action uniquement si la base est vide. Si un administrateur existe déjà, l'API renverra un conflit."}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
