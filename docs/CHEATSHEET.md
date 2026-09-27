# ffgif Architecture Cheatsheet: Go vs. Fastify / TypeScript (Node.js)

## Language basics

### Concurrency Model: Goroutines vs. Node.js Event Loop
- **Go**: Uses lightweight user-space threads (goroutines) scheduled by the Go runtime across multiple OS threads (`M:N` scheduler). Concurrency is multi-threaded and synchronous-looking, with synchronization done via channels and `sync` primitives (`sync.WaitGroup`, `sync.Mutex`).
- **Node.js**: Runs JavaScript on a single-threaded event loop (libuv). Asynchronous I/O operations (network, file system, database queries) are handled non-blockingly via promises, `async`/`await`, and event emitters. CPU-intensive operations (like ffmpeg spawns) run in child processes without blocking the main event loop.

## Web framework

### Fastify Plugin & Encapsulation Model vs. Go Manual Middleware Chaining
- **Go (Standard / Chi / net/http)**: Middlewares are higher-order functions `func(http.Handler) http.Handler` that wrap handlers in a linear decorator chain. Dependency injection is typically passed explicitly via struct constructors or request contexts (`context.WithValue`).
- **Fastify**: Uses an encapsulated plugin architecture (`fastify.register`). Each plugin creates a new encapsulation context: plugins inherit decorators, hooks, and plugins from parent contexts, but siblings or parents do not inherit from children unless explicitly broken via `fastify-plugin` (`fp`).
- **Hook Lifecycle vs. Middleware**: Fastify routes use lifecycle hooks (`onRequest`, `preParsing`, `preValidation`, `preHandler`, `preSerialization`, `onSend`, `onResponse`). Auth guards are registered as `preHandler` hooks within encapsulated plugin scopes rather than inline `if` conditions in handler bodies.

### Request Validation: Zod vs. Go Struct Tags
- **Go**: Uses struct tags (e.g. `validate:"required,email,min=8"`) evaluated at runtime via reflection (e.g. `validator.Validate`).
- **Node / TypeScript**: TypeScript types are erased at runtime. Zod schemas define both runtime validation/parsing rules and infer static compile-time TypeScript types (`z.infer<typeof schema>`), providing end-to-end type safety with zero reflection overhead.

## ORM/DB

### Prisma Migrations vs. golang-migrate
- **Go (`golang-migrate`)**: Migrations are hand-written raw SQL files (`.up.sql` and `.down.sql`) named with sequence numbers or timestamps. The developer manually keeps database schema in sync with Go structs and query builders (e.g. `sqlx`, `pgx`).
- **Prisma**: Schema is declared declaratively in `prisma/schema.prisma` as the single source of truth. `prisma migrate dev` automatically calculates migrations diffs, generates migration SQL scripts, updates the database, and generates a fully type-safe TypeScript query client (`PrismaClient`).

### Transactions: Prisma `$transaction` vs. Go sqlx Transaction-in-Context
- **Go**: Requires initiating `tx, err := db.BeginTx(ctx, nil)`, threading the `tx` object or wrapping it inside a context value down repository layers, and manually handling `defer tx.Rollback()` and `tx.Commit()`.
- **Node / Prisma**: Uses `prisma.$transaction(async (tx) => { ... })` interactive transactions. All repository queries execute within the closure using `tx`; if any promise rejects or an error is thrown, the entire transaction automatically rolls back. If the closure resolves, it automatically commits.

## Auth

## Background jobs

### RabbitMQ Channel & Consumer Model: amqplib vs. amqp091-go
- **Go (`amqp091-go`)**: Channels deliver messages through Go channels (`<-chan amqp.Delivery`). Concurrency and prefetch (`Qos`) are managed per channel, and workers typically spawn separate goroutines per message delivery.
- **Node.js (`amqplib`)**: Consumes messages via event-driven callbacks `channel.consume(queue, (msg) => { ... })`. Explicit `channel.prefetch(count)` throttles the consumer to ensure concurrency limits are strictly adhered to, dispatching async processing tasks up to the prefetch limit.

## Testing
