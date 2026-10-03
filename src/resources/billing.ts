import { APIResource } from "../resource.js";
import type { RequestOptions } from "../http.js";
import type {
  AutoRefillParams,
  BillingSummary,
  CardInfo,
  CheckoutSession,
  LedgerEntry,
  LedgerListParams,
  PublicPricing,
  TopUpParams,
  UsageParams,
  UsageReport,
} from "../types/billing.js";

/** The saved card and auto-refill. `client.billing.card` */
export class BillingCard extends APIResource {
  /** Card (brand, last 4, expiry) and auto-refill settings. `GET /api/billing/card` */
  get(options?: RequestOptions): Promise<CardInfo> {
    return this._http.get<CardInfo>("/api/billing/card", undefined, options);
  }

  /** Stripe Checkout URL to add or replace the card. `POST /api/billing/card` */
  checkout(options?: RequestOptions): Promise<CheckoutSession> {
    return this._http.post<CheckoutSession>("/api/billing/card", {}, options);
  }

  /** Remove the card (stops auto-refill; machines can't be started). `DELETE /api/billing/card` */
  remove(options?: RequestOptions): Promise<{ removed: boolean }> {
    return this._http.delete<{ removed: boolean }>("/api/billing/card", options);
  }
}

/** Prepaid credit, usage and per-customer reporting. Amounts are micro-dollars unless named `…Cents`. `client.billing` */
export class Billing extends APIResource {
  readonly card: BillingCard = new BillingCard(this._client);

  /** Balance, burn rate, runway, this month's usage. `GET /api/billing` */
  get(options?: RequestOptions): Promise<BillingSummary> {
    return this._http.get<BillingSummary>("/api/billing", undefined, options);
  }

  /** Credit and usage entries, newest first. `GET /api/billing/ledger?limit=&offset=&kind=` */
  ledger(params: LedgerListParams = {}, options?: RequestOptions): Promise<LedgerEntry[]> {
    return this._http.get<LedgerEntry[]>("/api/billing/ledger", { limit: params.limit, offset: params.offset, kind: params.kind }, options);
  }

  /**
   * Set the auto-refill threshold and/or amount (omitted fields are kept). Also resumes a refill
   * paused by a failed charge. `PUT /api/billing/auto-refill` — returns the updated card info.
   */
  setAutoRefill(params: AutoRefillParams, options?: RequestOptions): Promise<CardInfo> {
    return this._http.put<CardInfo>("/api/billing/auto-refill", params, options);
  }

  /** Stripe Checkout URL for a one-off top-up ($5–$1,000). `POST /api/billing/topup` */
  topUp(params: TopUpParams, options?: RequestOptions): Promise<CheckoutSession> {
    return this._http.post<CheckoutSession>("/api/billing/topup", params, options);
  }

  /** Spend per customer (`externalId`) or per machine. `GET /api/usage?groupBy=&from=&to=` */
  usage(params: UsageParams = {}, options?: RequestOptions): Promise<UsageReport> {
    return this._http.get<UsageReport>("/api/usage", { groupBy: params.groupBy, from: params.from, to: params.to }, options);
  }

  /** Public price list, sizes and whether sign-up is open (no auth). `GET /api/pricing` */
  pricing(options?: RequestOptions): Promise<PublicPricing> {
    return this._http.request<PublicPricing>({ ...options, method: "GET", path: "/api/pricing", auth: false });
  }
}
