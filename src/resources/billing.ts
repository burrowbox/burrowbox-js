import { APIResource, notImplemented } from "../resource.js";
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
  async get(options?: RequestOptions): Promise<CardInfo> {
    throw notImplemented("billing.card.get");
  }

  /** Stripe Checkout URL to add or replace the card. `POST /api/billing/card` */
  async checkout(options?: RequestOptions): Promise<CheckoutSession> {
    throw notImplemented("billing.card.checkout");
  }

  /** Remove the card (stops auto-refill; machines can't be started). `DELETE /api/billing/card` */
  async remove(options?: RequestOptions): Promise<{ removed: boolean }> {
    throw notImplemented("billing.card.remove");
  }
}

/** Prepaid credit, usage and per-customer reporting. Amounts are micro-dollars unless named `…Cents`. `client.billing` */
export class Billing extends APIResource {
  readonly card: BillingCard = new BillingCard(this._client);

  /** Balance, burn rate, runway, this month's usage. `GET /api/billing` */
  async get(options?: RequestOptions): Promise<BillingSummary> {
    throw notImplemented("billing.get");
  }

  /** Credit and usage entries, newest first. `GET /api/billing/ledger?limit=&offset=&kind=` */
  async ledger(params: LedgerListParams = {}, options?: RequestOptions): Promise<LedgerEntry[]> {
    throw notImplemented("billing.ledger");
  }

  /** `PUT /api/billing/auto-refill` — returns the updated card info. */
  async setAutoRefill(params: AutoRefillParams, options?: RequestOptions): Promise<CardInfo> {
    throw notImplemented("billing.setAutoRefill");
  }

  /** Stripe Checkout URL for a one-off top-up. `POST /api/billing/topup` */
  async topUp(params: TopUpParams, options?: RequestOptions): Promise<CheckoutSession> {
    throw notImplemented("billing.topUp");
  }

  /** Spend per customer (`externalId`) or per machine. `GET /api/usage?groupBy=&from=&to=` */
  async usage(params: UsageParams = {}, options?: RequestOptions): Promise<UsageReport> {
    throw notImplemented("billing.usage");
  }

  /** Public price list, sizes and whether sign-up is open (no auth). `GET /api/pricing` */
  async pricing(options?: RequestOptions): Promise<PublicPricing> {
    throw notImplemented("billing.pricing");
  }
}
