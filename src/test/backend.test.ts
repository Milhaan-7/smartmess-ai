import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { apiRouter } from '../api/routes.ts';
import { seedDatabaseIfEmpty, DEFAULT_MESS_ID } from '../db/seed.ts';
import { db } from '../db/index.ts';
import { menus, menuItems, mealRecords } from '../db/schema.ts';
import { eq } from 'drizzle-orm';

const app = express();
app.use(express.json());
app.use('/api/v1', apiRouter);

const MANAGER_AUTH = 'Bearer test-token-manager';
const STAFF_AUTH = 'Bearer test-token-staff';
const STUDENT_AUTH = 'Bearer test-token-student';

describe('Backend API & Cloud SQL Database Integration (Phase 2)', () => {
  beforeAll(async () => {
    // Seed initial dataset if empty or missing records
    await seedDatabaseIfEmpty();
  });

  describe('Health Endpoint (Public)', () => {
    it('reports database as healthy and connected without authentication', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.database).toBe('connected');
      expect(res.body.engine).toBe('postgresql');
    });
  });

  describe('Authentication & Role-Based Authorization Enforcement', () => {
    it('rejects unauthenticated requests to protected endpoints with 401 Unauthorized', async () => {
      const resMenus = await request(app).get('/api/v1/menus');
      expect(resMenus.status).toBe(401);
      expect(resMenus.body.error).toMatch(/Unauthorized/i);

      const resRecords = await request(app).get('/api/v1/records');
      expect(resRecords.status).toBe(401);
      expect(resRecords.body.error).toMatch(/Unauthorized/i);

      const resSettings = await request(app).get('/api/v1/settings');
      expect(resSettings.status).toBe(401);
      expect(resSettings.body.error).toMatch(/Unauthorized/i);
    });

    it('rejects student role from mutating menus with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/v1/menus')
        .set('Authorization', STUDENT_AUTH)
        .send({
          date: '2029-11-20',
          meal: 'lunch',
          items: [{ name: 'Rice', kgPerPortion: 0.3 }],
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Forbidden/i);
    });

    it('rejects student role from accessing operational records with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/records')
        .set('Authorization', STUDENT_AUTH);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Forbidden/i);
    });

    it('rejects student role from updating settings with 403 Forbidden', async () => {
      const res = await request(app)
        .put('/api/v1/settings')
        .set('Authorization', STUDENT_AUTH)
        .send({
          institutionName: 'Greenfield University',
          messName: 'North Hostel Mess',
          messManager: 'Hacker Student',
          prepBufferPct: 15,
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Forbidden/i);
    });

    it('allows student role to read menus (dining view)', async () => {
      const res = await request(app)
        .get('/api/v1/menus')
        .set('Authorization', STUDENT_AUTH);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('allows kitchen staff to read records but forbids them from deleting menus', async () => {
      // Kitchen staff can read records
      const resRecords = await request(app)
        .get('/api/v1/records')
        .set('Authorization', STAFF_AUTH);
      expect(resRecords.status).toBe(200);

      // Kitchen staff cannot delete menus
      const resDelete = await request(app)
        .delete('/api/v1/menus/menu-any-fake')
        .set('Authorization', STAFF_AUTH);
      expect(resDelete.status).toBe(403);
    });
  });

  describe('Menu Lifecycle & Validation (Manager Authenticated)', () => {
    const testDate = '2029-11-20';
    const testMeal = 'lunch';
    const testMenuId = `menu-${testDate}-${testMeal}`;

    it('rejects invalid inputs on POST /api/v1/menus', async () => {
      // Invalid date
      const badDate = await request(app)
        .post('/api/v1/menus')
        .set('Authorization', MANAGER_AUTH)
        .send({ date: 'not-a-date', meal: 'lunch', items: [{ name: 'Rice', kgPerPortion: 0.3 }] });
      expect(badDate.status).toBe(400);

      // Empty items
      const emptyItems = await request(app)
        .post('/api/v1/menus')
        .set('Authorization', MANAGER_AUTH)
        .send({ date: testDate, meal: 'lunch', items: [] });
      expect(emptyItems.status).toBe(400);

      // Negative portion weight
      const badKg = await request(app)
        .post('/api/v1/menus')
        .set('Authorization', MANAGER_AUTH)
        .send({ date: testDate, meal: 'lunch', items: [{ name: 'Rice', kgPerPortion: -0.5 }] });
      expect(badKg.status).toBe(400);

      // Duplicate item in same menu
      const dupItem = await request(app)
        .post('/api/v1/menus')
        .set('Authorization', MANAGER_AUTH)
        .send({
          date: testDate,
          meal: 'lunch',
          items: [
            { name: 'Rice', kgPerPortion: 0.3 },
            { name: 'rice', kgPerPortion: 0.2 },
          ],
        });
      expect(dupItem.status).toBe(400);
      expect(dupItem.body.error).toMatch(/Duplicate item/i);
    });

    it('creates a new menu and items transactionally', async () => {
      // Clean up if already exists
      await db.delete(menus).where(eq(menus.id, testMenuId));

      const res = await request(app)
        .post('/api/v1/menus')
        .set('Authorization', MANAGER_AUTH)
        .send({
          date: testDate,
          meal: testMeal,
          items: [
            { name: 'Jeera Rice', kgPerPortion: 0.25 },
            { name: 'Yellow Dal', kgPerPortion: 0.15 },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe(testMenuId);
      expect(res.body.items).toHaveLength(2);

      // Verify persistent retrieval in DB
      const dbMenu = await db.select().from(menus).where(eq(menus.id, testMenuId));
      expect(dbMenu).toHaveLength(1);
      const dbItems = await db.select().from(menuItems).where(eq(menuItems.menuId, testMenuId));
      expect(dbItems).toHaveLength(2);
    });

    it('rejects duplicate menu for the same date and meal with 409 Conflict', async () => {
      const res = await request(app)
        .post('/api/v1/menus')
        .set('Authorization', MANAGER_AUTH)
        .send({
          date: testDate,
          meal: testMeal,
          items: [{ name: 'Curd Rice', kgPerPortion: 0.2 }],
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/already exists/i);
    });

    it('updates an existing menu on PUT /api/v1/menus/:id', async () => {
      const res = await request(app)
        .put(`/api/v1/menus/${testMenuId}`)
        .set('Authorization', MANAGER_AUTH)
        .send({
          date: testDate,
          meal: testMeal,
          items: [
            { name: 'Jeera Rice', kgPerPortion: 0.3 },
            { name: 'Dal Makhani', kgPerPortion: 0.18 },
            { name: 'Gulab Jamun', kgPerPortion: 0.08 },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(3);

      const dbItems = await db.select().from(menuItems).where(eq(menuItems.menuId, testMenuId));
      expect(dbItems).toHaveLength(3);
    });

    it('deletes a menu with no operational record', async () => {
      const res = await request(app)
        .delete(`/api/v1/menus/${testMenuId}`)
        .set('Authorization', MANAGER_AUTH);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const dbMenu = await db.select().from(menus).where(eq(menus.id, testMenuId));
      expect(dbMenu).toHaveLength(0);
    });
  });

  describe('Approval Protection & Lock Rules', () => {
    const lockedDate = '2029-12-01';
    const lockedMeal = 'dinner';
    const lockedMenuId = `menu-${lockedDate}-${lockedMeal}`;
    const lockedRecordId = `rec-${lockedDate}-${lockedMeal}`;

    beforeAll(async () => {
      await db.delete(mealRecords).where(eq(mealRecords.id, lockedRecordId));
      await db.delete(menus).where(eq(menus.id, lockedMenuId));

      await db.insert(menus).values({
        id: lockedMenuId,
        messId: DEFAULT_MESS_ID,
        serviceDate: lockedDate,
        meal: lockedMeal,
      });

      await db.insert(menuItems).values({
        id: `${lockedMenuId}-it1`,
        menuId: lockedMenuId,
        name: 'Chapati',
        kgPerPortion: 0.08,
      });

      await db.insert(mealRecords).values({
        id: lockedRecordId,
        messId: DEFAULT_MESS_ID,
        serviceDate: lockedDate,
        meal: lockedMeal,
        status: 'approved',
        context: 'normal',
        predictedDiners: 500,
        lowerDiners: 470,
        upperDiners: 530,
        baselineDiners: 490,
        forecastSource: 'rule_based',
        approvedAt: `${lockedDate}T08:00:00Z`,
        approvedBy: 'Meera Krishnan',
      });
    });

    it('rejects DELETE /api/v1/menus/:id with HTTP 409 when an approved plan exists', async () => {
      const res = await request(app)
        .delete(`/api/v1/menus/${lockedMenuId}`)
        .set('Authorization', MANAGER_AUTH);
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/approved or completed/i);

      // Verify menu still exists in database
      const check = await db.select().from(menus).where(eq(menus.id, lockedMenuId));
      expect(check).toHaveLength(1);
    });

    it('blocks moving the date or meal of a menu that has an active plan', async () => {
      const res = await request(app)
        .put(`/api/v1/menus/${lockedMenuId}`)
        .set('Authorization', MANAGER_AUTH)
        .send({
          date: '2029-12-02', // moved date!
          meal: lockedMeal,
          items: [{ name: 'Chapati', kgPerPortion: 0.08 }],
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/Date and meal cannot change/i);
    });
  });

  describe('Settings API', () => {
    it('reads and updates settings under manager authorization', async () => {
      const getRes = await request(app)
        .get('/api/v1/settings')
        .set('Authorization', MANAGER_AUTH);
      expect(getRes.status).toBe(200);
      expect(getRes.body.institutionName).toBeDefined();

      const updateRes = await request(app)
        .put('/api/v1/settings')
        .set('Authorization', MANAGER_AUTH)
        .send({
          ...getRes.body,
          prepBufferPct: 12,
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.prepBufferPct).toBe(12);

      // Verify persistent in DB
      const verifyRes = await request(app)
        .get('/api/v1/settings')
        .set('Authorization', MANAGER_AUTH);
      expect(verifyRes.body.prepBufferPct).toBe(12);

      // Restore to default 8%
      await request(app)
        .put('/api/v1/settings')
        .set('Authorization', MANAGER_AUTH)
        .send({
          ...getRes.body,
          prepBufferPct: 8,
        });
    });
  });
});
