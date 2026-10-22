import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { DatabaseConfigurationError, pool, resolveDatabaseConfig } from '../db/index.ts';
import { apiRouter } from '../api/routes.ts';

const app = express();
app.use(express.json());
app.use('/api/v1', apiRouter);

const ENV_KEYS = ['SQL_HOST', 'SQL_DB_NAME', 'SQL_USER', 'SQL_PASSWORD', 'SQL_ADMIN_USER', 'SQL_ADMIN_PASSWORD', 'SQL_PORT', 'NODE_ENV'] as const;

describe('Database Configuration & Authentication Failure Handling', () => {
  const savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

  beforeEach(() => {
    for (const k of ENV_KEYS) {
      savedEnv[k] = process.env[k];
      if (k !== 'NODE_ENV') {
        delete process.env[k];
      }
    }
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (savedEnv[k] === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = savedEnv[k];
      }
    }
    vi.restoreAllMocks();
  });

  describe('resolveDatabaseConfig', () => {
    it('reports a clear DatabaseConfigurationError when required variables are missing', () => {
      const status = resolveDatabaseConfig({});
      expect(status.configured).toBe(false);
      expect(status.missing).toEqual(['SQL_HOST', 'SQL_DB_NAME', 'SQL_USER', 'SQL_PASSWORD']);
      expect(status.error).toBeInstanceOf(DatabaseConfigurationError);
      expect(status.error?.message).toContain('SQL_HOST, SQL_DB_NAME, SQL_USER, SQL_PASSWORD');
    });

    it('prefers least-privilege SQL_USER and SQL_PASSWORD over admin credentials and safely defaults port to 5432', () => {
      const status = resolveDatabaseConfig({
        NODE_ENV: 'development',
        SQL_HOST: '10.0.0.5',
        SQL_DB_NAME: 'smartmess',
        SQL_USER: 'app_user',
        SQL_PASSWORD: 'app_secret_placeholder',
        SQL_ADMIN_USER: 'admin_user',
        SQL_ADMIN_PASSWORD: 'admin_secret_placeholder',
      });

      expect(status.configured).toBe(true);
      expect(status.usingAdminFallback).toBe(false);
      expect(status.config?.user).toBe('app_user');
      expect(status.config?.port).toBe(5432);
    });

    it('safely applies custom SQL_PORT when provided or 5432 when invalid', () => {
      const customStatus = resolveDatabaseConfig({
        NODE_ENV: 'development',
        SQL_HOST: '10.0.0.5',
        SQL_DB_NAME: 'smartmess',
        SQL_USER: 'app_user',
        SQL_PASSWORD: 'app_secret_placeholder',
        SQL_PORT: '5433',
      });
      expect(customStatus.configured).toBe(true);
      expect(customStatus.config?.port).toBe(5433);

      const invalidPortStatus = resolveDatabaseConfig({
        NODE_ENV: 'development',
        SQL_HOST: '10.0.0.5',
        SQL_DB_NAME: 'smartmess',
        SQL_USER: 'app_user',
        SQL_PASSWORD: 'app_secret_placeholder',
        SQL_PORT: 'not-a-number',
      });
      expect(invalidPortStatus.configured).toBe(true);
      expect(invalidPortStatus.config?.port).toBe(5432);
    });

    it('supports SQL_ADMIN_USER and SQL_ADMIN_PASSWORD fallback only outside production', () => {
      const devStatus = resolveDatabaseConfig({
        NODE_ENV: 'development',
        SQL_HOST: '10.0.0.5',
        SQL_DB_NAME: 'smartmess',
        SQL_ADMIN_USER: 'admin_user',
        SQL_ADMIN_PASSWORD: 'admin_secret_placeholder',
      });
      expect(devStatus.configured).toBe(true);
      expect(devStatus.usingAdminFallback).toBe(true);
      expect(devStatus.config?.user).toBe('admin_user');

      const prodStatus = resolveDatabaseConfig({
        NODE_ENV: 'production',
        SQL_HOST: '10.0.0.5',
        SQL_DB_NAME: 'smartmess',
        SQL_ADMIN_USER: 'admin_user',
        SQL_ADMIN_PASSWORD: 'admin_secret_placeholder',
      });
      expect(prodStatus.configured).toBe(false);
      expect(prodStatus.missing).toEqual(['SQL_USER', 'SQL_PASSWORD']);
    });
  });

  describe('Pool & Health Endpoint Without Database Configuration', () => {
    it('rejects pool.connect() and pool.query() with DatabaseConfigurationError instead of connecting to localhost', async () => {
      await expect(pool.connect()).rejects.toBeInstanceOf(DatabaseConfigurationError);
      await expect(pool.query('SELECT 1')).rejects.toBeInstanceOf(DatabaseConfigurationError);
    });

    it('returns HTTP 503 with an explicit non-sensitive configuration error on GET /api/v1/health', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(503);
      expect(res.body.status).toBe('degraded');
      expect(res.body.database).toBe('disconnected');
      expect(res.body.error).toMatch(/Missing required environment variables/i);
      expect(res.body.stack).toBeUndefined();
    });
  });

  describe('Authentication Database Failure Handling', () => {
    it('returns HTTP 200 synthetic demo session when PostgreSQL is intentionally unconfigured', async () => {
      const sessionRes = await request(app)
        .post('/api/v1/auth/session')
        .send({ demoRole: 'manager' });

      expect(sessionRes.status).toBe(200);
      expect(sessionRes.body.token).toBe('demo-token-manager');
      expect(sessionRes.body.user?.role).toBe('manager');

      const menusRes = await request(app)
        .get('/api/v1/menus')
        .set('Authorization', 'Bearer demo-token-manager');

      expect(menusRes.status).toBe(200);
    });

    it('returns HTTP 503 without leaking stack traces when demo token database lookup fails on protected routes', async () => {
      process.env.SQL_HOST = '127.0.0.1';
      process.env.SQL_PORT = '1';
      process.env.SQL_DB_NAME = 'smartmess';
      process.env.SQL_USER = 'app_user';
      process.env.SQL_PASSWORD = 'app_secret_placeholder';

      const res = await request(app)
        .get('/api/v1/menus')
        .set('Authorization', 'Bearer demo-token-manager');

      expect(res.status).toBe(503);
      expect(res.body.error).toBe('Service Unavailable: Authentication database lookup failed.');
      expect(res.body.stack).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toMatch(/select|password|ECONNREFUSED/i);
    });

    it('returns HTTP 503 without leaking stack traces when POST /api/v1/auth/session encounters a database lookup failure', async () => {
      process.env.SQL_HOST = '127.0.0.1';
      process.env.SQL_PORT = '1';
      process.env.SQL_DB_NAME = 'smartmess';
      process.env.SQL_USER = 'app_user';
      process.env.SQL_PASSWORD = 'app_secret_placeholder';

      const res = await request(app)
        .post('/api/v1/auth/session')
        .send({ demoRole: 'manager' });

      expect(res.status).toBe(503);
      expect(res.body.error).toBe('Service Unavailable: Authentication database lookup failed.');
      expect(res.body.stack).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toMatch(/select|password|ECONNREFUSED/i);
    });
  });
});
