import { pgTable, text, integer, real, timestamp, uniqueIndex, serial } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  role: text('role').notNull().default('student'), // 'manager' | 'kitchen_staff' | 'student'
  displayName: text('display_name'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const institutions = pgTable('institutions', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  location: text('location').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const messes = pgTable('messes', {
  id: text('id').primaryKey(),
  institutionId: text('institution_id')
    .notNull()
    .references(() => institutions.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  managerName: text('manager_name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const messSettings = pgTable('mess_settings', {
  messId: text('mess_id')
    .primaryKey()
    .references(() => messes.id, { onDelete: 'cascade' }),
  institutionName: text('institution_name').notNull(),
  messName: text('mess_name').notNull(),
  location: text('location').notNull(),
  messManager: text('mess_manager').notNull(),
  prepBufferPct: real('prep_buffer_pct').notNull().default(8.0),
  serviceCapacity: integer('service_capacity').notNull().default(620),
  roundingStep: integer('rounding_step').notNull().default(5),
  defaultUptake: real('default_uptake').notNull().default(0.7),
  defaultReviewMeal: text('default_review_meal').notNull().default('lunch'),
  upcomingHorizonDays: integer('upcoming_horizon_days').notNull().default(3),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const menus = pgTable(
  'menus',
  {
    id: text('id').primaryKey(),
    messId: text('mess_id')
      .notNull()
      .references(() => messes.id, { onDelete: 'cascade' }),
    serviceDate: text('service_date').notNull(),
    meal: text('meal').notNull(), // 'breakfast' | 'lunch' | 'dinner'
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_menus_mess_date_meal').on(table.messId, table.serviceDate, table.meal),
  ],
);

export const menuItems = pgTable('menu_items', {
  id: text('id').primaryKey(),
  menuId: text('menu_id')
    .notNull()
    .references(() => menus.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  kgPerPortion: real('kg_per_portion').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const mealRecords = pgTable(
  'meal_records',
  {
    id: text('id').primaryKey(),
    messId: text('mess_id')
      .notNull()
      .references(() => messes.id, { onDelete: 'cascade' }),
    serviceDate: text('service_date').notNull(),
    meal: text('meal').notNull(),
    status: text('status').notNull().default('recommended'), // 'recommended' | 'approved' | 'completed'
    context: text('context').notNull().default('normal'),
    predictedDiners: integer('predicted_diners').notNull(),
    lowerDiners: integer('lower_diners').notNull(),
    upperDiners: integer('upper_diners').notNull(),
    baselineDiners: integer('baseline_diners'),
    forecastSource: text('forecast_source').notNull().default('rule_based'),
    actualDiners: integer('actual_diners'),
    approvedBy: text('approved_by'),
    approvedAt: text('approved_at'),
    completedAt: text('completed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_records_mess_date_meal').on(table.messId, table.serviceDate, table.meal),
  ],
);

export const recordItems = pgTable('record_items', {
  id: text('id').primaryKey(),
  recordId: text('record_id')
    .notNull()
    .references(() => mealRecords.id, { onDelete: 'cascade' }),
  itemId: text('item_id').notNull(),
  name: text('name').notNull(),
  kgPerPortion: real('kg_per_portion').notNull(),
  predictedDemand: integer('predicted_demand').notNull(),
  lowerDemand: integer('lower_demand').notNull(),
  upperDemand: integer('upper_demand').notNull(),
  suggestedPrep: integer('suggested_prep').notNull(),
  approvedPrep: integer('approved_prep'),
  prepared: integer('prepared'),
  consumed: integer('consumed'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const modelEvaluationRuns = pgTable('model_evaluation_runs', {
  id: text('id').primaryKey(),
  messId: text('mess_id')
    .notNull()
    .references(() => messes.id, { onDelete: 'cascade' }),
  evaluationDate: text('evaluation_date').notNull(),
  windowDays: integer('window_days').notNull().default(14),
  evaluatedMeals: integer('evaluated_meals').notNull(),
  modelId: text('model_id').notNull(),
  candidateMae: real('candidate_mae').notNull(),
  baselineMae: real('baseline_mae').notNull(),
  candidateWape: real('candidate_wape').notNull(),
  candidateBias: real('candidate_bias').notNull(),
  fallbackEngaged: integer('fallback_engaged').notNull().default(0),
  evaluatedAt: timestamp('evaluated_at').defaultNow().notNull(),
});
