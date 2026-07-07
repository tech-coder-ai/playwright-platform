/** Minimum wait before interacting with or probing an element. */
export const VISIBILITY_TIMEOUT_MS = 15_000;

/**
 * Wait for the FIRST element interacted with after navigation — SPAs can keep
 * rendering long after domcontentloaded, so this is deliberately generous.
 */
export const FIRST_INTERACTION_TIMEOUT_MS = 60_000;

/** Minimum wait when deciding whether to skip an optional step. */
export const SKIP_VISIBILITY_TIMEOUT_MS = 15_000;

/** Timeout for click/fill after the target is already visible. */
export const ACTION_TIMEOUT_MS = 30_000;

/** Initial navigation — some enterprise apps need 2–3 minutes on first load. */
export const NAVIGATION_TIMEOUT_MS = 180_000;

/** Wait for DOM / SPA shell after goto. */
export const LOAD_STATE_TIMEOUT_MS = 180_000;

/** Cucumber step budget — must exceed navigation + subsequent actions. */
export const CUCUMBER_STEP_TIMEOUT_MS = 240_000;
