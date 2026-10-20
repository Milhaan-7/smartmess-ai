import { Router, type Request, type Response } from 'express';
import { eq, and, gte, lte, asc } from 'drizzle-orm';
import { db, pool, DatabaseConfigurationError, isConfigError } from '../db/index.ts';
import { menus, menuItems, mealRecords, recordItems, messSettings } from '../db/schema.ts';
import { getUsers, getUserByUid, updateUserRole, getOrCreateUser, UserRole } from '../db/users.ts';
import { requireAuth, requireRole, type AuthRequest, DEMO_TOKENS } from '../middleware/auth.ts';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DEFAULT_MESS_ID } from '../db/seed.ts';
import { isValidDateString } from '../lib/dates.ts';
import { MEAL_ORDER } from '../lib/constants.ts';
import type { MealType } from '../types/index.ts';

export const apiRouter = Router();

// Helper to sanitize messId
const getMessId = (req: Request): string => (req.headers['x-mess-id'] as string) || DEFAULT_MESS_ID;

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
      let dbUser: Awaited<ReturnType<typeof getUserByUid>>;
      try {
        dbUser = await getUserByUid(targetUid);
      } catch (dbErr: any) {
        if (isConfigError(dbErr)) {
          console.warn('[Auth Session] Database unconfigured during demo role exchange');
        } else {
          console.error('[Auth Session] Database lookup failed:', dbErr?.message || 'Database error');
        }
        return res.status(503).json({
          error: 'Service Unavailable: Authentication database lookup failed.',
        });
      }
      return res.json({
        token: demoToken,
        user: {
          uid: dbUser?.uid || targetUid,
          email: dbUser?.email || `${demoRole}@smartmess.internal`,
          name: dbUser?.displayName || `Demo ${demoRole}`,
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
      try {
        const dbUser = await getOrCreateUser(decoded.uid, email, (decoded as any).name);
        return res.json({
          token,
          user: {
            uid: dbUser.uid,
            email: dbUser.email,
            name: dbUser.displayName || dbUser.email,
            role: dbUser.role as UserRole,
          },
        });
      } catch (dbErr: any) {
        if (isConfigError(dbErr)) {
          console.warn('[Auth Session] Database unconfigured during user sync');
        } else {
          console.error('[Auth Session] Database user sync failed:', dbErr?.message || 'Database error');
        }
        return res.status(503).json({
          error: 'Service Unavailable: Authentication database lookup failed.',
        });
      }
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
  try {
    const userList = await getUsers();
    res.json(userList);
  } catch (error: any) {
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
    const updated = await updateUserRole(uid, role as UserRole);
    res.json(updated);
  } catch (error: any) {
    console.error('[PUT /users/:uid/role] Failed:', error);
    res.status(500).json({ error: error?.message || 'Failed to update user role' });
  }
});

// 6. GET /api/v1/menus (Protected: all authenticated users can view menus)
apiRouter.get('/menus', requireAuth, async (req: Request, res: Response) => {
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

    const existing = await db
      .select()
      .from(menus)
      .where(and(eq(menus.messId, messId), eq(menus.serviceDate, date), eq(menus.meal, meal)));

    if (existing.length > 0) {
      return res.status(409).json({ error: 'A menu already exists for this date and meal. Edit it instead.' });
    }

    const menuId = `menu-${date}-${meal}`;

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
    console.error('[PUT /menus] Failed:', error);
    res.status(500).json({ error: error?.message || 'Failed to update menu' });
  }
});

// 9. DELETE /api/v1/menus/:id (Protected: manager only)
apiRouter.delete('/menus/:id', requireAuth, requireRole(['manager']), async (req: Request, res: Response) => {
  try {
    const messId = getMessId(req);
    const id = String(req.params.id);

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
    console.error('[DELETE /menus] Failed:', error);
    res.status(500).json({ error: error?.message || 'Failed to delete menu' });
  }
});

// 10. GET /api/v1/records (Protected: manager & kitchen staff only)
apiRouter.get('/records', requireAuth, requireRole(['manager', 'kitchen_staff']), async (req: Request, res: Response) => {
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
    console.error('[GET /records] Failed:', error);
    res.status(500).json({ error: 'Failed to retrieve meal records' });
  }
});

// 11. GET /api/v1/records/:date/:meal (Protected: manager & kitchen staff only)
apiRouter.get('/records/:date/:meal', requireAuth, requireRole(['manager', 'kitchen_staff']), async (req: Request, res: Response) => {
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

    const existingRows = await db
      .select()
      .from(mealRecords)
      .where(and(eq(mealRecords.id, id), eq(mealRecords.messId, messId)));

    if (existingRows.length === 0) {
      return res.status(404).json({ error: 'Meal record not found' });
    }
    const current = existingRows[0];

    // Priority Check: Approving a plan requires manager role!
    const isApproving = r.status === 'approved' && current.status !== 'approved';
    if (isApproving && req.userRole !== 'manager') {
      return res.status(403).json({ error: 'Forbidden: Only management can approve preparation plans.' });
    }

    // Role check: Students are strictly forbidden from altering kitchen records
    if (req.userRole !== 'manager' && req.userRole !== 'kitchen_staff') {
      return res.status(403).json({ error: 'Forbidden: Student accounts cannot modify operational kitchen plans.' });
    }

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
    if (!Number.isInteger(s.upcomingHorizonDays) || s.upcomingHorizonDays < 1 || s.upcomingHorizonDays > 14) {
      return res.status(400).json({ error: 'upcomingHorizonDays must be whole number from 1 to 14' });
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
