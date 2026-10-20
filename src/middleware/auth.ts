import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { getUserByUid, getOrCreateUser, UserRole } from '../db/users.ts';
import { isConfigError } from '../db/index.ts';

export interface AuthUser {
  uid: string;
  email: string;
  name?: string;
  role: UserRole;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
  userRole?: UserRole;
  dbUser?: any;
}

export const DEMO_TOKENS: Record<string, string> = {
  'demo-token-manager': 'demo-manager-uid',
  'demo-token-kitchen_staff': 'demo-staff-uid',
  'demo-token-staff': 'demo-staff-uid',
  'demo-token-student': 'demo-student-uid',
  'test-token-manager': 'demo-manager-uid',
  'test-token-kitchen_staff': 'demo-staff-uid',
  'test-token-staff': 'demo-staff-uid',
  'test-token-student': 'demo-student-uid',
};

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }

  const token = authHeader.split('Bearer ')[1].trim();
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  // Handle verified demo/test tokens (mapped to durable PostgreSQL user rows)
  if (DEMO_TOKENS[token]) {
    const targetUid = DEMO_TOKENS[token];
    let dbUser: Awaited<ReturnType<typeof getUserByUid>>;
    try {
      dbUser = await getUserByUid(targetUid);
    } catch (error: any) {
      if (isConfigError(error)) {
        console.warn('[Auth] Database unconfigured during demo token verification');
      } else {
        console.error('[Auth] Database lookup failed during demo token verification:', error?.message || 'Database error');
      }
      return res.status(503).json({
        error: 'Service Unavailable: Authentication database lookup failed.',
      });
    }

    if (!dbUser) {
      return res.status(401).json({ error: 'Unauthorized: Demo user record not found in database' });
    }
    req.userRole = dbUser.role as UserRole;
    req.user = {
      uid: dbUser.uid,
      email: dbUser.email,
      name: dbUser.displayName || dbUser.email,
      role: req.userRole,
    };
    req.dbUser = dbUser;
    return next();
  }

  // Real Firebase ID Token verification
  let decodedToken: Awaited<ReturnType<typeof adminAuth.verifyIdToken>>;
  try {
    decodedToken = await adminAuth.verifyIdToken(token);
  } catch (error: any) {
    console.error('Firebase token verification failed:', error?.message || error);
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }

  try {
    const dbUser = await getOrCreateUser(
      decodedToken.uid,
      decodedToken.email || `${decodedToken.uid}@firebase.user`,
      (decodedToken as any).name,
    );
    req.userRole = dbUser.role as UserRole;
    req.user = {
      uid: dbUser.uid,
      email: dbUser.email,
      name: dbUser.displayName || dbUser.email,
      role: req.userRole,
    };
    req.dbUser = dbUser;
    return next();
  } catch (error: any) {
    if (isConfigError(error)) {
      console.warn('[Auth] Database unconfigured during user sync');
    } else {
      console.error('[Auth] Database user sync failed:', error?.message || 'Database error');
    }
    return res.status(503).json({
      error: 'Service Unavailable: Authentication database lookup failed.',
    });
  }
};

/**
 * Server-side role authorization check.
 * Strictly verifies the role recorded in the PostgreSQL database for the authenticated user.
 */
export const requireRole = (allowedRoles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !req.userRole) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required' });
    }

    if (!allowedRoles.includes(req.userRole)) {
      return res.status(403).json({
        error: `Forbidden: Action requires one of [${allowedRoles.join(', ')}] permissions. Server-verified role is '${req.userRole}'.`,
      });
    }

    next();
  };
};
