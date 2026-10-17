import { db } from './index.ts';
import { users } from './schema.ts';
import { eq } from 'drizzle-orm';

export type UserRole = 'manager' | 'kitchen_staff' | 'student';

export async function getUserByUid(uid: string) {
  try {
    const rows = await db.select().from(users).where(eq(users.uid, uid));
    return rows[0] || null;
  } catch (error) {
    console.error('Error fetching user by uid:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getOrCreateUser(
  uid: string,
  email: string,
  displayName?: string,
  defaultRole: UserRole = 'student',
) {
  try {
    const existing = await getUserByUid(uid);
    if (existing) {
      if (displayName && existing.displayName !== displayName) {
        await db
          .update(users)
          .set({ displayName, updatedAt: new Date() })
          .where(eq(users.uid, uid));
        return { ...existing, displayName };
      }
      return existing;
    }

    const isManagerDefault =
      email === 'mahmoodmilhaan777@gmail.com' ||
      email.toLowerCase().includes('manager') ||
      defaultRole === 'manager';

    const assignedRole: UserRole = isManagerDefault ? 'manager' : defaultRole;

    const [created] = await db
      .insert(users)
      .values({
        uid,
        email,
        displayName: displayName || email.split('@')[0],
        role: assignedRole,
      })
      .returning();

    return created;
  } catch (error) {
    console.error('Error in getOrCreateUser:', error);
    throw new Error('Database user sync failed.', { cause: error });
  }
}

export async function updateUserRole(uid: string, newRole: UserRole) {
  try {
    const [updated] = await db
      .update(users)
      .set({ role: newRole, updatedAt: new Date() })
      .where(eq(users.uid, uid))
      .returning();
    return updated;
  } catch (error) {
    console.error('Error updating user role:', error);
    throw new Error('Failed to update user role.', { cause: error });
  }
}

export async function getUsers() {
  try {
    return await db.select().from(users);
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}
