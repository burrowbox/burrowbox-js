import { APIResource } from "../resource.js";
import { path, type RequestOptions } from "../http.js";
import type { Account as AccountInfo, AccountUpdateParams, ApiKey, ApiKeyCreateParams, ApiKeyCreated } from "../types/account.js";

/** API keys of the account. `client.account.apiKeys` */
export class ApiKeys extends APIResource {
  /** Keys (prefix only, never the secret), newest first. `GET /api/keys` */
  list(options?: RequestOptions): Promise<ApiKey[]> {
    return this._http.get<ApiKey[]>("/api/keys", undefined, options);
  }

  /** Returns the full `tmk_` key once. `POST /api/keys` → 201 */
  create(params: ApiKeyCreateParams = {}, options?: RequestOptions): Promise<ApiKeyCreated> {
    return this._http.post<ApiKeyCreated>("/api/keys", params, options);
  }

  /** Revoke a key. `deleted` is `false` when it didn't exist. `DELETE /api/keys/{id}` */
  delete(keyId: string, options?: RequestOptions): Promise<{ deleted: boolean }> {
    return this._http.delete<{ deleted: boolean }>(path`/api/keys/${keyId}`, options);
  }
}

/** The account behind the API key. `client.account` */
export class Account extends APIResource {
  readonly apiKeys: ApiKeys = new ApiKeys(this._client);

  /** Profile, balance summary and payment status. `GET /api/me` */
  get(options?: RequestOptions): Promise<AccountInfo> {
    return this._http.get<AccountInfo>("/api/me", undefined, options);
  }

  /** Change the display name (an empty name is ignored). `PATCH /api/me` */
  update(params: AccountUpdateParams, options?: RequestOptions): Promise<AccountInfo> {
    return this._http.patch<AccountInfo>("/api/me", params, options);
  }
}
