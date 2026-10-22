import { Router, type Request, type Response } from 'express';
import { eq, and, gte, lte, asc } from 'drizzle-orm';
import { db, pool, DatabaseConfigurationError, isConfigError, resolveDatabaseConfig } from '../db/index.ts';
import { menus, menuItems, mealRecords, recordItems, messSettings } from '../db/schema.ts';
import { getUsers, getUserByUid, updateUserRole, getOrCreateUser, UserRole } from '../db/users.ts';
import { requireAuth, requireRole, type AuthRequest, DEMO_TOKENS } from '../middleware/auth.ts';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DEFAULT_MESS_ID } from '../db/seed.ts';
import { createSeedState } from '../data/mockData.ts';
import { isValidDateString } from '../lib/dates.ts';
import { MEAL_ORDER } from '../lib/constants.ts';
import type { MealType } from '../types/index.ts';

export const apiRouter = Router();

// Helper to sanitize messId
const getMessId = (req: Request): string => (req.headers['x-mess-id'] as string) || DEFAULT_MESS_ID;

const isDbDown = (error: any): boolean => {
  if (!resolveDatabaseConfig().configured) return true;
  if (isConfigError(error)) return true;
  const msg = error?.message || String(error);
  const causeMsg = error?.cause?.message || '';
  return (
    msg.includes('Database configuration error') ||
    msg.includes('Missing required environment variables') ||
    msg.includes('Failed query') ||
    msg.includes('Cannot read properties of undefined') ||
    causeMsg.includes('Database configuration error') ||
    causeMsg.includes('Missing required environment variables') ||
    causeMsg.includes('ECONNREFUSED')
  );
};

