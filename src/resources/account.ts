import { APIResource, notImplemented } from "../resource.js";
import type { RequestOptions } from "../http.js";
import type { Account as AccountInfo, AccountUpdateParams, ApiKey, ApiKeyCreateParams, ApiKeyCreated } from "../types/account.js";

/** API keys of the account. `client.account.apiKeys` */
export class ApiKeys extends APIResource {
  /** `GET /api/keys` */
  async list(options?: RequestOptions): Promise<ApiKey[]> {
    throw notImplemented("account.apiKeys.list");
  }

  /** Returns the full `tmk_` key once. `POST /api/keys` → 201 */
  async create(params: ApiKeyCreateParams = {}, options?: RequestOptions): Promise<ApiKeyCreated> {
    throw notImplemented("account.apiKeys.create");
  }

  /** `DELETE /api/keys/{id}` */
  async delete(keyId: string, options?: RequestOptions): Promise<{ deleted: boolean }> {
    throw notImplemented("account.apiKeys.delete");
  }
}

/** The account behind the API key. `client.account` */
export class Account extends APIResource {
  readonly apiKeys: ApiKeys = new ApiKeys(this._client);

  /** `GET /api/me` */
  async get(options?: RequestOptions): Promise<AccountInfo> {
    throw notImplemented("account.get");
  }

  /** Change the display name. `PATCH /api/me` */
  async update(params: AccountUpdateParams, options?: RequestOptions): Promise<AccountInfo> {
    throw notImplemented("account.update");
  }
}
