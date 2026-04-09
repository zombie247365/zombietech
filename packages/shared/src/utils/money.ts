import { DEFAULT_CURRENCY_SYMBOL } from '../constants';

/**
 * Convert cents (bigint or number) to Rands display string.
 * e.g. 150000 → "R1,500.00"
 */
export function centsToRands(cents: bigint | number): string {
  const value = typeof cents === 'bigint' ? Number(cents) : cents;
  const rands = value / 100;
  return `${DEFAULT_CURRENCY_SYMBOL}${rands.toLocaleString('en-ZA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Convert Rand decimal to cents integer.
 * e.g. 1500.00 → 150000
 */
export function randsToCents(rands: number): number {
  return Math.round(rands * 100);
}

/**
 * Calculate platform fee from gross revenue.
 */
export function calcPlatformFee(grossCents: bigint, feePct: number): bigint {
  return BigInt(Math.round(Number(grossCents) * (feePct / 100)));
}

/**
 * Calculate hourly rate from monthly cost components.
 * hourly_rate = (monthly_rent + monthly_utilities) / site_operating_hours_per_month
 */
export function calcHourlyRate(
  monthlyRentCents: bigint,
  monthlyUtilitiesCents: bigint,
  operatingHoursPerMonth: number,
): bigint {
  if (operatingHoursPerMonth === 0) return BigInt(0);
  const total = Number(monthlyRentCents) + Number(monthlyUtilitiesCents);
  return BigInt(Math.round(total / operatingHoursPerMonth));
}

/**
 * Calculate session base fee from hourly rate and slot hours.
 */
export function calcSessionFee(hourlyRateCents: bigint, slotHours: number): bigint {
  return BigInt(Math.round(Number(hourlyRateCents) * slotHours));
}

/**
 * Calculate upside amount (fixed model).
 */
export function calcUpsideFixed(siteFee: bigint, upsidePct: number): bigint {
  return BigInt(Math.round(Number(siteFee) * (upsidePct / 100)));
}

/**
 * Calculate upside amount (variable model — % of operator net profit).
 */
export function calcUpsideVariable(
  grossRevenue: bigint,
  platformFee: bigint,
  siteFee: bigint,
  upsidePct: number,
): bigint {
  const netProfit = Number(grossRevenue) - Number(platformFee) - Number(siteFee);
  if (netProfit <= 0) return BigInt(0);
  return BigInt(Math.round(netProfit * (upsidePct / 100)));
}
