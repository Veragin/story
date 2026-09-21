/**
 * `@story/shared` — cross-service code with no dependency on any other workspace package.
 *
 * Layering (REFACTOR_PLAN §2, as amended): shared → types → { ui, core } → data → services.
 * Nothing in here may import `@story/types`.
 */

/* Time, DeltaTime, TimeRange */
export * from './time/Time';
/* TimeManager, TTimeRenderFormat */
export * from './time/TimeManager';
/* MIN_S, HOUR_S, DAY_S, MONTH_S, YEAR_S, START_YEAR, MONTH_NAME */
export * from './time/const';

/* TPoint, TSize, TVec */
export * from './geometry';
/* TPassageId, TPassageIdFor */
export * from './ids';

/* Listener, Observer, ConditionalObserver */
export * from './Observer';
/* debounce, throttle, synchronize, RequestCanceledError */
export * from './throttle';
/* assert, assertNotNullish, isNullish, isOneOf */
export * from './typeguards';
/* getUniqueId, getUniqueClassName, capitalize, range, roundToDec, TFlavor */
export * from './misc';
/* showToast, setToastHandler, TToastHandler, TToastOptions, TToastVariant */
export * from './toast';
/* applyFormatting — evaluating this module also installs the global `_` */
export * from './translations';
