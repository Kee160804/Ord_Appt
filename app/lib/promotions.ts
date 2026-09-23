export const MAX_PROMOTION_CODE_LENGTH = 32;

const PROMOTION_CODE_PATTERN = /^[A-Z0-9_-]{2,32}$/;

export function normalizePromotionCode(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, MAX_PROMOTION_CODE_LENGTH);
}

export function isValidPromotionCode(value: string): boolean {
  return PROMOTION_CODE_PATTERN.test(value.trim().toUpperCase());
}
