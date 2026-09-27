import dotenv from 'dotenv';
import { z } from 'zod';

// Load .env file
dotenv.config();

const envSchema = z.object({
  VERSION: z.string().min(1, 'VERSION is required'),
  SERVICE_NAME: z.string().min(1, 'SERVICE_NAME is required'),
  ADDR: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().default(8080),

  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  HASH_PEPPER: z.string().min(1, 'HASH_PEPPER is required'),
  BCRYPT_COST: z.coerce.number().default(12),

  PG_USER: z.string().min(1, 'PG_USER is required'),
  PG_PASSWORD: z.string().min(1, 'PG_PASSWORD is required'),
  PG_PORT: z.coerce.number().default(5432),
  PG_ADDRESS: z.string().min(1, 'PG_ADDRESS is required'),
  PG_NAME: z.string().min(1, 'PG_NAME is required'),
  PG_SSLMODE: z.string().default('disable'),
  PG_SUPERUSER: z.string().min(1, 'PG_SUPERUSER is required'),
  PG_SUPERDB: z.string().min(1, 'PG_SUPERDB is required'),

  REDIS_ADDR: z.string().min(1, 'REDIS_ADDR is required'),
  REDIS_USER: z.string().optional().default(''),
  REDIS_PASSWORD: z.string().optional().default(''),

  EMAIL: z.string().min(1, 'EMAIL is required'),
  MAILTRAP_USERNAME: z.string().min(1, 'MAILTRAP_USERNAME is required'),
  MAILTRAP_PASSWORD: z.string().min(1, 'MAILTRAP_PASSWORD is required'),

  MINIO_ADDR: z.string().min(1, 'MINIO_ADDR is required'),
  MINIO_PUBLIC_ENDPOINT: z.string().min(1, 'MINIO_PUBLIC_ENDPOINT is required'),
  MINIO_ROOT_USER: z.string().min(1, 'MINIO_ROOT_USER is required'),
  MINIO_ROOT_PASSWORD: z.string().min(1, 'MINIO_ROOT_PASSWORD is required'),
  MINIO_PRESIGNED_USER: z.string().optional(),
  MINIO_PRESIGNED_PASSWORD: z.string().optional(),
  MINIO_TEMP_BUCKET: z.string().min(1, 'MINIO_TEMP_BUCKET is required'),
  MINIO_PERSIST_BUCKET: z.string().min(1, 'MINIO_PERSIST_BUCKET is required'),
  MINIO_TEMP_BUCKET_TTL_DAYS: z.coerce.number().default(1),
  MINIO_MAX_UPLOAD_BYTES: z.coerce.number().default(104857600), // 100MB
  MINIO_USE_TLS: z
    .preprocess((val) => val === 'true' || val === true, z.boolean())
    .default(false),
  MINIO_NOTIFY_EXCHANGE: z.string().min(1, 'MINIO_NOTIFY_EXCHANGE is required'),
  MINIO_API_CORS_ALLOW_ORIGIN: z.string().min(1, 'MINIO_API_CORS_ALLOW_ORIGIN is required'),

  RMQ_ADDR: z.string().min(1, 'RMQ_ADDR is required'),
  RMQ_USER: z.string().min(1, 'RMQ_USER is required'),
  RMQ_PASS: z.string().min(1, 'RMQ_PASS is required'),

  SMTP_HOST: z.string().min(1, 'SMTP_HOST is required'),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().min(1, 'SMTP_USER is required'),
  SMTP_PASS: z.string().min(1, 'SMTP_PASS is required'),

  ENVIRONMENT: z.string().optional().default('development'),
  WORKER_METRICS_PORT: z.coerce.number().optional().default(8081),
  DATABASE_URL: z.string().optional(),
});

function loadEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const errorDetails = result.error.issues
      .map((err: z.ZodIssue) => `${err.path.join('.')}: ${err.message}`)
      .join('\n');
    throw new Error(`[Config Panic] Environment validation failed:\n${errorDetails}`);
  }

  const raw = result.data;
  const presignedUser = raw.MINIO_PRESIGNED_USER || raw.MINIO_ROOT_USER;
  const presignedPass = raw.MINIO_PRESIGNED_PASSWORD || raw.MINIO_ROOT_PASSWORD;
  const corsOrigins = raw.MINIO_API_CORS_ALLOW_ORIGIN.split(',').map((s) => s.trim());

  const databaseUrl =
    raw.DATABASE_URL ||
    `postgresql://${raw.PG_USER}:${encodeURIComponent(raw.PG_PASSWORD)}@${raw.PG_ADDRESS}:${raw.PG_PORT}/${raw.PG_NAME}?sslmode=${raw.PG_SSLMODE}`;

  return {
    version: raw.VERSION,
    service: raw.SERVICE_NAME,
    addr: raw.ADDR,
    port: raw.PORT,
    jwtSecret: raw.JWT_SECRET,
    hashPepper: raw.HASH_PEPPER,
    bcryptCost: raw.BCRYPT_COST,
    postgres: {
      user: raw.PG_USER,
      pass: raw.PG_PASSWORD,
      port: raw.PG_PORT,
      addr: raw.PG_ADDRESS,
      databaseName: raw.PG_NAME,
      sslMode: raw.PG_SSLMODE,
      superUser: raw.PG_SUPERUSER,
      superDatabase: raw.PG_SUPERDB,
      databaseUrl,
    },
    redis: {
      addr: raw.REDIS_ADDR,
      user: raw.REDIS_USER,
      pass: raw.REDIS_PASSWORD,
    },
    email: raw.EMAIL,
    mailtrap: {
      user: raw.MAILTRAP_USERNAME,
      pass: raw.MAILTRAP_PASSWORD,
    },
    minio: {
      endpoint: raw.MINIO_ADDR,
      publicEndpoint: raw.MINIO_PUBLIC_ENDPOINT,
      rootUser: raw.MINIO_ROOT_USER,
      rootPass: raw.MINIO_ROOT_PASSWORD,
      presignedUser,
      presignedPass,
      tempBucket: raw.MINIO_TEMP_BUCKET,
      storageBucket: raw.MINIO_PERSIST_BUCKET,
      ttlDays: raw.MINIO_TEMP_BUCKET_TTL_DAYS,
      maxUploadBytes: raw.MINIO_MAX_UPLOAD_BYTES,
      secure: raw.MINIO_USE_TLS,
      exchangeQueue: raw.MINIO_NOTIFY_EXCHANGE,
      allowedOrigins: corsOrigins,
    },
    rabbitmq: {
      addr: raw.RMQ_ADDR,
      user: raw.RMQ_USER,
      pass: raw.RMQ_PASS,
      url: `amqp://${raw.RMQ_USER}:${encodeURIComponent(raw.RMQ_PASS)}@${raw.RMQ_ADDR}/`,
    },
    smtp: {
      host: raw.SMTP_HOST,
      port: raw.SMTP_PORT,
      user: raw.SMTP_USER,
      pass: raw.SMTP_PASS,
    },
    environment: raw.ENVIRONMENT,
    workerMetricsPort: raw.WORKER_METRICS_PORT,
  };
}

export type Config = ReturnType<typeof loadEnv>;

let configInstance: Config | null = null;

export function getConfig(): Config {
  if (!configInstance) {
    configInstance = loadEnv();
  }
  return configInstance;
}

export const config = ((): Config => {
  // If in test or build environments, allow lazy/safe load
  try {
    return getConfig();
  } catch (err) {
    // If not loaded yet (e.g. during build without env), return null as any for now
    return null as unknown as Config;
  }
})();
