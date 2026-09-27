# TypeScript & Fastify Architecture Cheatsheet

A standalone tutorial and syntax guide to modern TypeScript, Fastify, Prisma, and asynchronous architecture patterns.

---

## 1. Core Language & Concurrency

### 1.1 `async`/`await` & The Single-Threaded Event Loop

**Concept & How it Works:**
Node.js executes JavaScript on a single-threaded event loop (powered by libuv). When an asynchronous operation is triggered (network I/O, file read, timer), Node.js offloads the operation to the operating system or internal thread pool and returns a `Promise`. The `await` keyword pauses execution of the surrounding `async` function without blocking the main thread, allowing other requests or tasks to execute concurrently. When the promise resolves, execution resumes in a microtask callback.

**Illustrative Snippet:**
```typescript
async function fetchAccountData(accountId: string): Promise<AccountData> {
  const metaPromise = queryMetadata(accountId);
  const balancePromise = queryBalance(accountId);

  // Both network I/O operations run concurrently on the event loop
  const [meta, balance] = await Promise.all([metaPromise, balancePromise]);
  return { ...meta, balance };
}
```

**Go equivalent / closest analogue:** Goroutines with channels (`go worker()`, `select {}`, or `sync.WaitGroup`), where scheduling is handled by Go's `M:N` runtime scheduler across multiple OS threads.