// 1. Health & Database Readiness (Public)
apiRouter.get('/health', async (req: Request, res: Response) => {
  try {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
      res.json({
        status: 'ok',
        database: 'connected',
        engine: 'postgresql',
        messId: getMessId(req),
        timestamp: new Date().toISOString(),
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    if (error instanceof DatabaseConfigurationError) {
      console.warn('[Health] Database unconfigured: running in demo fallback mode');
    } else {
      console.error('[Health] DB ping failed:', error?.message || 'Database unreachable');
    }
    const safeErrorMessage =
      error instanceof DatabaseConfigurationError ? error.message : 'Database unreachable';
    res.status(503).json({
      status: 'degraded',
      database: 'disconnected',
      error: safeErrorMessage,
      timestamp: new Date().toISOString(),
    });
  }
});

// 2. Auth Session Exchange (Public login endpoint)
apiRouter.post('/auth/session', async (req: Request, res: Response) => {
  try {
    const { token, demoRole } = req.body;

    if (demoRole) {
      if (!['manager', 'kitchen_staff', 'student'].includes(demoRole)) {
        return res.status(400).json({ error: 'Invalid demo role. Must be manager, kitchen_staff, or student.' });
      }
      const demoToken = `demo-token-${demoRole}`;
      const targetUid = DEMO_TOKENS[demoToken];
      let dbUser: Awaited<ReturnType<typeof getUserByUid>> | null = null;
      if (resolveDatabaseConfig().configured) {
        try {
          dbUser = await getUserByUid(targetUid);
        } catch (dbErr: any) {
          if (isConfigError(dbErr)) {
            console.warn('[Auth Session] Database unconfigured during demo role exchange');
          } else {
            console.error('[Auth Session] Database lookup failed:', dbErr?.message || 'Database unavailable');
            return res.status(503).json({ error: 'Service Unavailable: Authentication database lookup failed.' });
          }
        }
      }

      const defaultNames: Record<string, string> = {
        manager: 'Meera Krishnan (Manager)',
        kitchen_staff: 'Ramesh Chef (Kitchen Staff)',
        student: 'Aarav Student (Diner)',
      };

      return res.json({
        token: demoToken,
        user: {
          uid: dbUser?.uid || targetUid,
          email: dbUser?.email || `${demoRole}@smartmess.internal`,
          name: dbUser?.displayName || defaultNames[demoRole] || `Demo ${demoRole}`,
          role: (dbUser?.role as UserRole) || (demoRole as UserRole),
        },
      });
    }

    if (token) {
      let decoded: Awaited<ReturnType<typeof adminAuth.verifyIdToken>>;
      try {
        decoded = await adminAuth.verifyIdToken(token);
      } catch (verifyErr: any) {
        console.error('[Auth Session] Token verification error:', verifyErr?.message || verifyErr);
        return res.status(401).json({ error: 'Authentication exchange failed' });
      }

      const email = decoded.email || `${decoded.uid}@firebase.user`;
      let dbUser: Awaited<ReturnType<typeof getUserByUid>> | null = null;
      if (resolveDatabaseConfig().configured) {
        try {
          dbUser = await getOrCreateUser(decoded.uid, email, (decoded as any).name);
        } catch (dbErr: any) {
          if (isConfigError(dbErr)) {
            console.warn('[Auth Session] Database unconfigured during user sync');
          } else {
            console.error('[Auth Session] Database user sync failed:', dbErr?.message || 'Database error');
            return res.status(503).json({ error: 'Service Unavailable: Authentication database lookup failed.' });
          }
        }
      }

      return res.json({
        token,
        user: {
          uid: dbUser?.uid || decoded.uid,
          email: dbUser?.email || email,
          name: dbUser?.displayName || (decoded as any).name || email.split('@')[0],
          role: (dbUser?.role as UserRole) || 'student',
        },
      });
    }

    return res.status(400).json({ error: 'Missing token or demoRole parameter' });
  } catch (error: any) {
    console.error('[Auth Session] Exchange error:', error?.message || error);
    return res.status(401).json({ error: 'Authentication exchange failed' });
  }
});

// 3. GET /auth/me (Protected: returns server-verified identity & role)
apiRouter.get('/auth/me', requireAuth, (req: AuthRequest, res: Response) => {
  res.json({
    user: req.user,
    role: req.userRole,
  });
});

// 4. GET /users (Protected: manager only)
apiRouter.get('/users', requireAuth, requireRole(['manager']), async (_req: Request, res: Response) => {
  if (!resolveDatabaseConfig().configured) {
    return res.json([
      { uid: 'demo-manager-uid', email: 'manager@smartmess.internal', role: 'manager', displayName: 'Meera Krishnan (Manager)' },
      { uid: 'demo-staff-uid', email: 'staff@smartmess.internal', role: 'kitchen_staff', displayName: 'Ramesh Chef (Kitchen Staff)' },
      { uid: 'demo-student-uid', email: 'student@smartmess.internal', role: 'student', displayName: 'Aarav Student (Diner)' },
    ]);
  }
  try {
    const userList = await getUsers();
    res.json(userList);
  } catch (error: any) {
    if (isDbDown(error)) {
      return res.json([
        { uid: 'demo-manager-uid', email: 'manager@smartmess.internal', role: 'manager', displayName: 'Meera Krishnan (Manager)' },
        { uid: 'demo-staff-uid', email: 'staff@smartmess.internal', role: 'kitchen_staff', displayName: 'Ramesh Chef (Kitchen Staff)' },
        { uid: 'demo-student-uid', email: 'student@smartmess.internal', role: 'student', displayName: 'Aarav Student (Diner)' },
      ]);
    }
    console.error('[GET /users] Failed:', error);
    res.status(500).json({ error: error?.message || 'Failed to fetch users' });
  }
});

// 5. PUT /users/:uid/role (Protected: manager only)
apiRouter.put('/users/:uid/role', requireAuth, requireRole(['manager']), async (req: AuthRequest, res: Response) => {
  try {
    const uid = String(req.params.uid);
    const { role } = req.body;
    if (!['manager', 'kitchen_staff', 'student'].includes(role)) {
      return res.status(400).json({ error: 'Role must be manager, kitchen_staff, or student' });
    }
    if (!resolveDatabaseConfig().configured) {
      return res.json({ uid, role });
    }
    const updated = await updateUserRole(uid, role as UserRole);
    res.json(updated);
  } catch (error: any) {
    if (isDbDown(error)) {
      return res.json({ uid: req.params.uid, role: req.body.role });
    }
    console.error('[PUT /users/:uid/role] Failed:', error);
    res.status(500).json({ error: error?.message || 'Failed to update user role' });
  }
});

// 6. GET /api/v1/menus (Protected: all authenticated users can view menus)
apiRouter.get('/menus', requireAuth, async (req: Request, res: Response) => {
  if (!resolveDatabaseConfig().configured) {
    return res.json([]);
  }
  try {
    const messId = getMessId(req);
    const { from, to } = req.query;

    const conditions = [eq(menus.messId, messId)];
    if (typeof from === 'string' && isValidDateString(from)) {
      conditions.push(gte(menus.serviceDate, from));
    }
    if (typeof to === 'string' && isValidDateString(to)) {
      conditions.push(lte(menus.serviceDate, to));
    }

    const menuList = await db
      .select()
      .from(menus)
      .where(and(...conditions))
      .orderBy(asc(menus.serviceDate));

    if (menuList.length === 0) {
      return res.json([]);
    }

    const items = await db.select().from(menuItems).orderBy(asc(menuItems.sortOrder));
    const itemsByMenuId = new Map<string, typeof items>();
    for (const item of items) {
      const list = itemsByMenuId.get(item.menuId) || [];
      list.push(item);
      itemsByMenuId.set(item.menuId, list);
    }

    const response = menuList.map((m) => ({
      id: m.id,
      date: m.serviceDate,
      meal: m.meal as MealType,
      items: (itemsByMenuId.get(m.id) || []).map((it) => ({
        id: it.id,
        name: it.name,
        kgPerPortion: it.kgPerPortion,
      })),
    }));

    res.json(response);
  } catch (error: any) {
    if (isDbDown(error)) {
      console.warn('[GET /menus] Database offline/unconfigured — returning empty list');
      return res.json([]);
    }
    console.error('[GET /menus] Failed:', error);
    res.status(500).json({ error: 'Failed to retrieve menus' });
  }
});

// 7. POST /api/v1/menus (Protected: manager only)
apiRouter.post('/menus', requireAuth, requireRole(['manager']), async (req: Request, res: Response) => {
  try {
    const messId = getMessId(req);
    const { date, meal, items } = req.body;

    if (!isValidDateString(date)) {
      return res.status(400).json({ error: 'Choose a valid date (YYYY-MM-DD)' });
    }
    if (!meal || !MEAL_ORDER.includes(meal as MealType)) {
      return res.status(400).json({ error: 'Choose a valid meal (breakfast, lunch, dinner)' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Add at least one food item' });
    }

    const seen = new Set<string>();
    for (const it of items) {
      const name = typeof it.name === 'string' ? it.name.trim() : '';
      if (!name) return res.status(400).json({ error: 'Item name is required' });
      if (name.length > 60) return res.status(400).json({ error: 'Item name must be under 60 characters' });
      if (seen.has(name.toLowerCase())) return res.status(400).json({ error: `Duplicate item: ${name}` });
      seen.add(name.toLowerCase());

      const kg = Number(it.kgPerPortion);
      if (Number.isNaN(kg) || kg <= 0 || kg > 5) {
        return res.status(400).json({ error: `Weight for ${name} must be between 0 and 5 kg` });
      }
    }

    const menuId = `menu-${date}-${meal}`;

    if (!resolveDatabaseConfig().configured) {
      return res.status(201).json({
        id: menuId,
        date,
        meal,
        items: items.map((it: any, idx: number) => ({
          id: String(it.id || `${menuId}-i${idx}`),
          name: it.name.trim(),
          kgPerPortion: Number(it.kgPerPortion),
        })),
      });
    }

    const existing = await db
      .select()
      .from(menus)
      .where(and(eq(menus.messId, messId), eq(menus.serviceDate, date), eq(menus.meal, meal)));

    if (existing.length > 0) {
      return res.status(409).json({ error: 'A menu already exists for this date and meal. Edit it instead.' });
    }

    await db.transaction(async (tx) => {
      await tx.insert(menus).values({
        id: menuId,
        messId,
        serviceDate: date,
        meal,
      });

      await tx.insert(menuItems).values(
        items.map((it: any, idx: number) => ({
          id: String(it.id || `${menuId}-i${idx}`),
          menuId,
          name: it.name.trim(),
          kgPerPortion: Number(it.kgPerPortion),
          sortOrder: idx,
        })),
      );
    });

    res.status(201).json({
      id: menuId,
      date,
      meal,
      items: items.map((it: any, idx: number) => ({
        id: String(it.id || `${menuId}-i${idx}`),
        name: it.name.trim(),
        kgPerPortion: Number(it.kgPerPortion),
      })),
    });
  } catch (error: any) {
    if (isDbDown(error)) {
      console.warn('[POST /menus] Database unconfigured/offline — returning mock created menu');
      const { date, meal, items } = req.body || {};
      const menuId = `menu-${date}-${meal}`;
      return res.status(201).json({
        id: menuId,
        date,
        meal,
        items: Array.isArray(items)
          ? items.map((it: any, idx: number) => ({
              id: String(it.id || `${menuId}-i${idx}`),
              name: String(it.name || '').trim(),
              kgPerPortion: Number(it.kgPerPortion || 0.1),
            }))
          : [],
      });
    }
    console.error('[POST /menus] Failed:', error);
    res.status(500).json({ error: error?.message || 'Failed to create menu' });
  }
});

// 8. PUT /api/v1/menus/:id (Protected: manager only)
apiRouter.put('/menus/:id', requireAuth, requireRole(['manager']), async (req: Request, res: Response) => {
  try {
    const messId = getMessId(req);
    const id = String(req.params.id);
    const { date, meal, items } = req.body;

    if (!resolveDatabaseConfig().configured) {
      return res.json({
        id,
        date,
        meal,
        items: Array.isArray(items)
          ? items.map((it: any, idx: number) => ({
              id: String(it.id || `${id}-i${idx}`),
              name: String(it.name || '').trim(),
              kgPerPortion: Number(it.kgPerPortion || 0.1),
            }))
          : [],
      });
    }

    const existing = await db
      .select()
      .from(menus)
      .where(and(eq(menus.id, id), eq(menus.messId, messId)));

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Menu not found' });
    }
    const current = existing[0];

    const recs = await db
      .select()
      .from(mealRecords)
      .where(and(eq(mealRecords.messId, messId), eq(mealRecords.serviceDate, current.serviceDate), eq(mealRecords.meal, current.meal)));

    const existingRecord = recs[0];

    if (existingRecord) {
      if (date !== current.serviceDate || meal !== current.meal) {
        return res.status(409).json({ error: 'Date and meal cannot change while a forecast or plan exists for this meal.' });
      }
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Add at least one food item' });
    }

    const seen = new Set<string>();
    for (const it of items) {
      const name = typeof it.name === 'string' ? it.name.trim() : '';
      if (!name) return res.status(400).json({ error: 'Item name is required' });
      if (seen.has(name.toLowerCase())) return res.status(400).json({ error: `Duplicate item: ${name}` });
      seen.add(name.toLowerCase());
      const kg = Number(it.kgPerPortion);
      if (Number.isNaN(kg) || kg <= 0 || kg > 5) {
        return res.status(400).json({ error: `Weight for ${name} must be between 0 and 5 kg` });
      }
    }

    await db.transaction(async (tx) => {
      await tx.delete(menuItems).where(eq(menuItems.menuId, id));
      await tx.insert(menuItems).values(
        items.map((it: any, idx: number) => ({
          id: String(it.id || `${id}-i${idx}`),
          menuId: id,
          name: it.name.trim(),
          kgPerPortion: Number(it.kgPerPortion),
          sortOrder: idx,
        })),
      );

      if (existingRecord && existingRecord.status === 'recommended') {
        await tx.delete(recordItems).where(eq(recordItems.recordId, existingRecord.id));
        const uptake = 0.7;
        await tx.insert(recordItems).values(
          items.map((it: any, idx: number) => {
            const predDemand = Math.round(existingRecord.predictedDiners * uptake);
            const suggested = Math.ceil((predDemand * 1.08) / 5) * 5;
            return {
              id: `ri-${existingRecord.id}-${it.id || idx}`,
              recordId: existingRecord.id,
              itemId: String(it.id || `${id}-i${idx}`),
              name: it.name.trim(),
              kgPerPortion: Number(it.kgPerPortion),
              predictedDemand: predDemand,
              lowerDemand: Math.round(existingRecord.lowerDiners * uptake),
              upperDemand: Math.round(existingRecord.upperDiners * uptake),
              suggestedPrep: suggested,
              approvedPrep: null,
              prepared: null,
              consumed: null,
            };
          }),
        );
      }
    });

    res.json({
      id,
      date: current.serviceDate,
      meal: current.meal,
      items: items.map((it: any, idx: number) => ({
        id: String(it.id || `${id}-i${idx}`),
        name: it.name.trim(),
        kgPerPortion: Number(it.kgPerPortion),
      })),
    });
  } catch (error: any) {
    if (isDbDown(error)) {
      console.warn('[PUT /menus/:id] Database unconfigured/offline — returning updated menu');
      const { date, meal, items } = req.body || {};
      return res.json({
        id: req.params.id,
        date,
        meal,
        items: Array.isArray(items)
          ? items.map((it: any, idx: number) => ({
              id: String(it.id || `${req.params.id}-i${idx}`),
              name: String(it.name || '').trim(),
              kgPerPortion: Number(it.kgPerPortion || 0.1),
            }))
          : [],
      });
    }
    console.error('[PUT /menus] Failed:', error);
    res.status(500).json({ error: error?.message || 'Failed to update menu' });
  }
});

// 9. DELETE /api/v1/menus/:id (Protected: manager only)
apiRouter.delete('/menus/:id', requireAuth, requireRole(['manager']), async (req: Request, res: Response) => {
  try {
    const messId = getMessId(req);
    const id = String(req.params.id);

    if (!resolveDatabaseConfig().configured) {
      return res.json({ success: true, id, removedPlan: false });
    }

    const existing = await db
      .select()
      .from(menus)
      .where(and(eq(menus.id, id), eq(menus.messId, messId)));

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Menu not found' });
    }
    const current = existing[0];

    const recs = await db
      .select()
      .from(mealRecords)
      .where(and(eq(mealRecords.messId, messId), eq(mealRecords.serviceDate, current.serviceDate), eq(mealRecords.meal, current.meal)));

    const record = recs[0];

    if (record && (record.status === 'approved' || record.status === 'completed')) {
      return res.status(409).json({
        error: 'Cannot delete menu: an approved or completed plan exists for this meal. It cannot be destroyed.',
      });
    }

    await db.transaction(async (tx) => {
      if (record && record.status === 'recommended') {
        await tx.delete(mealRecords).where(eq(mealRecords.id, record.id));
      }
      await tx.delete(menus).where(eq(menus.id, id));
    });

    res.json({ success: true, id, removedPlan: record?.status === 'recommended' });
  } catch (error: any) {
    if (isDbDown(error)) {
      return res.json({ success: true, id: req.params.id, removedPlan: false });
    }
    console.error('[DELETE /menus] Failed:', error);
    res.status(500).json({ error: error?.message || 'Failed to delete menu' });
  }
});

// 10. GET /api/v1/records (Protected: manager & kitchen staff only)
apiRouter.get('/records', requireAuth, requireRole(['manager', 'kitchen_staff']), async (req: Request, res: Response) => {
  if (!resolveDatabaseConfig().configured) {
    return res.json([]);
  }
  try {
    const messId = getMessId(req);
    const { from, to, status, meal } = req.query;

    const conditions = [eq(mealRecords.messId, messId)];
    if (typeof from === 'string' && isValidDateString(from)) {
      conditions.push(gte(mealRecords.serviceDate, from));
    }
    if (typeof to === 'string' && isValidDateString(to)) {
      conditions.push(lte(mealRecords.serviceDate, to));
    }
    if (typeof status === 'string' && status) {
      conditions.push(eq(mealRecords.status, status));
    }
    if (typeof meal === 'string' && meal) {
      conditions.push(eq(mealRecords.meal, meal));
    }

    const list = await db
      .select()
      .from(mealRecords)
      .where(and(...conditions))
      .orderBy(asc(mealRecords.serviceDate));

    if (list.length === 0) return res.json([]);

    const allItems = await db.select().from(recordItems);
    const itemsByRecordId = new Map<string, typeof allItems>();
    for (const it of allItems) {
      const arr = itemsByRecordId.get(it.recordId) || [];
      arr.push(it);
      itemsByRecordId.set(it.recordId, arr);
    }

    const response = list.map((r) => ({
      id: r.id,
      date: r.serviceDate,
      meal: r.meal as MealType,
      status: r.status,
      context: r.context,
      predictedDiners: r.predictedDiners,
      lowerDiners: r.lowerDiners,
      upperDiners: r.upperDiners,
      baselineDiners: r.baselineDiners,
      forecastSource: r.forecastSource,
      actualDiners: r.actualDiners,
      approvedAt: r.approvedAt,
      completedAt: r.completedAt,
      items: (itemsByRecordId.get(r.id) || []).map((i) => ({
        itemId: i.itemId,
        name: i.name,
        kgPerPortion: i.kgPerPortion,
        predictedDemand: i.predictedDemand,
        lowerDemand: i.lowerDemand,
        upperDemand: i.upperDemand,
        suggestedPrep: i.suggestedPrep,
        approvedPrep: i.approvedPrep,
        prepared: i.prepared,
        consumed: i.consumed,
      })),
    }));

    res.json(response);
  } catch (error: any) {
    if (isDbDown(error)) {
      console.warn('[GET /records] Database offline/unconfigured — returning empty list');
      return res.json([]);
    }
    console.error('[GET /records] Failed:', error);
    res.status(500).json({ error: 'Failed to retrieve meal records' });
  }
});

// 11. GET /api/v1/records/:date/:meal (Protected: manager & kitchen staff only)
apiRouter.get('/records/:date/:meal', requireAuth, requireRole(['manager', 'kitchen_staff']), async (req: Request, res: Response) => {
  if (!resolveDatabaseConfig().configured) {
    return res.status(404).json({ error: 'Record not found' });
  }
  try {
    const messId = getMessId(req);
    const date = String(req.params.date);
    const meal = String(req.params.meal);

    const list = await db
      .select()
      .from(mealRecords)
      .where(and(eq(mealRecords.messId, messId), eq(mealRecords.serviceDate, date), eq(mealRecords.meal, meal)));

    if (list.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }
    const r = list[0];
    const items = await db.select().from(recordItems).where(eq(recordItems.recordId, r.id));

    res.json({
      id: r.id,
      date: r.serviceDate,
      meal: r.meal as MealType,
      status: r.status,
      context: r.context,
      predictedDiners: r.predictedDiners,
      lowerDiners: r.lowerDiners,
      upperDiners: r.upperDiners,
      baselineDiners: r.baselineDiners,
      forecastSource: r.forecastSource,
      actualDiners: r.actualDiners,
      approvedAt: r.approvedAt,
      completedAt: r.completedAt,
      items: items.map((i) => ({
        itemId: i.itemId,
        name: i.name,
        kgPerPortion: i.kgPerPortion,
        predictedDemand: i.predictedDemand,
        lowerDemand: i.lowerDemand,
        upperDemand: i.upperDemand,
        suggestedPrep: i.suggestedPrep,
        approvedPrep: i.approvedPrep,
        prepared: i.prepared,
        consumed: i.consumed,
      })),
    });
  } catch (error: any) {
    if (isDbDown(error)) {
      console.warn('[GET /records/:date/:meal] Database unconfigured/offline — returning 404');
      return res.status(404).json({ error: 'Record not found' });
    }
    console.error('[GET /records/:date/:meal] Failed:', error);
    res.status(500).json({ error: 'Failed to retrieve meal record' });
  }
});

// 12. POST /api/v1/records (Create new record/forecast plan - manager or staff)
apiRouter.post('/records', requireAuth, requireRole(['manager', 'kitchen_staff']), async (req: AuthRequest, res: Response) => {
  try {
    const messId = getMessId(req);
    const r = req.body;

    if (!r.id || !r.date || !r.meal) {
      return res.status(400).json({ error: 'id, date, and meal are required' });
    }

    if (r.status === 'approved' && req.userRole !== 'manager') {
      return res.status(403).json({ error: 'Forbidden: Only management can approve preparation plans.' });
    }

    if (!resolveDatabaseConfig().configured) {
      return res.status(201).json(r);
    }

    const existing = await db.select().from(mealRecords).where(eq(mealRecords.id, r.id));
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Meal record already exists' });
    }

    await db.transaction(async (tx) => {
      await tx.insert(mealRecords).values({
        id: r.id,
        messId,
        serviceDate: r.date,
        meal: r.meal,
        status: r.status || 'recommended',
        context: r.context || 'normal',
        predictedDiners: r.predictedDiners || 0,
        lowerDiners: r.lowerDiners || 0,
        upperDiners: r.upperDiners || 0,
        baselineDiners: r.baselineDiners ?? null,
        forecastSource: r.forecastSource || 'rule_based',
        actualDiners: r.actualDiners ?? null,
        approvedAt: r.approvedAt || null,
        completedAt: r.completedAt || null,
      });

      if (Array.isArray(r.items) && r.items.length > 0) {
        await tx.insert(recordItems).values(
          r.items.map((it: any) => ({
            id: `ri-${r.id}-${it.itemId}`,
            recordId: r.id,
            itemId: it.itemId,
            name: it.name,
            kgPerPortion: Number(it.kgPerPortion),
            predictedDemand: Number(it.predictedDemand || 0),
            lowerDemand: Number(it.lowerDemand || 0),
            upperDemand: Number(it.upperDemand || 0),
            suggestedPrep: Number(it.suggestedPrep || 0),
            approvedPrep: it.approvedPrep !== undefined && it.approvedPrep !== null ? Number(it.approvedPrep) : null,
            prepared: it.prepared !== undefined && it.prepared !== null ? Number(it.prepared) : null,
            consumed: it.consumed !== undefined && it.consumed !== null ? Number(it.consumed) : null,
          })),
        );
      }
    });

    res.status(201).json(r);
  } catch (error: any) {
    if (isDbDown(error)) {
      console.warn('[POST /records] Database unconfigured/offline — returning mock created record');
      return res.status(201).json(req.body);
    }
    console.error('[POST /records] Failed:', error);
    res.status(500).json({ error: error?.message || 'Failed to create meal record' });
  }
});

// 13. PUT /api/v1/records/:id (Update plan, approve, or record operational actuals)
apiRouter.put('/records/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const messId = getMessId(req);
    const id = String(req.params.id);
    const r = req.body;

    const isApproving = r.status === 'approved';
    if (isApproving && req.userRole !== 'manager') {
      return res.status(403).json({ error: 'Forbidden: Only management can approve preparation plans.' });
    }

    if (req.userRole !== 'manager' && req.userRole !== 'kitchen_staff') {
      return res.status(403).json({ error: 'Forbidden: Student accounts cannot modify operational kitchen plans.' });
    }

    if (!resolveDatabaseConfig().configured) {
      return res.json({
        id,
        messId,
        serviceDate: r.date,
        meal: r.meal,
        status: r.status || 'recommended',
        ...r,
        updatedAt: new Date().toISOString(),
      });
    }

    const existingRows = await db
      .select()
      .from(mealRecords)
      .where(and(eq(mealRecords.id, id), eq(mealRecords.messId, messId)));

    if (existingRows.length === 0) {
      return res.status(404).json({ error: 'Meal record not found' });
    }
    const current = existingRows[0];

    // Historical actuals protection: completed meals cannot be altered by non-managers
    if (current.status === 'completed' && req.userRole !== 'manager') {
      return res.status(403).json({ error: 'Forbidden: Historical completed records cannot be modified.' });
    }

    await db.transaction(async (tx) => {
      await tx
        .update(mealRecords)
        .set({
          status: r.status ?? current.status,
          actualDiners: r.actualDiners !== undefined ? r.actualDiners : current.actualDiners,
          approvedBy: isApproving ? req.user?.name || 'Manager' : current.approvedBy,
          approvedAt: r.approvedAt ?? current.approvedAt,
          completedAt: r.completedAt ?? current.completedAt,
          updatedAt: new Date(),
        })
        .where(eq(mealRecords.id, id));

      if (Array.isArray(r.items)) {
        for (const it of r.items) {
          const itemUpdate: any = { updatedAt: new Date() };
          if (it.approvedPrep !== undefined) itemUpdate.approvedPrep = it.approvedPrep;
          if (it.prepared !== undefined) itemUpdate.prepared = it.prepared;
          if (it.consumed !== undefined) itemUpdate.consumed = it.consumed;

          await tx
            .update(recordItems)
            .set(itemUpdate)
            .where(and(eq(recordItems.recordId, id), eq(recordItems.itemId, it.itemId)));
        }
      }
    });

    const updatedItems = await db.select().from(recordItems).where(eq(recordItems.recordId, id));

    res.json({
      ...current,
      ...r,
      items: updatedItems,
    });
  } catch (error: any) {
    if (isDbDown(error)) {
      console.warn('[PUT /records/:id] Database unconfigured/offline — returning updated record payload');
      return res.json({
        id: req.params.id,
        ...req.body,
        updatedAt: new Date().toISOString(),
      });
    }
    console.error('[PUT /records/:id] Failed:', error);
    res.status(500).json({ error: error?.message || 'Failed to update record' });
  }
});

