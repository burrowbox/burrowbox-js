import { APIResource } from "../resource.js";
import { path, type RequestOptions } from "../http.js";
import { idOf, type MachineRef } from "../types/common.js";
import type { VaultCredential, VaultDeleteResponse, VaultSetParams } from "../types/vault.js";

/**
 * Each machine's encrypted credential vault. Agents use credentials (`browser_login`,
 * `vault_type_secret`) without seeing them. The machine must be running (409 `ConflictError`
 * otherwise). `client.vault`. See https://burrowbox.dev/docs/vault
 */
export class Vault extends APIResource {
  /** Credentials sorted by name, without secrets (`hasPassword` / `hasTotp` instead). `GET /api/machines/{id}/vault` */
  async list(machine: MachineRef, options?: RequestOptions): Promise<VaultCredential[]> {
    return this._http.get<VaultCredential[]>(path`/api/machines/${idOf(machine)}/vault`, undefined, options);
  }

  /**
   * Create or update a credential; fields left out keep their current value. Returns it without
   * secrets. `PUT /api/machines/{id}/vault/{name}`
   */
  async set(machine: MachineRef, name: string, params: VaultSetParams, options?: RequestOptions): Promise<VaultCredential> {
    return this._http.put<VaultCredential>(path`/api/machines/${idOf(machine)}/vault/${name}`, params, options);
  }

  /** Remove a credential. `deleted` is `false` when there was none by that name. `DELETE /api/machines/{id}/vault/{name}` */
  async delete(machine: MachineRef, name: string, options?: RequestOptions): Promise<VaultDeleteResponse> {
    return this._http.delete<VaultDeleteResponse>(path`/api/machines/${idOf(machine)}/vault/${name}`, options);
  }
}
