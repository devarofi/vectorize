/**
 * Deterministic unique ID generator for document objects.
 * Single responsibility: hand out collision-free string IDs.
 */

let counter = 0;

/** Prefix used when no explicit prefix is provided. */
export const DEFAULT_ID_PREFIX = 'obj';

/**
 * Generate a new unique id.
 * @param {string} [prefix] optional namespace, e.g. 'rect', 'layer'.
 * @returns {string}
 */
export function nextId(prefix = DEFAULT_ID_PREFIX) {
  counter += 1;
  return `${prefix}_${counter.toString(36)}_${Date.now().toString(36)}`;
}

/** Reset the internal counter (used by tests only). */
export function resetIdCounter() {
  counter = 0;
}