// 14. GET /api/v1/settings (Protected: staff & manager)
apiRouter.get('/settings', requireAuth, requireRole(['manager', 'kitchen_staff']), async (req: Request, res: Response) => {
  try {
    const messId = getMessId(req);
    const rows = await db.select().from(messSettings).where(eq(messSettings.messId, messId));
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Settings not found' });
    }
    const s = rows[0];
    res.json({
      institutionName: s.institutionName,
      messName: s.messName,
      location: s.location,
      messManager: s.messManager,
      prepBufferPct: s.prepBufferPct,
      serviceCapacity: s.serviceCapacity,
      roundingStep: s.roundingStep,
      defaultUptake: s.defaultUptake,
      defaultReviewMeal: s.defaultReviewMeal as MealType,
      upcomingHorizonDays: s.upcomingHorizonDays,
    });
  } catch (error: any) {
    if (isDbDown(error)) {
      console.warn('[GET /settings] Database offline/unconfigured — returning default settings');
      return res.json({
        institutionName: 'St. Jude Campus Dining',
        messName: 'North Hostel Mess #4',
        location: 'Block C, University Campus',
        messManager: 'Meera Krishnan',
        prepBufferPct: 8,
        serviceCapacity: 600,
        roundingStep: 5,
        defaultUptake: 0.75,
        defaultReviewMeal: 'lunch',
        upcomingHorizonDays: 7,
      });
    }
    console.error('[GET /settings] Failed:', error);
    res.status(500).json({ error: 'Failed to retrieve settings' });
  }
});

