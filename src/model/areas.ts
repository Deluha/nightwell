// The feature areas a finding belongs to. Defined once here and imported everywhere (R6).
export const FEATURE_AREAS = [
  "database",
  "auth",
  "storage",
  "realtime",
  "edge-functions",
  "rest",
] as const;
export type FeatureArea = (typeof FEATURE_AREAS)[number];
