export { Burrowbox, DEFAULT_BASE_URL, DEFAULT_MAX_RETRIES, DEFAULT_TIMEOUT_MS } from "./client.js";
export type { BurrowboxOptions } from "./client.js";

export { HttpClient, path } from "./http.js";
export type { FetchLike, HttpRequest, Query, QueryValue, RequestOptions, ResponseType } from "./http.js";

export * from "./errors.js";

// Resources
export { APIResource } from "./resource.js";
export { Machines } from "./resources/machines.js";
export { Mcp, toAgentSdkMcpServer, toAgentSdkMcpServers, toClaudeCodeCommand, toMessagesApiMcpServer } from "./resources/mcp.js";
export { LiveView, parseLiveViewMessage } from "./resources/live-view.js";
export { Vault } from "./resources/vault.js";
export { Pools } from "./resources/pools.js";
export type { PoolRef } from "./resources/pools.js";
export { Automations, Schedules, Webhooks } from "./resources/automations.js";
export { Events, EventEndpoints } from "./resources/events.js";
export { Billing, BillingCard } from "./resources/billing.js";
export { Account, ApiKeys } from "./resources/account.js";
export { Vpn } from "./resources/vpn.js";
export { constructWebhookEvent, signWebhookPayload, verifyWebhookSignature } from "./webhook-signature.js";

// Types
export { idOf } from "./types/common.js";
export type * from "./types/common.js";
export type * from "./types/machines.js";
export type * from "./types/mcp.js";
export type * from "./types/live-view.js";
export type * from "./types/vault.js";
export type * from "./types/pools.js";
export type * from "./types/automations.js";
export type * from "./types/events.js";
export type * from "./types/billing.js";
export type { Account as AccountInfo, AccountUpdateParams, ApiKey, ApiKeyCreateParams, ApiKeyCreated } from "./types/account.js";
export type * from "./types/vpn.js";

export { VERSION } from "./version.js";
