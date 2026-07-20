# ONA Eye Health — Backend API

Production-ready REST API for the **ONA Eye Health** platform. It serves the mobile
application, persists clinical screening records in MongoDB, and is the **only** system
authorized to write anonymized statistics to the StarkNet **ImpactRegistry v2** contract.

The public website reads dashboards **directly from the blockchain** and never touches
this database.

## Architecture

```
Mobile App ──REST/JWT──▶ ONA API ──┬──▶ MongoDB (screenings, clinics, patients, users, blockchain refs, audit)
                                    └──▶ StarkNet ImpactRegistry v2 (anchor + register_facility)

Website ──read-only RPC──▶ StarkNet ImpactRegistry v2
```

- Only the backend holds the contract owner key and performs on-chain writes.
- Patient PHI stays in MongoDB; only anonymized aggregates go on-chain.
- The website reads aggregate stats on-chain for transparency.

## Tech stack

- NestJS 10 (modular, clean architecture, SOLID)
- MongoDB + Mongoose 8
- JWT auth (access + refresh) with role-based access control
- class-validator DTOs, global validation + error envelope
- pino structured logging, Swagger/OpenAPI docs at `/docs`
- starknet.js 10 for on-chain integration
- Docker + docker-compose, GitHub Actions CI, Jest unit + e2e tests

## Modules

`auth`, `users`, `clinics`, `patients`, `screenings` (+ AI results), `blockchain`,
`uploads`, `dashboard`, `statistics`, `audit-logs`, `health`.

## Getting started

```bash
cp .env.example .env      # fill in JWT secrets + STARKNET_OWNER_PRIVATE_KEY
npm install
npm run start:dev         # http://localhost:3000/api  (docs: /docs)
```

Or with Docker:

```bash
docker compose up --build
```

To run without touching the chain (new screenings are marked `disabled` instead of
`pending`, and the anchor worker stays idle), set `BLOCKCHAIN_ENABLED=false`.

## StarkNet contract

- Network: Starknet Sepolia
- ImpactRegistry v2: `0x60992a96095dded8c0b44485cf793bff9692e228cb55730f5e92b2351405289`
- Owner: `0x014e9e2266c735c78e602ee828a50971e4aaa78b487fe47fc998444645b8e2bd`

The Cairo source lives in the mobile repo at `contracts/` (`ona`).

## Tests

```bash
npm test          # unit
npm run test:e2e  # integration (in-memory MongoDB)
```

## Key endpoints

- `POST /api/auth/login`, `POST /api/auth/refresh`, `GET /api/auth/me`
- `GET /api/clinics`, `POST /api/clinics` (admin, registers facility on-chain)
- CRUD `/api/patients`, `/api/users`
- `POST /api/screenings`, `POST /api/screenings/sync`, `GET /api/screenings/:id/blockchain`
- `POST /api/uploads`, `GET /api/uploads/:id`
- `GET /api/dashboard/summary` (admin, from MongoDB)
- `GET /api/statistics/overview`, `/api/statistics/by-clinic`, `/api/statistics/timeseries` (admin/supervisor)
- `GET /api/audit-logs` (admin)
- `GET /api/blockchain/status`, `GET /api/blockchain/tx/:hash`
- `GET /api/health`

## Anchoring pipeline

Screenings are persisted immediately and anchored to StarkNet asynchronously so the
mobile request is never blocked on the chain:

1. `POST /api/screenings` (or `/sync`) saves the record with `blockchain.status=pending`.
2. The record is enqueued; a Poseidon proof of anonymized fields (timestamp, risk, facility)
   is submitted via `anchor_screening`.
3. On success the tx hash, block number, fee, and proof are written back to the record
   (`status=anchored`). Failures are retried by a periodic sweep (up to 5 attempts).
4. Offline batches are idempotent per `sync.clientRecordId`.

## License

Apache-2.0 — WEZA LAB — ONA
