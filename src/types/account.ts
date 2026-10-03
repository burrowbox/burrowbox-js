import type { Timestamp } from "./common.js";
import type { BillingSummary, Card } from "./billing.js";

export interface Account {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
  emailVerified: boolean;
  createdAt: Timestamp;
  billing: BillingSummary | null;
  payment: { required: boolean; card: Card | null; autoRefillPaused: boolean };
}

export interface AccountUpdateParams {
  name?: string;
}

export interface ApiKey {
  /** e.g. `k_1a2b3c4d5e6f`. */
  id: string;
  name: string;
  /** First 10 characters of the key, e.g. `tmk_AbCdEf`. */
  prefix: string;
  createdAt: Timestamp;
  lastUsedAt: Timestamp | null;
}

export interface ApiKeyCreateParams {
  /** ≤ 60 chars. Default `API key`. */
  name?: string;
}

export interface ApiKeyCreated {
  id: string;
  /** The full `tmk_…` key, shown once. */
  secret: string;
}
