import * as dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';
import * as schema from './schema.ts';

dotenv.config();

export class DatabaseConfigurationError extends Error {
  readonly missingVariables: string[];

  constructor(missingVariables: string[]) {
    super(
      `Database configuration error: Missing required environment variables (${missingVariables.join(', ')}). Configure these in .env before using database persistence.`,
    );
    this.name = 'DatabaseConfigurationError';
    this.missingVariables = missingVariables;
  }
}

export interface DatabaseConfigStatus {
  configured: boolean;
  missing: string[];
  usingAdminFallback: boolean;
  config?: PoolConfig;
  error?: DatabaseConfigurationError;
}

export function isConfigError(error?: any): boolean {
  const status = resolveDatabaseConfig();
  if (!status.configured) return true;

  let current = error;
  while (current) {
    if (
      current instanceof DatabaseConfigurationError ||
      current.name === 'DatabaseConfigurationError' ||
      (typeof current.message === 'string' &&
        (current.message.includes('Database configuration error') ||
          current.message.includes('Missing required environment variables')))
    ) {
      return true;
    }
    current = current.cause;
  }
  return false;
}

export function resolveDatabaseConfig(env: NodeJS.ProcessEnv = process.env): DatabaseConfigStatus {
  const isProduction = env.NODE_ENV === 'production';
  const host = env.SQL_HOST?.trim();
  const database = env.SQL_DB_NAME?.trim();
  const appUser = env.SQL_USER?.trim();
  const appPassword = env.SQL_PASSWORD;
  const adminUser = !isProduction ? env.SQL_ADMIN_USER?.trim() : undefined;
  const adminPassword = !isProduction ? env.SQL_ADMIN_PASSWORD : undefined;

  const user = appUser || adminUser;
  const password = appPassword || adminPassword;
  const usingAdminFallback = Boolean(!appUser && adminUser) || Boolean(!appPassword && adminPassword);

  const missing: string[] = [];
  if (!host) missing.push('SQL_HOST');
  if (!database) missing.push('SQL_DB_NAME');
  if (!user) missing.push('SQL_USER');
  if (!password) missing.push('SQL_PASSWORD');

  if (missing.length > 0) {
    return {
      configured: false,
      missing,
      usingAdminFallback: false,
      error: new DatabaseConfigurationError(missing),
    };
  }

  const rawPort = env.SQL_PORT?.trim();
  const parsedPort = rawPort ? Number(rawPort) : 5432;
  const port = !Number.isNaN(parsedPort) && parsedPort > 0 ? parsedPort : 5432;

  return {
    configured: true,
    missing: [],
    usingAdminFallback,
    config: {
      host,
      user,
      password,
      database,
      port,
      max: 10,
      connectionTimeoutMillis: 15000,
    },
  };
}

declare global {
  // eslint-disable-next-line no-var
  var _postgresPool: Pool | undefined;
}

export const createPool = () => {
  if (!global._postgresPool) {
    const status = resolveDatabaseConfig();
    if (status.usingAdminFallback) {
      console.warn(
        '[DB] Using SQL_ADMIN_USER/SQL_ADMIN_PASSWORD fallback in non-production. Prefer least-privilege SQL_USER/SQL_PASSWORD for application runtime.',
      );
    }

    const instance = new Pool(
      status.config ?? {
        max: 10,
        connectionTimeoutMillis: 15000,
      },
    );

    const origConnect = instance.connect.bind(instance);
    const origQuery = instance.query.bind(instance);

    const syncPoolOptions = (cfg: PoolConfig) => {
      const opts = (instance as any).options;
      if (opts && cfg) {
        opts.host = cfg.host;
        opts.user = cfg.user;
        opts.password = cfg.password;
        opts.database = cfg.database;
        if (cfg.port) opts.port = cfg.port;
      }
    };

    instance.connect = ((callback?: any) => {
      const current = resolveDatabaseConfig();
      if (!current.configured && current.error) {
        if (typeof callback === 'function') {
          callback(current.error, undefined, () => {});
          return undefined as any;
        }
        return Promise.reject(current.error);
      }
      if (current.config) syncPoolOptions(current.config);
      return callback ? origConnect(callback) : origConnect();
    }) as typeof instance.connect;

    instance.query = ((...args: any[]) => {
      const current = resolveDatabaseConfig();
      if (!current.configured && current.error) {
        const lastArg = args[args.length - 1];
        if (typeof lastArg === 'function') {
          lastArg(current.error, undefined);
          return undefined as any;
        }
        return Promise.reject(current.error);
      }
      if (current.config) syncPoolOptions(current.config);
      return (origQuery as any)(...args);
    }) as typeof instance.query;

    instance.on('error', (err: Error) => {
      console.error('Unexpected error on idle SQL pool client:', err.message);
    });

    global._postgresPool = instance;
  }
  return global._postgresPool;
};

export const pool = createPool();
export const db = drizzle(pool, { schema });
