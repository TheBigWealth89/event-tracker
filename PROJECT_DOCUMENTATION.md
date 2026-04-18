# Event Tracker — End-to-End Codebase Documentation

> A real-time event ingestion and analytics system built with Node.js, Redis Streams, PostgreSQL (TimescaleDB), Socket.IO, and Docker.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Directory Structure](#3-directory-structure)
4. [End-to-End Data Flow](#4-end-to-end-data-flow)
5. [Module Deep Dives](#5-module-deep-dives)
   - [Entry Point — `src/index.ts`](#51-entry-point--srcindexts)
   - [Config — `src/config/loadEnv.ts`](#52-config--srcconfigloadenvts)
   - [Database — `src/db/connection.ts`](#53-database--srcdbconnectionts)
   - [Router — `src/router/eventTracker.ts`](#54-router--srcroutereventtrackersts)
   - [Schema — `src/schema/eventSchema.ts`](#55-schema--srcschemaeventschema ts)
   - [Middleware — `src/middleware/validation.middleware.ts`](#56-middleware--srcmiddlewarevalidationmiddlewarets)
   - [Worker — `src/workers/index.ts`](#57-worker--srcworkersindexts)
   - [Sockets — `src/sockets/index.ts`](#58-sockets--srcsocketsindexts)
   - [Logger — `src/utils/logger.ts`](#59-logger--srcutilsloggerts)
   - [Dashboard UI — `src/public/index.html`](#510-dashboard-ui--srcpublicindexhtml)
   - [Dashboard Logic — `src/public/js/dashboard.js`](#511-dashboard-logic--srcpublicjsdashboardjs)
6. [Database Schema — `sql/init.sql`](#6-database-schema--sqlinitsql)
7. [Docker & Containerization](#7-docker--containerization)
8. [CI/CD — GitHub Actions](#8-cicd--github-actions)
9. [NPM Scripts Reference](#9-npm-scripts-reference)
10. [Environment Variables](#10-environment-variables)
11. [Key Redis Concepts Used](#11-key-redis-concepts-used)
12. [Dependency Map](#12-dependency-map)

---

## 1. Project Overview

**Event Tracker** is a distributed, real-time analytics backend. Its core job is:

1. **Accept** arbitrary user/browser events over an HTTP API (`POST /track`).
2. **Buffer** those events in a **Redis Stream** — a durable, ordered log.
3. **Process** the stream in a background **Worker** that aggregates counts and persists them to **TimescaleDB** (PostgreSQL with time-series extensions).
4. **Broadcast** live updates to connected browsers via **Socket.IO** using Redis Pub/Sub.
5. **Display** the live aggregated counts on a client-side rendered **dashboard** (`GET /dashboard`).

The system is split into two independent processes:

| Process | Start command | Purpose |
|---|---|---|
| **API Server** | `npm run dev` | HTTP server + Socket.IO gateway |
| **Worker** | `npm run dev:worker` | Streams consumer + DB writer |

Both processes talk to the same **Redis** instance and **PostgreSQL** database, but they run independently and can be scaled or restarted separately.

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT / BROWSER                              │
│                                                                         │
│  POST /track ──────────────────────────────────────────► API Server     │
│  GET  /dashboard ──────────────────────────────────────► API Server     │
│  WebSocket (socket.io) ◄───────────────────────────────── API Server    │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │
                   ┌───────────────▼───────────────┐
                   │        API SERVER             │
                   │  (src/index.ts + router)      │
                   │                               │
                   │  ┌─────────────────────────┐  │
                   │  │  Express HTTP Server    │  │
                   │  │  + Socket.IO            │  │
                   │  └──────────┬──────────────┘  │
                   │             │  xadd            │
                   └─────────────┼──────────────────┘
                                 │
              ┌──────────────────▼──────────────────────┐
              │              REDIS                       │
              │                                         │
              │  Stream key: "events"                   │
              │  Hash key:   "analytics:event_counts"   │
              │  String key: "analytics_worker:last_id" │
              │  Channel:    "analytics-update" (PubSub)│
              └──────┬───────────────────────┬──────────┘
                     │ xread (blocking)      │ subscribe
                     │                       │
       ┌─────────────▼──────────┐   ┌────────▼──────────────────┐
       │    WORKER PROCESS      │   │  API Server (subscriber)   │
       │  (src/workers/index.ts)│   │  (src/sockets/index.ts)    │
       │                        │   │                            │
       │  - Reads stream        │   │  - Receives publish msg    │
       │  - Aggregates counts   │   │  - Emits via Socket.IO to  │
       │  - Publishes to PubSub │   │    all connected browsers  │
       │  - Writes to Postgres  │   └────────────────────────────┘
       └─────────┬──────────────┘
                 │ INSERT / UPSERT
       ┌─────────▼──────────────┐
       │  PostgreSQL / TimescaleDB  │
       │  Table: event_counts   │
       └────────────────────────┘
```

---

## 3. Directory Structure

```
event-tracker/
│
├── docker/                       # Docker build definitions
│   ├── api.Dockerfile            # API service Dockerfile
│   └── worker.Dockerfile         # Worker service Dockerfile
│
├── src/                          # All TypeScript source code
│   ├── index.ts                  # Main entry point (API server bootstrap)
│   │
│   ├── config/
│   │   └── loadEnv.ts            # .env loader (skipped in production)
│   │
│   ├── db/
│   │   └── connection.ts         # PostgreSQL pool + Redis client (shared)
│   │
│   ├── router/
│   │   └── eventTracker.ts       # Express routes: POST /track, GET /dashboard
│   │
│   ├── schema/
│   │   └── eventSchema.ts        # Zod schema for incoming event payloads
│   │
│   ├── middleware/
│   │   └── validation.middleware.ts  # Generic Zod validation middleware
│   │
│   ├── workers/
│   │   └── index.ts              # Background worker: stream consumer + DB writer
│   │
│   ├── sockets/
│   │   └── index.ts              # Socket.IO init + Redis Pub/Sub subscriber
│   │
│   ├── utils/
│   │   └── logger.ts             # Winston logger (console + file transports)
│   │
│   ├── public/
│   │   ├── index.html            # Static HTML dashboard UI
│   │   ├── style.css             # Dashboard CSS (dark/glassmorphism theme)
│   │   └── js/
│   │       └── dashboard.js      # Client-side render + Socket.IO logic
│
├── sql/
│   └── init.sql                  # TimescaleDB table creation + hypertable setup
│
├── .github/
│   └── workflows/
│       └── ci.yml                # GitHub Actions CI (build, test, lint)
│
├── logs/                         # Winston log output (error.log, combined.log)
├── dist/                         # Compiled JavaScript output (from tsc)
│
├── .env                          # Local secrets (not committed to git)
├── .example.env                  # Template for env variables
├── docker-compose.yml            # Orchestrates API + Worker containers
├── tsconfig.json                 # TypeScript compiler configuration
├── package.json                  # NPM scripts and dependencies
├── eslint.config.mjs             # ESLint rules
├── .prettierrc                   # Prettier formatting rules
└── test_track.sh                 # Shell script for manual event testing
```

---

## 4. End-to-End Data Flow

### Step 1 — Client sends an event

A client (browser, curl, test script) sends an HTTP `POST` request:

```http
POST /track HTTP/1.1
Content-Type: application/json

{
  "eventName": "page_view",
  "url": "/home",
  "userId": "u-123",
  "metadata": { "browser": "Chrome" }
}
```

### Step 2 — Validation Middleware runs

`validate(trackEventSchema)` in `validation.middleware.ts` calls `schema.safeParse(req.body)`.

- **If invalid** → responds `400` with field-level error details (from Zod's `flatten()`).
- **If valid** → replaces `req.body` with the sanitized+typed data and calls `next()`.

### Step 3 — Event written to Redis Stream

The route handler in `router/eventTracker.ts` calls:

```ts
redisClient.xadd(
  "events",     // Stream key
  "*",          // Auto-generate entry ID (timestamp-based)
  "userId",     eventPayload.userId,
  "eventName",  eventPayload.eventName,
  "url",        eventPayload.url,
  "metadata",   JSON.stringify(eventPayload.metadata)
);
```

Redis Streams work like an append-only log. Each entry gets a unique monotonic ID (`<timestamp>-<seq>`). The stream acts as a durable buffer between the API and the Worker.

### Step 4 — Worker reads the stream (blocking poll)

The Worker process (`workers/index.ts`) runs a controlled `while(!isShuttingDown)` loop. On each iteration it calls:

```ts
redisClient.xread("BLOCK", 5000, "STREAMS", "events", lastReadId)
```

- `BLOCK 5000` — waits up to 5 seconds for new entries before returning `null`. This avoids busy-waiting.
- `lastReadId` — only entries **after** this ID are returned. This is a "bookmark" that starts at `0-0` (all entries) or the last saved bookmark from Redis.

### Step 5 — Worker aggregates in Redis

For each batch of entries received, the worker builds a Redis **pipeline** (transaction):

```ts
const multi = redisClient.multi();
for (const entry of entries) {
  multi.hincrby("analytics:event_counts", eventName, 1);
}
await multi.exec();
```

`HINCRBY` atomically increments the count field for a given event name inside the hash `analytics:event_counts`. This is the running total across all time.

### Step 6 — Bookmark is saved

After processing a batch, the worker saves the **ID of the last processed entry** to Redis:

```ts
await redisClient.set("analytics_worker:last_id", lastEntryId);
```

On worker restart, it reads this key to resume exactly where it left off — **no events are lost or re-processed**.

> [!TIP]
> **Graceful Shutdown Integration:** By using a shutdown handler, we ensure the worker *never* stops halfway through Step 6. It always finishes the current batch and saves the bookmark before exiting, preventing duplicate processing on restart.

### Step 7 — Worker publishes updated totals via Pub/Sub

```ts
const grandTotals = await redisClient.hgetall("analytics:event_counts");
redisClient.publish("analytics-update", JSON.stringify(grandTotals));
```

This broadcasts the entire current aggregation snapshot to any subscriber on the `analytics-update` channel.

### Step 8 — API Server receives the Pub/Sub message

In `sockets/index.ts`, a **duplicate** Redis client (required because a client in subscribe mode can only receive, not send commands) listens:

```ts
subscriber.on("message", (channel, message) => {
  const parsed = JSON.parse(message);
  io.emit("analytics-update", parsed); // Push to all WebSocket clients
});
await subscriber.subscribe("analytics-update");
```

### Step 9 — Browser receives real-time update via Socket.IO

The dashboard page loads `socket.io.js` and listens:

```js
socket.on('analytics-update', updateDashboard);
```

`updateDashboard()` rebuilds the stat cards and event list in the DOM without a page reload.

### Step 10 — Worker writes to TimescaleDB

After publishing, the worker also persists aggregated totals to PostgreSQL, snapping them to **1-minute intervals**:

```sql
INSERT INTO event_counts (bucket, event_name, count)
VALUES (time_bucket('1 minute', NOW()), $1, $2), ...
ON CONFLICT (bucket, event_name) DO UPDATE
SET count = event_counts.count + EXCLUDED.count;
```

This creates a time-series record. By using `time_bucket`, multiple worker batches within the same minute are automatically aggregated into a single row, optimizing storage and query performance.

### Step 11 — Dashboard initial render

When someone navigates to `GET /dashboard`, the server responds with a static `index.html` file. 

The client-side JavaScript (`dashboard.js`) then:
1. Calls `GET /api/stats` to fetch the current aggregation from Redis as JSON.
2. Renders the UI immediately based on that initial data.
3. Allows Socket.IO to receive live updates from there.

---

## 5. Module Deep Dives

### 5.1 Entry Point — `src/index.ts`

**What it does:** Bootstraps the entire API server process.

```
loadEnv          (via db/connection import chain)
    ↓
createServer()   (Node HTTP)
    ↓
initSocket()     (attaches Socket.IO to the HTTP server)
    ↓
Express middleware stack:
  express.json()
  express.static()  (serves /public)
    ↓
Routes:
  GET  /health     → 200 OK (for Docker healthcheck)
  use  /           → trackRouter (handles /track, /dashboard, and /api/stats)
    ↓
Global error handler (ZodError → 400, other → 500)
    ↓
connectAll()     (establishes Postgres + Redis connections)
    ↓
httpServer.listen(PORT, "0.0.0.0")
```

**Key design note:** The server only starts listening **after** `connectAll()` resolves. If either database connection fails at startup, the process exits with code `1` rather than serving traffic against broken connections.

**Graceful Shutdown:** The API server implements a shutdown handler for `SIGTERM` and `SIGINT` signals.
1.  **Stop HTTP**: Calls `httpServer.close()` to stop accepting new requests while allowing current ones to finish.
2.  **Cleanup Sockets**: Calls `closeSocket()` to shut down Socket.IO and its Redis subscriber.
3.  **Close Shared DBs**: Quits the main `redisClient` and ends the PostgreSQL `pool`.
4.  **Failsafe**: A 10-second timeout ensures the process exits even if cleanup hangs.

---

### 5.2 Config — `src/config/loadEnv.ts`

**What it does:** Loads the `.env` file in development; skips gracefully in production.

- In **production** (`NODE_ENV=production`), environment variables are expected to be injected by Docker/the hosting platform. The `.env` file is not needed.
- In **development**, it resolves the `.env` path relative to the compiled output and uses `dotenv.config()`.
- If `dotenv` is missing or the `.env` file doesn't exist, it logs warnings instead of crashing.

This module is side-effect: it runs `loadEnvironmentVariables()` immediately on `import`.

---

### 5.3 Database — `src/db/connection.ts`

**What it does:** Creates and exports the two shared database clients used across the entire app.

| Export | Type | Description |
|---|---|---|
| `pool` | `pg.Pool` | PostgreSQL connection pool |
| `redisClient` | `ioredis.Redis` | Redis client (used for commands + Pub/Sub publisher) |
| `connectAll()` | `async function` | Runs both connection checks at startup |

**SSL handling:**
```ts
const sslConfig = process.env.NODE_ENV === "production"
  ? { rejectUnauthorized: false }  // Cloud-hosted Postgres (Render, Railway)
  : false;                          // Local dev — no SSL
```

**Redis TLS:**
```ts
tls: redisUrl.startsWith("rediss://") ? { rejectUnauthorized: false } : undefined
```
`rediss://` (double-s) is the TLS-enabled Redis URL scheme used by RedisCloud.

**`connectAll()` idempotency:** The `isConnected` flag prevents the function from running twice if called from multiple places (API + Worker both call it).

---

### 5.4 Router — `src/router/eventTracker.ts`

**What it does:** Defines all HTTP API routes.

#### `GET /dashboard`

Serves the static `index.html` file containing the analytics UI.

#### `GET /api/stats`

1. Reads the `analytics:event_counts` hash from Redis (`hgetall`).
2. Returns a JSON object with the current aggregate counts. This handles the client-side's initial state fetch.

#### `POST /track`

1. The `validate(trackEventSchema)` middleware runs first (validation gate).
2. Writes the event to the `"events"` Redis Stream using `xadd`.
3. Returns `200 { success: true, event: {...} }`.

#### `GET /analytics`

1.  Accepts a `range` query parameter (e.g., `1h`, `6h`, `24h`, `7d`). Defaults to `1h`.
2.  Maps the shorthand to a PostgreSQL `INTERVAL`.
3.  Queries TimescaleDB using `time_bucket('1 minute', bucket)` to return historical trends.
4.  Returns JSON data for charts or historical analysis.

**Redis Stream entry format:**
```
ID          | Field    | Value
------------|----------|---------------------------
<auto-id>   | userId   | "u-123"
            | eventName| "page_view"
            | url      | "/home"
            | metadata | '{"browser":"Chrome"}'
```

---

### 5.5 Schema — `src/schema/eventSchema.ts`

**What it does:** Defines the shape and validation rules for incoming event payloads using **Zod**.

```ts
const trackEventSchema = z.object({
  eventName: z.string().min(1),           // Required, non-empty
  url:       z.string(),                  // Required
  userId:    z.string().optional(),       // Optional
  metadata:  z.record(z.string(), z.any()).optional(), // Optional free-form object
});

type TrackEventInput = z.infer<typeof trackEventSchema>; // TypeScript type
```

This schema is the **single source of truth** for what a valid event looks like. It's used in both the middleware (validation) and the route handler (typed `req.body`).

---

### 5.6 Middleware — `src/middleware/validation.middleware.ts`

**What it does:** Generic, reusable Express middleware factory that takes a Zod schema and returns a middleware function.

```ts
validate(schema) → (req, res, next) => void
```

- On success: replaces `req.body` with the **typed, sanitized** Zod output and calls `next()`.
- On failure: immediately responds `400` with `{ errors: { fieldName: ["message"] } }`.

This is a **higher-order function** pattern — `validate` is called at route-registration time (not at request time), and it returns the actual middleware closure.

---

### 5.7 Worker — `src/workers/index.ts`

**What it does:** The background process that consumes the Redis Stream, aggregates counts, publishes updates, and writes to PostgreSQL.

**Three Redis keys used:**

| Key | Type | Purpose |
|---|---|---|
| `events` | Stream | The event log produced by the API |
| `analytics:event_counts` | Hash | Running total per event name |
| `analytics_worker:last_id` | String | Bookmark — last processed stream entry ID |

**The main loop:**

```
startWorker()
  └── connectAll()                   → ensures DB connections exist
  └── GET analytics_worker:last_id  → resume from last position (or "0-0")
  └── while(!isShuttingDown):       → controlled loop (SIGTERM/SIGINT)
        processEvents(lastReadId)
          └── XREAD BLOCK 5000 ...  → wait up to 5s for new events
          └── MULTI / HINCRBY ...   → atomic batch aggregation in Redis
          └── EXEC
          └── SET analytics_worker:last_id <newId>
          └── HGETALL analytics:event_counts
          └── PUBLISH analytics-update <json>
          └── INSERT INTO event_counts ... (Postgres upsert)
  └── Close Redis & Postgres connections
  └── process.exit(0)
```

**Fault tolerance:**
- The `BLOCK 5000` call prevents CPU spin loops when the stream is empty.  
- The bookmark ensures **at-least-once processing** — a worker crash leaves the bookmark at the last successfully persisted ID, so on restart only unprocessed entries are re-read.
- Postgres write errors are caught and logged but do **not** crash the loop — the Redis aggregation is still valid.

**Graceful Shutdown:**
The worker uses an `isShuttingDown` flag and `SIGTERM`/`SIGINT` listeners. Because the flag is checked at the start of the `while` loop, the worker will always finish its **current batch** (including saving the bookmark to Redis and writing to Postgres) before exiting. This prevents duplicate processing of events that would otherwise occur if the process were killed mid-batch.

---

### 5.8 Sockets — `src/sockets/index.ts`

**What it does:** Manages the Socket.IO server and the Redis Pub/Sub subscriber.

**Two Redis clients for one connection:**
```ts
const subscriber = redisClient.duplicate();
```
A Redis client in `subscribe` mode can **only** receive messages — it cannot execute regular commands. So the worker uses the main `redisClient` to `publish`, and the sockets module creates a dedicated `subscriber` clone for receiving.

**Message flow:**
```
Worker               redisClient.publish("analytics-update", json)
                                    ↓
Redis Pub/Sub channel: "analytics-update"
                                    ↓
Sockets module       subscriber.on("message", ...)
                                    ↓
                     io.emit("analytics-update", parsed)
                                    ↓
Browser              socket.on("analytics-update", updateDashboard)
```

CORS is configured to `origin: "*"` — appropriate for a dev/demo setup, should be locked down in production.

**Cleanup Handler:**
Exports a `closeSocket()` async function that:
1.  Calls `io.close()` to disconnect clients and stop the server.
2.  Calls `subscriber.quit()` to cleanly close the dedicated Redis subscription client.

---

### 5.9 Logger — `src/utils/logger.ts`

**What it does:** Provides a structured, production-ready **Winston** logger that balances visibility with security.

- **Unified Stream**: All logs are directed to **stdout/stderr**, allowing Docker to capture and manage the stream.
- **Environment-Specific Formatting**:
  - **Production**: Uses **JSON** format, which is easier for cloud log managers (like AWS CloudWatch or Loki) to parse and index.
  - **Development**: Uses a **Colorized**, human-readable format for better local debugging.
- **Security & Redaction**: 
  - **PII Redaction**: A custom formatter automatically masks sensitive keys (e.g., `password`, `token`, `authorization`) with `[REDACTED]`.
  - **URL Redaction**: Automatically detects and masks passwords within connection strings (e.g., `redis://user:[REDACTED]@host`).
  - **Always On**: Redaction is active in **both** Development and Production to prevent accidental leaks.
- **Dynamic Level**: Verbosity can be controlled via the `LOG_LEVEL` environment variable (defaults to `info`).

**Log levels (custom priority order):**
```
error (0) → warn (1) → info (2) → http (3) → debug (4)
```

---

### 5.10 Dashboard UI — `src/public/index.html`

**What it does:** The static HTML page for the analytics dashboard.

**UI sections:**
- **Header** — Title, subtitle, animated "Live Monitoring" pill with pulsing dot.
- **Stats Grid** — 4 cards: Total Aggregation, Event Types, Top Event, Avg Count.
- **Event Distribution** — A responsive grid of event cards (sorted by count descending).
- **Empty State** — Shown when no events exist yet.

### 5.11 Dashboard Logic — `src/public/js/dashboard.js`

**What it does:** Provides the Client-Side Rendering (CSR) and Socket.IO real-time binding.

**Data Flow:**
1. **Initial load:** Fetches JSON data from `/api/stats` and runs an initial `updateDashboard()` to construct the UI.
2. **Real-time updates:** Listens to `socket.on('analytics-update', updateDashboard)` to refresh the numbers and list live.

**`updateDashboard(eventCounts)`**:
Receives the raw Redis hash (either from HTTP or Socket), processes it into an array to determine the top event and averages, and directly updates the DOM using Vanilla JavaScript. Handles swapping the Empty State view to the Grid View.

---

### 5.11 Styles — `src/public/style.css`

**What it does:** Styles the dashboard with a modern Web3/dark-mode aesthetic.

**Design system (CSS custom properties):**
```css
--bg-dark:        #08080c           /* near-black background */
--bg-card:        rgba(16,16,24,.4) /* frosted glass cards */
--glass-border:   rgba(255,255,255,.08)
--accent-cyan:    #00f2ff           /* data values, live indicator, hover borders */
--accent-purple:  #7d40ff           /* event icons, top event */
--accent-blue:    #2d5bff           /* gradients */
--font-main:      Space Grotesque   /* headers + body */
--font-mono:      Space Mono        /* numbers — stat values, counts */
```

**Key visual features:**
- Glassmorphism cards with `backdrop-filter: blur(12px)`.
- Radial gradient background (purple top-left + blue bottom-right).
- `pulse` keyframe animation on the live indicator dot.
- `translateY(-8px)` lift on stat card hover.
- `translateY(-4px) scale(1.01)` + cyan border on event item hover.

**Responsive breakpoints:**
| Breakpoint | Stats Grid | Event List |
|---|---|---|
| `> 1024px` | 4 columns | auto-fill 320px columns |
| `≤ 1024px` | 2 columns | 1 column |
| `≤ 768px` | 2 columns, smaller gaps | 1 column |
| `≤ 480px` | 1 column | 1 column |

---

## 6. Database Schema — `sql/init.sql`

```sql
CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE event_counts (
    bucket      TIMESTAMPTZ NOT NULL,
    event_name  TEXT        NOT NULL,
    count       INT         NOT NULL,
    PRIMARY KEY (bucket, event_name)
);

SELECT create_hypertable('event_counts', 'bucket');
```

- **`bucket`** — timestamp of when the worker wrote the batch. Snapped to **1-minute intervals** using `time_bucket`.
- **`event_name`** — the event type string (e.g. `"page_view"`, `"click"`).
- **`count`** — the running total at that point in time.
- **TimescaleDB hypertable** — automatically partitions the table into time-based chunks for efficient time-range queries and data retention policies.
- **`ON CONFLICT ... DO UPDATE`** — if the same `(bucket, event_name)` pair is written twice, counts are **added** not replaced.

> [!IMPORTANT]
> **Storage Strategy:** The worker uses `time_bucket('1 minute', NOW())` on every batch write. This means all activity within a single clock minute for a specific event type is rolled up into one row. This significantly reduces row count (from ~thousands/day to 1,440/day per event type) and makes historical trend analysis much faster.

---

## 7. Docker & Containerization

### Services in `docker-compose.yml`

| Service | Container | Dockerfile | Port | Command |
|---|---|---|---|---|
| `api` | `event-tracker-api` | `docker/api.Dockerfile` | `5000:5000` | `node dist/index.js` |
| `worker` | `event-tracker-worker` | `docker/worker.Dockerfile` | none | `node dist/workers/index.js` |

Both services are on the shared bridge network `event-tracker-network`.

### Production Safety & Log Rotation

To prevent the production server from crashing due to disk exhaustion, both services are configured with a strict log rotation policy:

```yaml
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

- **Safety**: Logs are capped at **30MB** total (3 files x 10MB) per service.
- **Persistence**: Logs are maintained even if the container restarts.
- **Visibility**: You can watch live logs in production using `docker-compose logs -f`.

> [!IMPORTANT]
> Redis and PostgreSQL are **not** defined in `docker-compose.yml`. The project uses **external cloud-hosted** services (Render for Postgres, RedisCloud for Redis), with connection details provided via environment variables.

### Multi-Stage Dockerfiles

Both `docker/api.Dockerfile` and `docker/worker.Dockerfile` follow the same 2-stage pattern:

**Stage 1 — `builder`:**
```
node:20-alpine
  → npm ci (all deps including devDeps)
  → COPY source
  → npm run build (tsc → dist/)
```

**Stage 2 — `production`:**
```
node:20-alpine
  → npm ci --only=production (no devDeps)
  → COPY dist/ from builder
  → (API only) COPY src/public → dist/public
  → Run as non-root user nodejs:1001
  → EXPOSE 5000 (API only)
  → HEALTHCHECK (API only)
```

> [!NOTE]
> TypeScript compiler (`tsc`) **does not** copy non-`.ts` files. That's why the `.html`, `.js`, and `.css` static assets are explicitly copied from the builder stage in the API Dockerfile.

---

## 8. CI/CD — GitHub Actions

**File:** `.github/workflows/ci.yml`

**Triggers:** Push or Pull Request to `main`.

**Steps:**
1. `actions/checkout@v4` — clone the repo.
2. `actions/setup-node@v4` with Node.js 20 + npm cache.
3. `npm ci` — install exact dependencies from `package-lock.json`.
4. `npm test` — runs `echo "No tests yet" && exit 0` (placeholder).
5. `npx eslint` — lint the source code.

> [!WARNING]
> There are currently **no automated tests**. The `npm test` script is a placeholder. Adding unit tests (e.g. for the validation middleware or schema) and integration tests would greatly improve reliability of the CI pipeline.

---

## 9. NPM Scripts Reference

| Script | Command | Use case |
|---|---|---|
| `dev` | `nodemon src/index.ts` | Start the API server in dev (auto-restarts on changes) |
| `dev:worker` | `ts-node src/workers/index.ts` | Start the worker in dev (manual restart) |
| `build` | `tsc` | Compile TypeScript → `dist/` for production |
| `lint` | `eslint src/` | Check for code style issues |
| `format` | `prettier --write ...` | Auto-format all source files |
| `format:check` | `prettier --check ...` | Verify formatting (used in CI) |
| `typecheck` | `tsc --noEmit` | Type-check without emitting files |
| `test` | `echo "No tests yet" && exit 0` | Placeholder |
| `prepare` | `husky` | Sets up Git pre-commit hooks via Husky |

---

## 10. Environment Variables

| Variable | Example | Required | Description |
|---|---|---|---|
| `NODE_ENV` | `production` | Yes | Affects SSL, logging, .env loading |
| `PORT` | `5000` | No (default: 5000) | HTTP server port |
| `REDIS_URL` | `redis://...` or `rediss://...` | Yes | Redis connection string |
| `DB_HOST` | `*.render.com` | Yes | PostgreSQL host |
| `DB_PORT` | `5432` | No | PostgreSQL port |
| `DB_NAME` | `event_tracker_36h0` | Yes | PostgreSQL database name |
| `DB_USER` | `event_tracker_...` | Yes | PostgreSQL user |
| `DB_PASSWORD` | `...` | Yes | PostgreSQL password |

- **Development:** Set in `.env` (loaded by `config/loadEnv.ts`).
- **Production (Docker):** Set via `docker-compose.yml` `environment:` block or the `.env` file referenced under `env_file:`.

---

## 11. Key Redis Concepts Used

| Concept | Redis Command | Where Used | Why |
|---|---|---|---|
| **Streams** | `XADD`, `XREAD BLOCK` | Router → Worker | Durable, ordered event log; decouples producers from consumers |
| **Hash** | `HINCRBY`, `HGETALL` | Worker, Router | Efficient in-memory aggregation store per event name |
| **String** | `SET`, `GET` | Worker | Persistent bookmark (last processed stream ID) |
| **Pub/Sub** | `PUBLISH`, `SUBSCRIBE` | Worker → Sockets | Push-based real-time notifications without polling |
| **Pipeline/Multi** | `MULTI`, `EXEC` | Worker | Atomic batch writes — all `HINCRBY` calls succeed or fail together |
| **Duplicate client** | `redisClient.duplicate()` | Sockets | A subscribed client can't run normal commands; duplicate is the pattern |

---

## 12. Dependency Map

```
src/index.ts
  ├── src/config/loadEnv.ts         (via db/connection import)
  ├── src/db/connection.ts           → ioredis, pg
  ├── src/router/eventTracker.ts
  │     ├── src/middleware/validation.middleware.ts  → zod
  │     ├── src/schema/eventSchema.ts               → zod
  │     └── src/db/connection.ts
  ├── src/sockets/index.ts
  │     └── src/db/connection.ts
  └── src/utils/logger.ts            → winston

src/workers/index.ts
  ├── src/db/connection.ts
  └── src/utils/logger.ts
```

**Production dependencies:**

| Package | Version | Role |
|---|---|---|
| `express` | ^5.1.0 | HTTP server + routing |
| `socket.io` | ^4.8.1 | WebSocket server |
| `ioredis` | ^5.7.0 | Redis client (streams, pub/sub, hashes) |
| `pg` | ^8.16.3 | PostgreSQL client (TimescaleDB) |
| `zod` | ^4.1.9 | Schema validation + TypeScript inference |
| `dotenv` | ^17.2.3 | `.env` file loader |
| `winston` | (via @types/winston) | Structured logging |

**Dev dependencies:**

| Package | Role |
|---|---|
| `typescript` | Language compiler |
| `ts-node` | Run TypeScript directly (dev worker) |
| `nodemon` | Auto-restart on file save (dev server) |
| `eslint` + `typescript-eslint` | Linting |
| `prettier` | Code formatting |
| `husky` | Git pre-commit hooks |
