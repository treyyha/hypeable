/**
 * Loop breaker: stop burning tokens on the same error.
 */
export { signatureFromError, normalizeErrorText, hashText, contentHash } from './normalize';
export {
  reduceLoop,
  emptyLoopState,
  publicLoopState,
  fireAbortOnce,
  type LoopDetectorState,
  type LoopFeed,
  type LoopKind,
} from './detect';
export {
  DEFAULT_LOOP_SETTINGS,
  DEFAULT_LOOP_THRESHOLD,
  MIN_LOOP_THRESHOLD,
  MAX_LOOP_THRESHOLD,
  LOOP_SETTINGS_KEY,
  clampThreshold,
  normalizeLoopSettings,
  readLoopSettings,
  type LoopSettings,
} from './settings';
export { wastedCostSince, sumMessageCostsSince } from './wasted';
export { buildReplanPrompt, isAutoFixRequest, unwrapChatPreamble } from './replan';
export { pickStrongerModel, type PickerModel } from './pick-model';
export { setLoopSignalListener, emitLoopError, emitLoopWrite, emitLoopSuccess, type LoopErrorSource } from './signals';
