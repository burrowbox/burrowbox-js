import { APIResource, notImplemented } from "../resource.js";
import type { RequestOptions } from "../http.js";
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

/** Warm pools: machines kept booted (and set up by a template) so a customer gets one instantly. `client.pools` */
export class Pools extends APIResource {
  /** `GET /api/pools` */
  async list(options?: RequestOptions): Promise<Pool[]> {
    throw notImplemented("pools.list");
  }

  /** `GET /api/pools/{id}` */
  async get(pool: PoolRef, options?: RequestOptions): Promise<Pool> {
    throw notImplemented("pools.get");
  }

  /** `POST /api/pools` → 201 */
  async create(params: PoolCreateParams = {}, options?: RequestOptions): Promise<Pool> {
    throw notImplemented("pools.create");
  }

  /** Any update (even `{}`) resumes a paused pool. `PATCH /api/pools/{id}` */
  async update(pool: PoolRef, params: PoolUpdateParams = {}, options?: RequestOptions): Promise<Pool> {
    throw notImplemented("pools.update");
  }

  /** Resume a pool paused after failed setups. Same as `update(pool, {})`. */
  async resume(pool: PoolRef, options?: RequestOptions): Promise<Pool> {
    throw notImplemented("pools.resume");
  }

  /** Deletes the pool and its idle machines; claimed machines are kept. `DELETE /api/pools/{id}` */
  async delete(pool: PoolRef, options?: RequestOptions): Promise<PoolDeleteResponse> {
    throw notImplemented("pools.delete");
  }

  /** Take a machine (instant when one is ready). `POST /api/pools/{id}/claim` → 200 (fromPool) or 201 (booted) */
  async claim(pool: PoolRef, params: PoolClaimParams = {}, options?: RequestOptions): Promise<PoolClaimResponse> {
    throw notImplemented("pools.claim");
  }
}
