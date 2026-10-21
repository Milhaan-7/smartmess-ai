import { eq } from 'drizzle-orm';
import { db, resolveDatabaseConfig } from './index';
import { institutions, messes, messSettings, menus, menuItems, mealRecords, recordItems } from './schema';
import { createSeedState } from '../data/mockData';

import { users } from './schema.ts';

export const DEFAULT_INSTITUTION_ID = 'inst-greenfield';
export const DEFAULT_MESS_ID = 'mess-greenfield-north';

export async function seedDatabaseIfEmpty(): Promise<boolean> {
  const status = resolveDatabaseConfig();
  if (!status.configured) {
    return false;
  }

  const existingInst = await db.select().from(institutions).where(eq(institutions.id, DEFAULT_INSTITUTION_ID));
  const existingRecords = await db.select().from(mealRecords);

  // Seed default demonstration users if not present
  const defaultUsers = [
    {
      uid: 'demo-manager-uid',
      email: 'manager@smartmess.internal',
      role: 'manager',
      displayName: 'Meera Krishnan (Manager)',
    },
    {
      uid: 'demo-staff-uid',
      email: 'staff@smartmess.internal',
      role: 'kitchen_staff',
      displayName: 'Ramesh Chef (Kitchen Staff)',
    },
    {
      uid: 'demo-student-uid',
      email: 'student@smartmess.internal',
      role: 'student',
      displayName: 'Aarav Student (Diner)',
    },
    {
      uid: 'admin-milhaan',
      email: 'mahmoodmilhaan777@gmail.com',
      role: 'manager',
      displayName: 'Milhaan (Admin Manager)',
    },
  ];

  for (const u of defaultUsers) {
    await db
      .insert(users)
      .values(u)
      .onConflictDoNothing({ target: users.uid });
  }

  if (existingInst.length > 0 && existingRecords.length >= 10) {
    return false; // Database already fully populated with data
  }

  console.log('[Seed] Seeding reproducible synthetic demonstration data...');
  const seed = createSeedState();

  if (existingInst.length === 0) {
    // 1. Create default institution & mess
    await db.insert(institutions).values({
      id: DEFAULT_INSTITUTION_ID,
      name: seed.settings.institutionName,
      location: seed.settings.location,
    });

    await db.insert(messes).values({
      id: DEFAULT_MESS_ID,
      institutionId: DEFAULT_INSTITUTION_ID,
      name: seed.settings.messName,
      managerName: seed.settings.messManager,
    });

    await db.insert(messSettings).values({
      messId: DEFAULT_MESS_ID,
      institutionName: seed.settings.institutionName,
      messName: seed.settings.messName,
      location: seed.settings.location,
      messManager: seed.settings.messManager,
      prepBufferPct: seed.settings.prepBufferPct,
      serviceCapacity: seed.settings.serviceCapacity,
      roundingStep: seed.settings.roundingStep,
      defaultUptake: seed.settings.defaultUptake,
      defaultReviewMeal: seed.settings.defaultReviewMeal,
      upcomingHorizonDays: seed.settings.upcomingHorizonDays,
    });

    // 2. Insert menus and menu items in chunks
    for (const m of seed.menus) {
      await db
        .insert(menus)
        .values({
          id: m.id,
          messId: DEFAULT_MESS_ID,
          serviceDate: m.date,
          meal: m.meal,
        })
        .onConflictDoNothing({ target: menus.id });

      if (m.items.length > 0) {
        await db
          .insert(menuItems)
          .values(
            m.items.map((item, idx) => ({
              id: item.id,
              menuId: m.id,
              name: item.name,
              kgPerPortion: item.kgPerPortion,
              sortOrder: idx,
            })),
          )
          .onConflictDoNothing({ target: menuItems.id });
      }
    }
  }

  // 3. Insert meal records and record items if missing
  if (existingRecords.length < 10) {
    console.log('[Seed] Seeding baseline meal records and item histories...');
    for (const r of seed.records) {
      await db
        .insert(mealRecords)
        .values({
          id: r.id,
          messId: DEFAULT_MESS_ID,
          serviceDate: r.date,
          meal: r.meal,
          status: r.status,
          context: r.context,
          predictedDiners: r.predictedDiners,
          lowerDiners: r.lowerDiners,
          upperDiners: r.upperDiners,
          baselineDiners: r.baselineDiners,
          forecastSource: r.forecastSource,
          actualDiners: r.actualDiners,
          approvedBy: r.approvedAt ? 'Meera Krishnan' : null,
          approvedAt: r.approvedAt,
          completedAt: r.completedAt,
        })
        .onConflictDoNothing({ target: mealRecords.id });

      if (r.items.length > 0) {
        await db
          .insert(recordItems)
          .values(
            r.items.map((it) => ({
              id: `ri-${r.id}-${it.itemId}`,
              recordId: r.id,
              itemId: it.itemId,
              name: it.name,
              kgPerPortion: it.kgPerPortion,
              predictedDemand: it.predictedDemand,
              lowerDemand: it.lowerDemand,
              upperDemand: it.upperDemand,
              suggestedPrep: it.suggestedPrep,
              approvedPrep: it.approvedPrep,
              prepared: it.prepared,
              consumed: it.consumed,
            })),
          )
          .onConflictDoNothing({ target: recordItems.id });
      }
    }
  }

  console.log('[Seed] Database initialization complete.');
  return true;
}
