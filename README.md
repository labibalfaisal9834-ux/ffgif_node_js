# ffgif-node

A 1:1 Clean Architecture port of the `ffgif` Go video-to-GIF processing platform into **Fastify + TypeScript** (Strict Mode, Node.js LTS).

---

## 🏗️ Architecture & Layering

The codebase strictly adheres to Clean Architecture principles with unidirectional inward dependencies:

```
src/
├── domain/                  # Pure entity types, repository interfaces, domain errors (Zero SQL/Fastify dependencies)
│   ├── auth/
│   ├── user/
│   ├── media/
│   ├── share/
│   └── friend/
├── application/             # Use cases (One service per business operation, depends only on domain interfaces)
│   ├── auth/
│   ├── user/
│   ├── media/
│   ├── share/
│   └── friend/
├── infrastructure/          # Concrete adapters & external drivers (Postgres/Prisma, Redis, RabbitMQ, MinIO, FFmpeg, Mailer)
│   ├── postgres/
│   ├── redis/
│   ├── rabbitmq/
│   ├── minio/
│   ├── ffmpeg/
│   └── mailer/
├── transport/               # HTTP delivery layer (Fastify plugins, Zod schemas, route handlers, static file serving)
│   └── http/
│       ├── plugins/
│       ├── routes/
│       └── schemas/
├── workers/                 # Background message queue consumers (Email, Video Conversion, Save Metadata, Raw Uploads)
├── config/                  # Validated environment configuration
└── index.ts                 # HTTP server entrypoint
```

---

## 🚀 Features & Domains

### 1. Authentication Domain (`/auth`)
- **Signup**: Atomic database transaction creating user, verifier token, profile, quota, and publishing welcome email via RabbitMQ.
- **Login / Logout**: JWT authentication with peppered bcrypt hashing (`password + pepper`) and Redis-backed instant token revocation (TTL blocklist).
- **Email Verification & Resend**: Cryptographic SHA-256 token verification.
- **Password Reset**: Forgot password and tokenized password reset flow with confirmation emails.

### 2. User Domain (`/users`)
- **Profile Management**: Profile retrieval and optimistic concurrency updates with `If-Match` / ETag validation.
- **Storage Quota**: Enforces GIF storage quotas and usage limits.
- **Account Security**: Password modification and account deletion with relational cascade cleanup.

### 3. Media Domain (`/gifs`)
- **Video Upload**: Generates presigned S3 upload URLs; raw uploads trigger automated SQS event notifications.
- **2-Pass GIF Transcoding**: Worker converts MP4 videos into high-quality GIFs using FFmpeg palette generation (`palettegen` / `paletteuse`) and FFprobe stream validation.
- **Media Library & Streaming**: Public and private GIF streams, video downloads, thumbnail generation, and recent creations.

### 4. Share Domain (`/gifs/me/:key/shares` & `/s`)
- **Direct Sharing**: Share private GIFs with registered users with optional expiration timestamps.
- **Public Token Sharing**: Generate shareable public links (`/s/:token`) with automated email delivery and preview/download routes.

### 5. Friend Domain (`/friends`)
- **Friend Requests**: Send friend requests (`POST /friends/requests`), list incoming pending requests (`GET /friends/requests`), accept (`PATCH /friends/requests/:id`), and reject (`DELETE /friends/requests/:id`).
- **Friendship Management**: View active friends list (`GET /friends`) and remove friendships (`DELETE /friends/:id`).

### 6. Background Queue Workers
- **Email Worker**: Consumes `email.queue` with concurrency limit of 10.
- **Converter Worker**: Consumes `video.process.queue` with concurrency limit of 2 for CPU-intensive FFmpeg jobs.
- **Save Metadata Worker**: Consumes `video.save.queue` with automatic Dead-Letter Exchange (DLX) and 1s TTL retry queue (`save.retry.queue`).
- **Raw Upload Worker**: Consumes `raw.upload.queue` dispatched directly by MinIO bucket notification triggers.

---

## 🛠️ Tech Stack

- **Runtime**: Node.js v22+ (LTS) / TypeScript 5.9 (Strict Mode)
- **Web Framework**: Fastify v5 with `@fastify/jwt`, `@fastify/cors`, `@fastify/static`
- **Database / ORM**: PostgreSQL 16 + Prisma ORM
- **Cache & Blocklist**: Redis 7 + `ioredis`
- **Message Broker**: RabbitMQ 3 (Management) + `amqplib`
- **Object Storage**: MinIO S3 + MinIO Node.js SDK
- **Video Processing**: FFmpeg & FFprobe (native OS subprocess execution)
- **Validation**: Zod (runtime validation with compile-time type inference)
- **Test Framework**: Vitest 5 (parallel in-memory HTTP injection and unit tests)

---

## ⚡ Quick Start

### 1. Environment Setup

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

### 2. Run Entire Stack with Docker Compose

Spins up PostgreSQL (with `pg_cron`), Redis, RabbitMQ, MinIO, Fastify API Server, and Background Workers:

```bash
docker compose up --build
```

### 3. Run Locally for Development

1. **Start infrastructure services**:
   ```bash
   docker compose up postgres redis rabbitmq minio -d
   ```

2. **Install dependencies & generate Prisma client**:
   ```bash
   npm install
   npm run prisma:generate
   ```

3. **Apply database migrations**:
   ```bash
   npm run prisma:migrate
   ```

4. **Start API server with hot-reload**:
   ```bash
   npm run dev
   ```

5. **Start background workers with hot-reload (in separate terminal)**:
   ```bash
   npm run dev:worker
   ```

---

## 🧪 Testing & Code Quality

```bash
# Run all unit and integration test suites
npm test

# Run tests in interactive watch mode
npm run test:watch

# TypeScript compile check (strict mode)
npx tsc --noEmit

# Linting
npm run lint
```

---

## 📖 Architecture & Language Cheatsheet

For an in-depth tutorial comparing constructs between Go and Fastify/TypeScript (e.g. Goroutines vs. Event Loop, Fastify Plugins/Hooks, Prisma Transactions, RabbitMQ DLX topology, etc.), consult:

👉 [**docs/CHEATSHEET.md**](docs/CHEATSHEET.md)
