export const supportedLngs = ["ja", "en", "zh", "ko"] as const;
export type Locale = (typeof supportedLngs)[number];
