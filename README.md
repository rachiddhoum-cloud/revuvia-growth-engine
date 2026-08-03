# Revuvia Growth Engine

Outil ops interne Revuvia : pipeline contenu, GSC, crons, approvals.

**Production :** https://revuvia-growth-engine.vercel.app

## Prérequis

- Node.js 20+
- Projet Supabase partagé Revuvia-RLB
- Variables d'environnement (voir `.env.example`)

## Setup local

```bash
cp .env.example .env.local
# Remplir Supabase, DEFAULT_OWNER_ID, CRON_SECRET, OPS_ACCESS_PASSWORD
npm install
npm run ops:session-token   # copier la sortie dans OPS_SESSION_TOKEN
npm run dev
```

Ouvrir http://localhost:3000/login avec le mot de passe `OPS_ACCESS_PASSWORD`.

## Sécurité production

| Variable | Obligatoire prod | Description |
|----------|------------------|-------------|
| `CRON_SECRET` | Oui | Bearer pour crons Vercel (min 16 car.) |
| `OPS_ACCESS_PASSWORD` | Oui | Mot de passe page `/login` |
| `OPS_SESSION_TOKEN` | Oui | Token cookie (dérivé via `npm run ops:session-token`) |

Les APIs (sauf `/api/health`, `/api/gsc/callback`, `/api/ops/login`) exigent une session ops ou un secret cron valide.

## Scripts

| Commande | Usage |
|----------|-------|
| `npm run dev` | Dev local |
| `npm run build` | Build production |
| `npm run test:unit` | Tests Vitest |
| `npm run ops:session-token` | Génère `OPS_SESSION_TOKEN` |
| `npm run db:push` | Applique migrations Supabase |

## Déploiement

```bash
npm run test:unit
npm run build
vercel deploy --prod --yes
```

Après déploiement, configurer `OPS_ACCESS_PASSWORD` + `OPS_SESSION_TOKEN` sur Vercel si absent.

## Structure

- `src/app/(app)/` — UI ops (dashboard, settings, approvals)
- `src/app/api/` — Routes API + crons
- `src/lib/` — Pipelines GSC, content, ops, sales
- `supabase/migrations/` — Schéma DB Growth Engine