**Where this pattern is used in this project:** [src/application/media/convert.service.ts](file:///Users/labib0x9/Desktop/ffgif_node_js/src/application/media/convert.service.ts)

---

### 1.2 TypeScript Generics & Generic Interfaces

**Concept & How it Works:**
Generics allow functions, classes, and interfaces to parameterize types without losing compile-time type safety. Type variables (such as `<T>`) serve as placeholders that callers specify or that the compiler infers when arguments are provided. Generics prevent excessive type casting, preserve strict autocomplete, and allow writing reusable data structures and repository interfaces.

**Illustrative Snippet:**
```typescript
interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
}

function paginate<T>(items: T[], page: number, pageSize: number): PaginatedResult<T> {
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total: items.length,
    page,
  };
}
```

**Go equivalent / closest analogue:** Go 1.18+ Type Parameters (`type PaginatedResult[T any] struct { Items []T }`).

**Where this pattern is used in this project:** [src/domain/friend/repository.ts](file:///Users/labib0x9/Desktop/ffgif_node_js/src/domain/friend/repository.ts)

---

### 1.3 TypeScript Discriminated Unions & Custom Error Hierarchies

**Concept & How it Works:**
Custom error hierarchies allow domain layers to encapsulate business-rule failures as typed domain exceptions rather than generic strings. By extending the built-in `Error` class and assigning specific `errorCode` or discriminator fields, the transport layer can catch errors and map them to appropriate HTTP status codes via `instanceof` checks.

**Illustrative Snippet:**
```typescript
class DomainError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

class EntityNotFoundError extends DomainError {
  constructor(entityName: string) {
    super(`${entityName} was not found`, 'ENTITY_NOT_FOUND');
  }
}
```

**Go equivalent / closest analogue:** Sentinel errors (`errors.New`, `fmt.Errorf("%w", err)`) inspected using `errors.Is(err, target)` or custom error structs checked with `errors.As`.

**Where this pattern is used in this project:** [src/domain/friend/errors.ts](file:///Users/labib0x9/Desktop/ffgif_node_js/src/domain/friend/errors.ts)

---

### 1.4 Dependency Injection via Constructor Interfaces

**Concept & How it Works:**
Dependency Injection (DI) decouples high-level business logic (Use Cases / Services) from low-level infrastructure (Database queries, HTTP clients, Cache). Classes accept interface abstractions through their constructors rather than instantiating concrete classes directly. This enforces strict architectural boundaries (Clean Architecture) and makes services straightforward to unit test via mock implementations.

**Illustrative Snippet:**
```typescript
interface EmailNotifier {
  send(to: string, subject: string, body: string): Promise<void>;
}

class WelcomeUserUseCase {
  constructor(private readonly notifier: EmailNotifier) {}

  async execute(email: string, name: string): Promise<void> {
    await this.notifier.send(email, 'Welcome!', `Hello ${name}`);
  }
}
```

**Go equivalent / closest analogue:** Structs holding interface fields instantiated via factory functions (`NewService(repo Repository) Service`).

**Where this pattern is used in this project:** [src/application/friend/send_request.service.ts](file:///Users/labib0x9/Desktop/ffgif_node_js/src/application/friend/send_request.service.ts)

---

## 2. HTTP Server & Web Framework (Fastify)

### 2.1 Fastify Encapsulation & Plugin System (`fastify.register`)

**Concept & How it Works:**
Fastify uses an encapsulated hierarchical plugin model. When registering a plugin with `fastify.register(async (scope) => { ... })`, Fastify creates a nested inheritance context. Decorators, hooks, and middleware added inside the plugin scope are accessible to child routes within that closure, but do not leak outwards to parent or sibling scopes. To share plugins globally across scopes, the `fastify-plugin` (`fp`) helper can be used to bypass encapsulation.

**Illustrative Snippet:**
```typescript
import Fastify, { FastifyInstance } from 'fastify';

const app = Fastify();

// Public routes (no auth hook attached)
app.register(async (publicScope: FastifyInstance) => {
  publicScope.get('/health', async () => ({ status: 'ok' }));
});

// Protected routes (isolated auth hook inside scope)
app.register(async (protectedScope: FastifyInstance) => {
  protectedScope.addHook('onRequest', async (req, reply) => {
    if (!req.headers.authorization) reply.status(401).send({ error: 'Unauthorized' });
  });
  protectedScope.get('/dashboard', async () => ({ data: 'secret' }));
});
```

**Go equivalent / closest analogue:** Chi or net/http subrouters with scoped middleware groups (`r.Group(func(r chi.Router) { r.Use(AuthMiddleware); r.Get(...) })`).

**Where this pattern is used in this project:** [src/transport/http/routes/friend.routes.ts](file:///Users/labib0x9/Desktop/ffgif_node_js/src/transport/http/routes/friend.routes.ts)

---

### 2.2 Fastify Lifecycle Hooks (`onRequest`, `preHandler`, `onSend`)

**Concept & How it Works:**
Fastify processes incoming HTTP requests through a deterministic, ordered lifecycle pipeline: `onRequest` -> `preParsing` -> `preValidation` -> `preHandler` -> Route Handler -> `preSerialization` -> `onSend` -> `onResponse`. Registering hooks allows intercepting the request lifecycle at exact points (e.g. `onRequest` for rate limiting/CORS, `preHandler` for authentication and permission checks after route matching).

**Illustrative Snippet:**
```typescript
fastify.addHook('preHandler', async (request, reply) => {
  const token = request.headers['x-api-key'];
  if (!token || token !== 'secret-key') {
    return reply.status(403).send({ error: 'Forbidden' });
  }
});
```

**Go equivalent / closest analogue:** Middleware wrappers `func(http.Handler) http.Handler` executed before calling `next.ServeHTTP(w, r)`.

**Where this pattern is used in this project:** [src/transport/http/plugins/auth_guard.ts](file:///Users/labib0x9/Desktop/ffgif_node_js/src/transport/http/plugins/auth_guard.ts)

---

### 2.3 Fastify Decorators (`fastify.decorateRequest`)

**Concept & How it Works:**
Decorators allow attaching custom properties, methods, or utilities directly to Fastify instances, `FastifyRequest`, or `FastifyReply`. Using `fastify.decorateRequest('authUser', null)` initializes the property with high V8 performance (monomorphic hidden classes) and allows TypeScript declaration merging to provide type safety across all handler functions.

**Illustrative Snippet:**
```typescript
declare module 'fastify' {
  interface FastifyRequest {
    currentUserId: string;
  }
}

fastify.decorateRequest('currentUserId', '');
fastify.addHook('onRequest', async (req) => {
  req.currentUserId = req.headers['x-user-id'] as string || '';
});
```

**Go equivalent / closest analogue:** Request context values (`ctx = context.WithValue(r.Context(), userKey, user)` and `r.WithContext(ctx)`).

**Where this pattern is used in this project:** [src/transport/http/plugins/auth_guard.ts](file:///Users/labib0x9/Desktop/ffgif_node_js/src/transport/http/plugins/auth_guard.ts)

---

### 2.4 Static Asset Serving & SPA Clean URL Fallback (`@fastify/static`)

**Concept & How it Works:**
Static web applications (such as exported React/Next.js client builds) require serving static assets from disk while supporting clean URLs (e.g. `/friends` maps to `/friends.html`) and falling back to `index.html` for client-side routing. Fastify integrates `@fastify/static` with a custom not-found handler to inspect filesystem existence before delegating 404s.

**Illustrative Snippet:**
```typescript
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import fs from 'node:fs';

fastify.register(fastifyStatic, {
  root: path.resolve('./public'),
  prefix: '/',
  wildcard: false,
});

fastify.setNotFoundHandler(async (request, reply) => {
  const cleanPath = request.url.split('?')[0].replace(/^\//, '');
  const htmlFile = path.resolve(`./public/${cleanPath}.html`);
  if (fs.existsSync(htmlFile)) {
    return reply.type('text/html').sendFile(`${cleanPath}.html`);
  }
  return reply.type('text/html').sendFile('index.html');
});
```

**Go equivalent / closest analogue:** `http.FileServer(http.Dir("./dist"))` combined with custom `os.Stat` checks in a route handler.

**Where this pattern is used in this project:** [src/transport/http/routes/static.routes.ts](file:///Users/labib0x9/Desktop/ffgif_node_js/src/transport/http/routes/static.routes.ts)

---

### 2.5 In-Memory HTTP Testing (`app.inject`)

**Concept & How it Works:**
Fastify provides an in-memory HTTP dispatch engine (via `light-my-request`). Using `app.inject({ method, url, payload, headers })`, tests can send full synthetic HTTP requests through Fastify's routing, middleware, plugins, and error handlers without allocating TCP ports or incurring network socket overhead.

**Illustrative Snippet:**
```typescript
import { test, expect } from 'vitest';

test('GET /ping returns 200', async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/ping',
  });
  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ message: 'pong' });
});
```

**Go equivalent / closest analogue:** `httptest.NewRecorder()` with `mux.ServeHTTP(recorder, req)`.

**Where this pattern is used in this project:** [tests/integration/auth_flow.test.ts](file:///Users/labib0x9/Desktop/ffgif_node_js/tests/integration/auth_flow.test.ts)

---

## 3. Data Validation & Schemas (Zod)

### 3.1 Runtime Schema Parsing & Static Type Inference (`z.infer`)

**Concept & How it Works:**
Because TypeScript types are completely erased at compilation time, they cannot validate incoming runtime payloads (such as JSON request bodies). Zod provides declarative schema definitions that validate and coerce input at runtime while simultaneously deriving compile-time TypeScript types using `z.infer<typeof schema>`.

**Illustrative Snippet:**
```typescript
import { z } from 'zod';

const createUserSchema = z.object({
  email: z.string().email(),
  age: z.number().int().min(18),
  nickname: z.string().optional(),
});

type CreateUserInput = z.infer<typeof createUserSchema>;

function handlePayload(rawInput: unknown): CreateUserInput {
  const result = createUserSchema.safeParse(rawInput);
  if (!result.success) {
    throw new Error(`Validation error: ${result.error.message}`);
  }
  return result.data; // Fully typed as CreateUserInput
}
```

**Go equivalent / closest analogue:** Go struct tags evaluated via reflection (e.g. `go-playground/validator`).

**Where this pattern is used in this project:** [src/transport/http/schemas/friend.schema.ts](file:///Users/labib0x9/Desktop/ffgif_node_js/src/transport/http/schemas/friend.schema.ts)

---

## 4. Database & ORM (Prisma)

### 4.1 Declarative Schema & Type-Safe Query Builder

**Concept & How it Works:**
Prisma uses a declarative modeling schema (`prisma/schema.prisma`) as the single source of truth for database tables, columns, relations, and indexes. Running `prisma generate` generates a fully type-safe query client with method signatures tailored to the declared models (`findUnique`, `findMany`, `create`, `update`, `delete`), eliminating SQL string typos and manual row scanning.

**Illustrative Snippet:**
```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function getActiveUsersWithProfiles(organizationId: string) {
  return prisma.user.findMany({
    where: {
      organizationId,
      status: 'active',
    },
    include: {
      profile: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}
```

**Go equivalent / closest analogue:** SQL query generation tools like `sqlc` or ORMs like GORM/Ent, or manual struct mapping using `sqlx.SelectContext`.

**Where this pattern is used in this project:** [src/infrastructure/postgres/friend_repository.ts](file:///Users/labib0x9/Desktop/ffgif_node_js/src/infrastructure/postgres/friend_repository.ts)

---

### 4.2 Interactive ACID Transactions (`prisma.$transaction`)

**Concept & How it Works:**
Interactive transactions execute multiple asynchronous database queries within a single atomic database transaction. `prisma.$transaction(async (tx) => { ... })` passes an isolated transaction client `tx` into an async callback. If any promise rejects or an error is thrown inside the callback, Prisma automatically issues `ROLLBACK`. If the function completes successfully, it automatically issues `COMMIT`.

**Illustrative Snippet:**
```typescript
await prisma.$transaction(async (tx) => {
  const sender = await tx.account.update({
    where: { id: senderId },
    data: { balance: { decrement: 100 } },
  });
  if (sender.balance < 0) {
    throw new Error('Insufficient funds');
  }
  await tx.account.update({
    where: { id: receiverId },
    data: { balance: { increment: 100 } },
  });
});
```

**Go equivalent / closest analogue:** Initiating `tx, err := db.BeginTx(ctx, nil)` followed by `defer tx.Rollback()` and explicit `tx.Commit()`.

**Where this pattern is used in this project:** [src/infrastructure/postgres/user_repository.ts](file:///Users/labib0x9/Desktop/ffgif_node_js/src/infrastructure/postgres/user_repository.ts)

---

## 5. Security & Cryptography

### 5.1 Password Hashing with Salt & Pepper (Bcrypt)

**Concept & How it Works:**
Bcrypt uses an adaptive cryptographic key-derivation algorithm that incorporates a random per-user salt and configurable work factor (cost). In addition to the salt, an application-wide secret "pepper" is appended to the plaintext password prior to hashing. If the database is compromised, passwords cannot be cracked without also obtaining the secret pepper from the application runtime environment.

**Illustrative Snippet:**
```typescript
import bcrypt from 'bcrypt';

const PEPPER = process.env.PASSWORD_PEPPER || 'app-pepper';
const COST = 12;

async function hashPassword(plain: string): Promise<string> {
  const peppered = plain + PEPPER;
  const salt = await bcrypt.genSalt(COST);
  return bcrypt.hash(peppered, salt);
}

async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain + PEPPER, hash);
}
```

**Go equivalent / closest analogue:** `golang.org/x/crypto/bcrypt` using `bcrypt.GenerateFromPassword([]byte(password + pepper), cost)`.

**Where this pattern is used in this project:** [src/application/auth/signup.service.ts](file:///Users/labib0x9/Desktop/ffgif_node_js/src/application/auth/signup.service.ts)

---

### 5.2 Ephemeral Key Expiration & JWT Revocation (Redis TTL)

**Concept & How it Works:**
JSON Web Tokens (JWT) are stateless by default and cannot be invalidated until their expiration timestamp (`exp`). To support explicit logouts and token revocation without database table bloat, revoked tokens are written to Redis with a TTL matching the token's remaining lifetime (`exp - now`). Redis automatically purges the expired key once the token's natural validity has elapsed.

**Illustrative Snippet:**
```typescript
import Redis from 'ioredis';

const redis = new Redis();

async function revokeToken(tokenString: string, expSecondsFromEpoch: number): Promise<void> {
  const remainingSeconds = Math.max(1, expSecondsFromEpoch - Math.floor(Date.now() / 1000));
  await redis.set(`blocklist:${tokenString}`, '1', 'EX', remainingSeconds);
}

async function isTokenRevoked(tokenString: string): Promise<boolean> {
  const result = await redis.get(`blocklist:${tokenString}`);
  return result !== null;
}
```

**Go equivalent / closest analogue:** `redis.Client.Set(ctx, key, val, remainingDuration)` in `go-redis`.

**Where this pattern is used in this project:** [src/application/auth/logout.service.ts](file:///Users/labib0x9/Desktop/ffgif_node_js/src/application/auth/logout.service.ts)

---

## 6. Asynchronous Messaging & Background Processing (AMQP / RabbitMQ)

### 6.1 AMQP Worker Prefetch (QoS) & Event-Driven Consumer Loop

**Concept & How it Works:**
AMQP brokers push messages to connected consumers over TCP channels. Without prefetch limits, the broker would flush all queued messages into memory at once, overwhelming the Node.js process. Setting `channel.prefetch(count)` enforces Quality of Service (QoS) by guaranteeing the worker only receives up to `count` unacknowledged messages at any time. When processing completes, calling `channel.ack(msg)` frees up capacity for the broker to dispatch the next message.

**Illustrative Snippet:**
```typescript
import amqplib from 'amqplib';

async function startWorker(queueName: string) {
  const connection = await amqplib.connect('amqp://localhost');
  const channel = await connection.createChannel();
  await channel.assertQueue(queueName, { durable: true });

  await channel.prefetch(2); // Process max 2 concurrent jobs

  channel.consume(queueName, async (msg) => {
    if (!msg) return;
    try {
      const payload = JSON.parse(msg.content.toString());
      await processPayload(payload);
      channel.ack(msg);
    } catch (err) {
      channel.nack(msg, false, false); // Reject without requeue (send to DLX)
    }
  });
}
```

**Go equivalent / closest analogue:** `ch.Qos(prefetchCount, 0, false)` with deliveries read over a Go channel (`msgs, err := ch.Consume(...)`).

**Where this pattern is used in this project:** [src/workers/converter_worker.ts](file:///Users/labib0x9/Desktop/ffgif_node_js/src/workers/converter_worker.ts)

---

### 6.2 Dead-Letter Exchanges (DLX) & Delayed Retries via Message TTL

**Concept & How it Works:**
Rather than writing application-level retry loops with `setTimeout`, RabbitMQ queues can be declared with `x-dead-letter-exchange` and `x-message-ttl` arguments. When a transient error occurs, the message is published to a dedicated retry queue with an expiration TTL (e.g. 1000ms). When the message expires, RabbitMQ automatically routes it back to the primary work queue without any active polling.

**Illustrative Snippet:**
```typescript
await channel.assertExchange('app.dlx', 'direct', { durable: true });

// Retry queue: messages expire after 5 seconds and route to 'work.exchange'
await channel.assertQueue('jobs.retry', {
  durable: true,
  arguments: {
    'x-dead-letter-exchange': 'work.exchange',
    'x-dead-letter-routing-key': 'job.process',
    'x-message-ttl': 5000,
  },
});
```

**Go equivalent / closest analogue:** Declaring `amqp.Table{"x-dead-letter-exchange": "app.dlx", "x-message-ttl": 5000}` with `ch.QueueDeclare`.

**Where this pattern is used in this project:** [src/infrastructure/rabbitmq/client.ts](file:///Users/labib0x9/Desktop/ffgif_node_js/src/infrastructure/rabbitmq/client.ts)

---

## 7. System Processes & Testing

### 7.1 Child Process Execution for CLI Tools (`child_process.spawn`)

**Concept & How it Works:**
CPU-heavy binary workloads (such as video conversion, FFmpeg transcoding, and FFprobe media inspection) should never run on the single-threaded Node.js event loop. Node's `child_process.spawn` or `child_process.execFile` spawns an asynchronous OS process, streaming `stdout`/`stderr` chunks via event listeners and resolving a promise when the process exits.

**Illustrative Snippet:**
```typescript
import { spawn } from 'node:child_process';

function executeCliTool(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args);
    let output = '';
    let errorOutput = '';

    proc.stdout.on('data', (chunk) => { output += chunk.toString(); });
    proc.stderr.on('data', (chunk) => { errorOutput += chunk.toString(); });

    proc.on('close', (code) => {
      if (code === 0) resolve(output);
      else reject(new Error(`Process exited with code ${code}: ${errorOutput}`));
    });
  });
}
```

**Go equivalent / closest analogue:** `exec.CommandContext(ctx, "ffmpeg", args...).CombinedOutput()`.

**Where this pattern is used in this project:** [src/infrastructure/ffmpeg/ffmpeg.ts](file:///Users/labib0x9/Desktop/ffgif_node_js/src/infrastructure/ffmpeg/ffmpeg.ts)

---

### 7.2 Interface Mocking & Unit Testing (Vitest `vi.fn()`)

**Concept & How it Works:**
Vitest provides native ESM and TypeScript testing with fast parallel execution. Using `vi.fn().mockResolvedValue(...)`, tests create mock objects satisfying domain interfaces without spinning up actual databases or message brokers. Assertions like `toHaveBeenCalledWith` verify that the application layer calls repository contracts with exact expected arguments.

**Illustrative Snippet:**
```typescript
import { describe, it, expect, vi } from 'vitest';

describe('PaymentService', () => {
  it('should process payment through payment gateway', async () => {
    const mockGateway = {
      charge: vi.fn().mockResolvedValue({ id: 'txn_123', status: 'succeeded' }),
    };

    const service = new PaymentService(mockGateway);
    const result = await service.execute('customer_1', 5000);

    expect(mockGateway.charge).toHaveBeenCalledWith('customer_1', 5000);
    expect(result.status).toBe('succeeded');
  });
});
```

**Go equivalent / closest analogue:** `golang/mock` (gomock) generated mocks or custom mock structs implementing interfaces in `*_test.go` files.

**Where this pattern is used in this project:** [tests/unit/friend.service.test.ts](file:///Users/labib0x9/Desktop/ffgif_node_js/tests/unit/friend.service.test.ts)
