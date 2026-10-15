let counter = 0;
/** Short unique id for client-side records (not cryptographic). */
export const uid = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;
