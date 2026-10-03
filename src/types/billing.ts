import type { Timestamp, VpnType } from "./common.js";

/** Amounts named `…Micros` are micro-dollars (1 000 000 = $1). `…Cents` are cents. */
export interface Pricing {
  currency: "usd";
  /** Per size, e.g. `{ tiny: 7, small: 11, medium: 16, large: 26 }`. */
  runningCentsPerHour: Record<string, number>;
  stoppedCentsPerHour: number;
  signupCreditCents: number;
  topUpOptionsCents: number[];
  minTopUpCents: number;
  maxTopUpCents: number;
  provider: "stripe" | "dev" | "none";
  vpn: Record<VpnType, { centsPerHour: number; centsPerGb: number; centsPer1kConnections: number }> | null;
}

/** `GET /api/pricing` (public) also includes sizes and whether sign-up is open. */
export interface PublicPricing extends Pricing {
  sizes: Record<string, { instance: string; cpus: number; memoryMb: number; diskGb: number }>;
  signup: boolean;
}

export interface BillingSummary {
  balanceMicros: number;
  burnMicrosPerHour: number;
  /** `null` when nothing is burning. */
  runwayHours: number | null;
  usedThisMonthMicros: number;
  addedThisMonthMicros: number;
  machines: { running: number; stopped: number };
  pricing: Pricing;
}

export type LedgerKindFilter = "usage" | "credit";

export interface LedgerListParams {
  /** 1–500. Default 100. */
  limit?: number;
  /** Default 0. */
  offset?: number;
  kind?: LedgerKindFilter;
}

export interface LedgerEntry {
  id: number | string;
  at: Timestamp;
  /** e.g. `usage`, `topup`, `signup`, `grant`, `refill`. */
  kind: string;
  /** Positive = credit, negative = usage. */
  amountMicros: number;
  ref: string | null;
  description: string | null;
}

export interface Card {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

export interface CardInfo {
  card: Card | null;
  /** Whether a card is required to start machines (false for admins). */
  required: boolean;
  autoRefill: {
    thresholdCents: number;
    amountCents: number;
    /** Paused after a failed charge. */
    paused: boolean;
    error: string | null;
    thresholdOptions: number[];
    amountOptions: number[];
  };
}

export interface CheckoutSession {
  /** Stripe Checkout URL to send the user to. */
  url: string;
  /** Top-ups only. */
  mode?: "stripe" | "dev";
}

export interface AutoRefillParams {
  /** 100–100 000. */
  thresholdCents?: number;
  /** 1000–100 000. */
  amountCents?: number;
}

export interface TopUpParams {
  cents: number;
}

export type UsageGroupBy = "externalId" | "machine";

export interface UsageParams {
  /** Default `externalId`. */
  groupBy?: UsageGroupBy;
  /** Unix ms. Default: start of this month (UTC). */
  from?: Timestamp;
  /** Unix ms. Default: now. */
  to?: Timestamp;
}

export interface UsageGroup {
  /** Present with `groupBy: "externalId"`; `null` = untagged machines (incl. idle pool time). */
  externalId?: string | null;
  /** Present with `groupBy: "machine"`. */
  machineId?: string | null;
  usageMicros: number;
  machines: number;
}

export interface UsageReport {
  from: Timestamp;
  to: Timestamp;
  groupBy: UsageGroupBy;
  totalMicros: number;
  groups: UsageGroup[];
}