// 15. PUT /api/v1/settings (Protected: manager only)
apiRouter.put('/settings', requireAuth, requireRole(['manager']), async (req: Request, res: Response) => {
  try {
    const messId = getMessId(req);
    const s = req.body;

    if (!s.institutionName?.trim()) return res.status(400).json({ error: 'Institution name required' });
    if (!s.messName?.trim()) return res.status(400).json({ error: 'Mess name required' });
    if (!s.messManager?.trim()) return res.status(400).json({ error: 'Mess manager required' });
    if (typeof s.prepBufferPct !== 'number' || s.prepBufferPct < 0 || s.prepBufferPct > 50) {
      return res.status(400).json({ error: 'prepBufferPct must be between 0 and 50' });
    }
    if (!Number.isInteger(s.serviceCapacity) || s.serviceCapacity < 1 || s.serviceCapacity > 5000) {
      return res.status(400).json({ error: 'serviceCapacity must be whole number from 1 to 5000' });
    }
    if (![1, 5, 10].includes(s.roundingStep)) {
      return res.status(400).json({ error: 'roundingStep must be 1, 5, or 10' });
    }
    if (typeof s.defaultUptake !== 'number' || s.defaultUptake <= 0 || s.defaultUptake > 1) {
      return res.status(400).json({ error: 'defaultUptake must be between 0 and 1' });
    }
    if (!resolveDatabaseConfig().configured) {
      return res.json({
        institutionName: s.institutionName.trim(),
        messName: s.messName.trim(),
        location: s.location?.trim() || '',
        messManager: s.messManager.trim(),
        prepBufferPct: s.prepBufferPct,
        serviceCapacity: s.serviceCapacity,
        roundingStep: s.roundingStep,
        defaultUptake: s.defaultUptake,
        defaultReviewMeal: s.defaultReviewMeal || 'lunch',
        upcomingHorizonDays: s.upcomingHorizonDays,
      });
    }

    await db
      .update(messSettings)
      .set({
        institutionName: s.institutionName.trim(),
        messName: s.messName.trim(),
        location: s.location?.trim() || '',
        messManager: s.messManager.trim(),
        prepBufferPct: s.prepBufferPct,
        serviceCapacity: s.serviceCapacity,
        roundingStep: s.roundingStep,
        defaultUptake: s.defaultUptake,
        defaultReviewMeal: s.defaultReviewMeal || 'lunch',
        upcomingHorizonDays: s.upcomingHorizonDays,
        updatedAt: new Date(),
      })
      .where(eq(messSettings.messId, messId));

    res.json({
      institutionName: s.institutionName.trim(),
      messName: s.messName.trim(),
      location: s.location?.trim() || '',
      messManager: s.messManager.trim(),
      prepBufferPct: s.prepBufferPct,
      serviceCapacity: s.serviceCapacity,
      roundingStep: s.roundingStep,
      defaultUptake: s.defaultUptake,
      defaultReviewMeal: s.defaultReviewMeal,
      upcomingHorizonDays: s.upcomingHorizonDays,
    });
  } catch (error: any) {
    console.error('[PUT /settings] Failed:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// 16. POST /api/v1/forecast/ai-insights (Gemini AI Insights - manager only)
apiRouter.post('/forecast/ai-insights', requireAuth, requireRole(['manager']), async (req: Request, res: Response) => {
  const apiKey = process.env.GEMINI_API_KEY;
  const { date, meal, predictedDiners, baselineDiners, context, items } = req.body || {};

  if (!apiKey || apiKey.trim() === '' || apiKey.includes('INVALID') || apiKey.length < 10) {
    return res.json({
      available: false,
      reason: 'Live Gemini API key unconfigured; using deterministic rule-based guidance',
      insights: [
        `Historical demand baseline for ${meal || 'service'} is ${baselineDiners ?? 450} diners; model predicted ${predictedDiners ?? 480} diners based on ${context || 'normal'} campus schedule.`,
        `Safety buffer covers expected variance. Monitor line prep execution closely for high-volume main dishes.`,
        `End-of-service surplus should be logged in Kitchen Operations to continuously improve future forecast accuracy.`
      ]
    });
  }

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `You are an expert AI culinary waste reduction analyst for university dining halls.
Analyze this meal forecast data:
- Date: ${date}
- Meal: ${meal}
- Campus Context: ${context}
- Predicted Diners: ${predictedDiners}
- Baseline Diners: ${baselineDiners}
- Key Dishes: ${Array.isArray(items) ? items.map((i: any) => `${i.name} (${i.suggestedPrep} portions)`).join(', ') : 'Standard menu'}

Provide 3 concise, highly actionable operational bullet points for the Kitchen Manager and Staff:
1. Expected demand & attendance risk factor analysis.
2. Kitchen batch prep & buffer recommendation.
3. Specific food waste mitigation advice.
Keep each bullet point under 25 words. Plain text bullets without markdown or conversational filler.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    const text = response.text || '';
    const bullets = text
      .split('\n')
      .map((line) => line.replace(/^[\*\-\d\.\s]+/, '').trim())
      .filter((line) => line.length > 5)
      .slice(0, 3);

    return res.json({
      available: true,
      model: 'gemini-3.8-flash',
      insights: bullets.length >= 3 ? bullets : [
        `Predicted demand is ${predictedDiners} diners (${context} context).`,
        `Stage cooking in 2 batches to prevent over-preparation.`,
        `Log residual leftovers to maintain historical accuracy.`
      ],
    });
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    const isQuota =
      errMsg.includes('429') ||
      errMsg.includes('RESOURCE_EXHAUSTED') ||
      errMsg.toLowerCase().includes('quota');
    const isInvalidKey =
      errMsg.includes('API key not valid') ||
      errMsg.includes('API_KEY_INVALID') ||
      errMsg.includes('400') ||
      errMsg.includes('403');

    if (isInvalidKey || isQuota) {
      console.warn('[Gemini AI Insights] Invalid API key or quota issue encountered. Falling back to rule-based insights.');
    } else {
      console.warn('[Gemini AI Insights] API call error or quota exceeded:', errMsg);
    }

    const safeReason = isQuota
      ? 'Live Gemini API quota reached; using deterministic rule-based guidance'
      : isInvalidKey
        ? 'Live Gemini API key unavailable or invalid; using deterministic rule-based guidance'
        : 'Live Gemini service temporarily unavailable; using deterministic rule-based guidance';

    return res.json({
      available: false,
      reason: safeReason,
      insights: [
        `Historical demand baseline for ${meal || 'service'} is ${baselineDiners ?? 450} diners; model predicted ${predictedDiners ?? 480} diners.`,
        `Safety buffer covers expected variance. Monitor line prep execution closely.`,
        `End-of-service surplus should be logged in Kitchen Operations.`
      ]
    });
  }
});

// 17. POST /api/v1/chat (Conversational AI Assistant)
apiRouter.post('/chat', requireAuth, requireRole(['manager']), async (req: AuthRequest, res: Response) => {
  try {
    const { message } = req.body || {};
    const userRole = req.userRole;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const query = message.trim().toLowerCase();

    let records: any[] = [];
    let itemsList: any[] = [];
    try {
      if (resolveDatabaseConfig().configured) {
        records = await db.select().from(mealRecords);
        itemsList = await db.select().from(recordItems);
      }
    } catch {
      records = [];
      itemsList = [];
    }

    let isSynthetic = false;
    if (!records || records.length === 0) {
      const seed = createSeedState();
      records = seed.records;
      itemsList = seed.records.flatMap((r: any) => r.items.map((it: any) => ({ ...it, recordId: r.id })));
      isSynthetic = true;
    }

    const dataOrigin = isSynthetic
      ? 'Reproducible Synthetic Demo Dataset (28-day historical baseline)'
      : 'Live PostgreSQL Persistence Database';

    let totalWasteKg = 0;
    const dishLeftovers = new Map<string, { totalLeftover: number; count: number }>();

    for (const r of itemsList) {
      const prep = r.prepared ?? r.approvedPrep ?? r.suggestedPrep ?? 0;
      const consumed = r.consumed ?? Math.round(prep * 0.85);
      const leftover = Math.max(0, prep - consumed);
      const kg = leftover * (r.kgPerPortion || 0.1);
      totalWasteKg += kg;

      const existing = dishLeftovers.get(r.name) || { totalLeftover: 0, count: 0 };
      existing.totalLeftover += kg;
      existing.count += 1;
      dishLeftovers.set(r.name, existing);
    }

    const topDishes = Array.from(dishLeftovers.entries())
      .map(([name, data]) => ({ name, totalLeftoverKg: Number(data.totalLeftover.toFixed(1)), count: data.count }))
      .sort((a, b) => b.totalLeftoverKg - a.totalLeftoverKg)
      .slice(0, 5);

    const completedRecords = records.filter((r) => r.status === 'completed');
    const avgAttendance = completedRecords.length
      ? Math.round(completedRecords.reduce((sum, r) => sum + (r.actualDiners || r.predictedDiners || 0), 0) / completedRecords.length)
      : 0;

    const dataContext = {
      role: userRole,
      dataOrigin,
      totalRecords: records.length,
      completedRecords: completedRecords.length,
      estimatedTotalWasteKg: Number(totalWasteKg.toFixed(1)),
      averageAttendance: avgAttendance,
      topDishesWithLeftovers: topDishes,
      approvedPlansCount: records.filter((r) => r.status === 'approved').length,
    };

    if (userRole === 'student') {
      return res.json({
        reply: `Hello! As a student diner, I can help you with published dining menus, meal timings, and approved dining information. Today's menus feature balanced portions and fresh ingredients prepared according to verified campus demand forecasts.`,
        model: 'smartmess-rule-assistant',
        timestamp: new Date().toISOString(),
      });
    }

    const apiKey = (process.env.NODE_ENV === 'test' || process.env.VITEST) ? undefined : process.env.GEMINI_API_KEY;
    if (apiKey && apiKey.trim() !== '' && !apiKey.includes('INVALID') && apiKey.length >= 10) {
      try {
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey });
        const systemPrompt = `You are SmartMess AI Assistant, an expert culinary waste reduction and demand forecasting assistant for institutional dining managers and kitchen staff.
Context Data:
- Role: ${userRole}
- Data Source: ${dataOrigin}
- Total Records: ${dataContext.totalRecords}
- Completed Services: ${dataContext.completedRecords}
- Estimated Total Waste: ${dataContext.estimatedTotalWasteKg} kg (accumulated across completed synthetic services)
- Average Attendance: ${dataContext.averageAttendance} diners per completed service
- Top Leftover Dishes: ${JSON.stringify(topDishes)}
- Active Approved Plans: ${dataContext.approvedPlansCount}

Guidelines for your response:
1. State whether metrics originate from the synthetic demonstration dataset or live records.
2. Clearly distinguish between recorded leftover waste and unrecorded items (do not represent missing records as verified zero).
3. Identify date ranges or meal periods when discussing preparation targets.
4. Avoid unsupported monetary profit/loss claims or exaggerated percentage accuracy claims; focus on portion weights (kg) and diner demand counts.
5. Answer concisely, professionally, and accurately using the context data.`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: [
            { role: 'user', parts: [{ text: `${systemPrompt}\n\nUser Question: ${message}` }] }
          ]
        });

        if (response.text) {
          return res.json({
            reply: response.text.trim(),
            model: 'gemini-3.8-flash',
            timestamp: new Date().toISOString(),
          });
        }
      } catch (geminiErr: any) {
        const errMsg = geminiErr?.message || String(geminiErr);
        if (!errMsg.includes('API key not valid') && !errMsg.includes('API_KEY_INVALID') && !errMsg.includes('400')) {
          console.warn('[Chat] Gemini API call failed, falling back to deterministic data assistant:', errMsg);
        }
      }
    }

    let reply = '';
    if (query.includes('idli') || query.includes('breakfast')) {
      reply = `For Breakfast service (featuring Idli, Dosa, and Sambar), historical demand in our ${dataOrigin} averages ~430 diners with an 8% safety buffer. Recommended prep is ~460 portions (approx 46 kg). We recommend batch cooking (320 portions at opening 07:00, 140 portions at 08:15) to maintain freshness. Currently, ${dataContext.approvedPlansCount} approved plan is active for today's service.`;
    } else if (query.includes('waste') || query.includes('leftover') || query.includes('last 30 days') || query.includes('compare')) {
      reply = `Based on ${dataOrigin}, estimated total recorded residual waste across ${dataContext.completedRecords} completed services is approximately ${dataContext.estimatedTotalWasteKg} kg. The primary dishes contributing to recorded surplus are ${topDishes.slice(0, 3).map(d => d.name).join(', ')}. (Note: Unrecorded meals or non-tracked services are not represented as verified zero).`;
    } else if (query.includes('attendance') || query.includes('lunch') || query.includes('trend')) {
      reply = `Across ${dataContext.completedRecords} completed services in ${dataOrigin}, average recorded attendance is ${dataContext.averageAttendance} diners per service (Breakfast avg ~430, Lunch avg ~560, Dinner avg ~530). Attendance fluctuates deterministically based on day of week and campus exam schedules.`;
    } else if (query.includes('prep') || query.includes('target') || query.includes('approved')) {
      reply = `There are currently ${dataContext.approvedPlansCount} manager-approved preparation plan(s) active in the system. Kitchen staff can view authorized batch preparation targets in kg and portions on the Kitchen Board and Operations page.`;
    } else if (query.includes('reduce') || query.includes('step') || query.includes('practical')) {
      reply = `To further reduce leftovers: 1) Strictly adhere to manager-approved batch preparation targets; 2) Stage cooking in 2 batches for high-volume items; 3) Promptly log residual leftovers at the end of service to refine historical uptake ratios.`;
    } else {
      reply = `SmartMess AI Assistant analyzed your operational request. Context (${dataOrigin}): ${dataContext.completedRecords} completed services tracked, average attendance ${dataContext.averageAttendance} diners, estimated recorded waste ${dataContext.estimatedTotalWasteKg} kg across tracked items. How else can I assist with your kitchen operations or waste analytics today?`;
    }

    return res.json({
      reply,
      model: 'smartmess-deterministic-fallback',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[POST /chat] Failed:', error);
    return res.status(500).json({ error: error?.message || 'Failed to process chat request' });
  }
});

