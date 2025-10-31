/**
 * Time conversion utilities for Solana savings vaults
 * Converts human-readable time periods to blockchain slots
 */

// Solana averages ~0.4 seconds per slot (can vary slightly)
const SECONDS_PER_SLOT = 0.4;
const SLOTS_PER_MINUTE = 60 / SECONDS_PER_SLOT; // ~150
const SLOTS_PER_HOUR = SLOTS_PER_MINUTE * 60; // ~9,000
const SLOTS_PER_DAY = SLOTS_PER_HOUR * 24; // ~216,000
const SLOTS_PER_WEEK = SLOTS_PER_DAY * 7; // ~1,512,000
const SLOTS_PER_MONTH = SLOTS_PER_DAY * 30; // ~6,480,000
const SLOTS_PER_YEAR = SLOTS_PER_DAY * 365; // ~78,840,000

export type TimePeriod = "3months" | "6months" | "1year" | "custom";

export interface TimePeriodOption {
  value: TimePeriod;
  label: string;
  slots: number;
  description: string;
  apyBps: number; // Basis points (10000 = 100%)
}

/**
 * Predefined time period options with recommended APY
 */
export const TIME_PERIOD_OPTIONS: TimePeriodOption[] = [
  {
    value: "3months",
    label: "3 Months",
    slots: Math.floor(SLOTS_PER_MONTH * 3),
    description: "Short-term savings",
    apyBps: 300, // 3% APY
  },
  {
    value: "6months",
    label: "6 Months",
    slots: Math.floor(SLOTS_PER_MONTH * 6),
    description: "Medium-term savings",
    apyBps: 500, // 5% APY
  },
  {
    value: "1year",
    label: "1 Year",
    slots: Math.floor(SLOTS_PER_YEAR),
    description: "Long-term savings",
    apyBps: 800, // 8% APY
  },
];

/**
 * Convert days to slots
 */
export function daysToSlots(days: number): number {
  return Math.floor(days * SLOTS_PER_DAY);
}

/**
 * Convert months to slots (assuming 30 days per month)
 */
export function monthsToSlots(months: number): number {
  return Math.floor(months * SLOTS_PER_MONTH);
}

/**
 * Convert years to slots
 */
export function yearsToSlots(years: number): number {
  return Math.floor(years * SLOTS_PER_YEAR);
}

/**
 * Convert slots back to human-readable time
 */
export function slotsToHumanTime(slots: number): string {
  const years = Math.floor(slots / SLOTS_PER_YEAR);
  const remainingAfterYears = slots % SLOTS_PER_YEAR;
  const months = Math.floor(remainingAfterYears / SLOTS_PER_MONTH);
  const remainingAfterMonths = remainingAfterYears % SLOTS_PER_MONTH;
  const days = Math.floor(remainingAfterMonths / SLOTS_PER_DAY);

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} year${years > 1 ? "s" : ""}`);
  if (months > 0) parts.push(`${months} month${months > 1 ? "s" : ""}`);
  if (days > 0 && years === 0) parts.push(`${days} day${days > 1 ? "s" : ""}`);

  return parts.join(", ") || "0 days";
}

/**
 * Get the time period option by value
 */
export function getTimePeriodOption(value: TimePeriod): TimePeriodOption | undefined {
  return TIME_PERIOD_OPTIONS.find((option) => option.value === value);
}

/**
 * Calculate estimated unlock date given current slot and term slots
 */
export function calculateUnlockDate(currentSlot: number, termSlots: number): Date {
  const secondsUntilUnlock = termSlots * SECONDS_PER_SLOT;
  const millisecondsUntilUnlock = secondsUntilUnlock * 1000;
  return new Date(Date.now() + millisecondsUntilUnlock);
}

/**
 * Calculate remaining slots until unlock
 */
export function calculateRemainingSlots(currentSlot: number, unlockSlot: number): number {
  return Math.max(0, unlockSlot - currentSlot);
}

/**
 * Format unlock date
 */
export function formatUnlockDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Calculate APY reward for a given amount and period
 */
export function calculateReward(
  amount: number,
  apyBps: number,
  termSlots: number
): number {
  const apyDecimal = apyBps / 10000;
  const termRatio = termSlots / SLOTS_PER_YEAR;
  return amount * apyDecimal * termRatio;
}
