export const LEGAL_DOC_KEYS = ["privacy", "terms"] as const;
export type LegalDocKey = (typeof LEGAL_DOC_KEYS)[number];

export const LEGAL_DOC_LABELS: Record<LegalDocKey, string> = {
  privacy: "Согласие на обработку персональных данных",
  terms: "Условия пользовательского соглашения",
};
