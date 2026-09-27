# ffgif Architecture Cheatsheet: Go vs. Fastify / TypeScript (Node.js)

## Language basics

### Concurrency Model: Goroutines vs. Node.js Event Loop
- **Go**: Uses lightweight user-space threads (goroutines) scheduled by the Go runtime across multiple OS threads (`M:N` scheduler). Concurrency is multi-threaded and synchronous-looking, with synchronization done via channels (`chan`) and `sync` primitives (`sync.WaitGroup`, `sync.Mutex`).
- **Node.js**: Runs JavaScript on a single-threaded event loop (libuv). Asynchronous I/O operations (network sockets, disk I/O, database queries) are handled non-blockingly via promises, `async`/`await`, and event emitters. CPU-intensive operations (such as FFmpeg/FFprobe sub-processes) are spawned asynchronously as child processes without blocking the main event loop.

### Error Handling: Explicit Error Values vs. Domain Exceptions
- **Go**: Functions return `(Result, error)` tuples where the caller must explicitly check `if err != nil`. Domain errors are created via `errors.New` or `fmt.Errorf("%w", err)` and checked with `errors.Is`.
- **TypeScript**: Functions throw typed domain exception classes extending a base `DomainError` (e.g. `UserNotFoundError`, `InvalidCredentialError`). Layer boundaries catch these domain errors and translate them into domain-specific HTTP status codes and error payloads.

---

## Web framework

### Fastify Plugin & Encapsulation Model vs. Go Manual Middleware Chaining
- **Go (Standard / Chi / net/http)**: Middlewares are higher-order functions `func(http.Handler) http.Handler` that wrap handlers in a linear decorator chain. Dependency injection is typically passed explicitly via struct constructors or request contexts (`context.WithValue`).
- **Fastify**: Uses an encapsulated plugin architecture (`fastify.register`). Each plugin creates a new encapsulation context: plugins inherit decorators, hooks, and plugins from parent contexts, but siblings or parents do not inherit from children unless explicitly broken via `fastify-plugin` (`fp`).
- **Hook Lifecycle vs. Middleware**: Fastify routes use lifecycle hooks (`onRequest`, `preParsing`, `preValidation`, `preHandler`, `preSerialization`, `onSend`, `onResponse`). Auth guards are registered as `preHandler` hooks within encapsulated plugin scopes rather than inline `if` conditions in handler bodies.

### Request Validation: Zod vs. Go Struct Tags
- **Go**: Uses struct tags (e.g. `validate:"required,email,min=8"`) evaluated at runtime via reflection (e.g. `validator.Validate`).
- **Node / TypeScript**: TypeScript types are erased at runtime. Zod schemas define both runtime validation/parsing rules and infer static compile-time TypeScript types (`z.infer<typeof schema>`), providing end-to-end type safety with zero reflection overhead.

---

## ORM/DB

### Prisma Migrations vs. golang-migrate
- **Go (`golang-migrate`)**: Migrations are hand-written raw SQL files (`.up.sql` and `.down.sql`) named with sequence numbers or timestamps. The developer manually keeps database schema in sync with Go structs and query builders (e.g. `sqlx`, `pgx`).
- **Prisma**: Schema is declared declaratively in `prisma/schema.prisma` as the single source of truth. `prisma migrate dev` automatically calculates migrations diffs, generates migration SQL scripts, updates the database, and generates a fully type-safe TypeScript query client (`PrismaClient`).

### Transactions: Prisma `$transaction` vs. Go sqlx Transaction-in-Context
- **Go**: Requires initiating `tx, err := db.BeginTx(ctx, nil)`, threading the `tx` object or wrapping it inside a context value down repository layers (`getDBFromCtx`), and manually handling `defer tx.Rollback()` and `tx.Commit()`.
- **Node / Prisma**: Uses `prisma.$transaction(async (tx) => { ... })` interactive transactions. All repository queries execute within the closure using `tx`; if any promise rejects or an error is thrown, the entire transaction automatically rolls back. If the closure resolves, it automatically commits.

---

## Auth

### JWT & Peppered Password Hashing
- **Go**: Custom JWT parsing via `golang-jwt/jwt/v5`, manual claims validation, and manual password hashing where the pepper is concatenated with password strings before passing to `bcrypt.GenerateFromPassword`.
- **Fastify / TypeScript**: Uses `@fastify/jwt` for signing and verification with standard claims (`sub`, `iss`, `email`, `fullname`, `role`, `exp`). Passwords are concatenated with the application pepper (`password + pepper`) at the service layer before hashing with native `bcrypt.hash`.

### Token Revocation: Redis Blocklist with Remaining TTL
- **Pattern**: When a user logs out, the remaining time-to-live (`exp - now`) is calculated from the JWT payload. The token is stored in Redis under `token_blocklist:<jwt>` with that exact expiration TTL (`EX`).
- **Advantage**: Keys automatically expire without needing background cron cleanup jobs. The auth guard simply queries Redis (`cache.get(token_blocklist:<jwt>)`) during the `preHandler` hook.

---

## Background jobs

### RabbitMQ Channel & Consumer Model: amqplib vs. amqp091-go
- **Go (`amqp091-go`)**: Channels deliver messages through Go channels (`<-chan amqp.Delivery`). Concurrency and prefetch (`Qos`) are managed per channel, and workers typically spawn separate goroutines per message delivery.
- **Node.js (`amqplib`)**: Consumes messages via event-driven callbacks `channel.consume(queue, (msg) => { ... })`. Explicit `channel.prefetch(count)` throttles the consumer to ensure concurrency limits are strictly adhered to, dispatching async processing tasks up to the prefetch limit.

### Dead-Letter Queue & TTL Retry Topology
- **Topology**: Queues are configured with dead-letter exchanges (`x-dead-letter-exchange`) routing rejected messages to dedicated `.dead` queues.
- **Retry Queue**: The `save.retry.queue` is configured with `x-message-ttl: 1000` (1 second) and dead-letter routing back to the primary `video.save.queue`, creating an automatic delayed retry mechanism without application polling.

---

## Testing

### Vitest & In-Memory Injection vs. Go httptest
- **Go**: Uses the built-in `testing` package, `gomock` for interface mocking, and `httptest.NewRecorder()` to pass simulated HTTP requests to `http.Handler.ServeHTTP`.
- **Node.js / Vitest**: Uses Vitest for fast parallel execution, `vi.fn()` for interface mocking, and Fastify's `app.inject()` (light-my-request) to test HTTP routes end-to-end without opening TCP network sockets.
