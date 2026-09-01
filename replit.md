# MarketNest Marketplace

MarketNest is a curated marketplace where shoppers browse products, manage a basket, and place orders while shopkeepers manage the catalog and recent orders.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/marketnest run dev` — run the web app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/marketnest` — React/Vite storefront, basket, checkout, and admin UI
- `artifacts/api-server/src/routes/marketplace.ts` — marketplace API routes and seed data
- `lib/api-spec/openapi.yaml` — source of truth for marketplace API contracts
- `lib/db/src/schema/marketplace.ts` — PostgreSQL schema for products, orders, and order items

## Architecture decisions

- The shopper basket is local browser state; products and orders are persisted in PostgreSQL through the shared API server.
- Product prices and order totals use PostgreSQL numeric columns and are converted to numbers at the API response boundary.
- Historical order items keep their product name and price snapshot so catalog edits do not rewrite old orders.

## Product

- Curated catalog with search and seeded starter products
- Basket quantity controls, removal, totals, and checkout
- Order creation with customer delivery details
- Admin catalog CRUD, order list/status updates, and summary metrics

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Run API codegen after changing `lib/api-spec/openapi.yaml`.
- The frontend build expects workflow-provided `PORT` and `BASE_PATH`; use the managed web workflow for previews.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
