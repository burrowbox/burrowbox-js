import { APIResource } from "../resource.js";
import { path, type RequestOptions } from "../http.js";
import type {
  Pool,
  PoolClaimParams,
  PoolClaimResponse,
  PoolCreateParams,
  PoolDeleteResponse,
  PoolUpdateParams,
} from "../types/pools.js";

/** Something with a pool id: an id string or a pool object. */
export type PoolRef = string | { id: string };

const poolId = (p: PoolRef): string => (typeof p === "string" ? p : p.id);

/** A claim may boot a fresh machine when the pool is empty: give it as long as `machines.create`. */
const CLAIM_MS = 180_000;

/**
 * Warm pools: machines kept booted (and set up by a template) so a customer gets one instantly.
 * `client.pools`. See https://burrowbox.dev/docs/pools
 */
export class Pools extends APIResource {
  /** Your pools, oldest first, with live `ready` / `warming` counts. `GET /api/pools` */
  async list(options?: RequestOptions): Promise<Pool[]> {
    return this._http.get<Pool[]>("/api/pools", undefined, options);
  }

  /** One pool (404 `NotFoundError` if it isn't yours). `GET /api/pools/{id}` */
  async get(pool: PoolRef, options?: RequestOptions): Promise<Pool> {
    return this._http.get<Pool>(path`/api/pools/${poolId(pool)}`, undefined, options);
  }

  /** Create a pool; it fills up to `target` within a minute or two. `POST /api/pools` → 201 */
  async create(params: PoolCreateParams = {}, options?: RequestOptions): Promise<Pool> {
    return this._http.post<Pool>("/api/pools", params, options);
  }

  /**
   * Change name, target, size, screen, browser or the `setup` template. A new template, size, screen
   * or browser rebuilds the idle machines; any update (even `{}`) resumes a paused pool. `PATCH /api/pools/{id}`
   */
  async update(pool: PoolRef, params: PoolUpdateParams = {}, options?: RequestOptions): Promise<Pool> {
    return this._http.patch<Pool>(path`/api/pools/${poolId(pool)}`, params, options);
  }

  /** Resume a pool paused after 3 failed setups in a row. Same as `update(pool, {})`. */
  async resume(pool: PoolRef, options?: RequestOptions): Promise<Pool> {
    return this.update(pool, {}, options);
  }

  /** Deletes the pool and its idle machines; claimed machines are kept. `DELETE /api/pools/{id}` */
  async delete(pool: PoolRef, options?: RequestOptions): Promise<PoolDeleteResponse> {
    // Not retried: a retry after a lost response would 404.
    return this._http.request<PoolDeleteResponse>({
      ...options,
      method: "DELETE",
      path: path`/api/pools/${poolId(pool)}`,
      idempotent: false,
    });
  }

  /**
   * Take a machine for a customer: instant (`fromPool: true`, HTTP 200) when one is ready, otherwise a
   * new one is booted with the pool's settings (`fromPool: false`, HTTP 201). `POST /api/pools/{id}/claim`
   */
  async claim(pool: PoolRef, params: PoolClaimParams = {}, options?: RequestOptions): Promise<PoolClaimResponse> {
    return this._http.post<PoolClaimResponse>(path`/api/pools/${poolId(pool)}/claim`, params, {
      ...options,
      timeoutMs: options?.timeoutMs ?? CLAIM_MS,
    });
  }
}
