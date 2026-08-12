import Link from "next/link";

import { buildGscConnectToken } from "@/lib/gsc/connect-link";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Connecter Google Search Console",
  description: "Autorisez Revuvia Growth Engine à lire vos données Search Console.",
};

interface ConnectGscPageProps {
  searchParams: Promise<{ status?: string; reason?: string }>;
}

/** Page publique — pas de login ops requis. */
export default async function ConnectGscPage({ searchParams }: ConnectGscPageProps) {
  const { status, reason } = await searchParams;
  const token = buildGscConnectToken();
  const connectHref = token
    ? `/api/public/gsc-connect?token=${encodeURIComponent(token)}`
    : null;

  if (status === "connected") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
        <div className="w-full max-w-md rounded-xl border border-emerald-200 bg-white p-8 shadow-sm dark:border-emerald-900 dark:bg-zinc-900">
          <h1 className="text-xl font-semibold text-emerald-700 dark:text-emerald-400">
            Search Console connecté
          </h1>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            Revuvia Growth Engine peut maintenant synchroniser vos données SEO (revuvia.com).
            Le prochain sync automatique tournera à 9h UTC, ou demandez une relance au fondateur.
          </p>
          <Link
            href="/connect-gsc"
            className="mt-6 inline-block text-sm font-medium text-zinc-900 underline dark:text-zinc-100"
          >
            Reconnecter un autre compte
          </Link>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
        <div className="w-full max-w-md rounded-xl border border-red-200 bg-white p-8 shadow-sm dark:border-red-900 dark:bg-zinc-900">
          <h1 className="text-xl font-semibold text-red-700 dark:text-red-400">Connexion échouée</h1>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            Raison : <code className="text-xs">{reason ?? "inconnue"}</code>
          </p>
          <p className="mt-3 text-xs text-zinc-500">
            Si Google affiche « accès bloqué », utilisez Chrome → Avancé → Accéder. Vérifiez que
            rachiddhoum@gmail.com a accès à revuvia.com dans Search Console.
          </p>
          {connectHref ? (
            <Link
              href={connectHref}
              className="mt-6 flex w-full items-center justify-center rounded-lg bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Réessayer avec Google
            </Link>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Connecter Google Search Console
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          Autorisez l&apos;accès en lecture seule à <strong>revuvia.com</strong> pour alimenter le
          moteur SEO (requêtes, pages, CTR, positions).
        </p>

        {connectHref ? (
          <Link
            href={connectHref}
            className="mt-6 flex w-full items-center justify-center rounded-lg bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Continuer avec Google
          </Link>
        ) : (
          <p className="mt-6 text-sm text-red-600">
            Configuration serveur incomplète (CRON_SECRET / GSC). Contactez le support.
          </p>
        )}

        <ol className="mt-6 list-decimal space-y-2 pl-5 text-xs text-zinc-500 dark:text-zinc-400">
          <li>Ouvrez cette page dans <strong>Chrome</strong> ou <strong>Edge</strong> (pas Cursor).</li>
          <li>Choisissez <strong>rachiddhoum@gmail.com</strong>.</li>
          <li>Cliquez <strong>Autoriser</strong> (accès Search Console en lecture).</li>
          <li>Si Google affiche « app non validée », cliquez <strong>Avancé → Accéder</strong>.</li>
        </ol>
      </div>
    </div>
  );
}
