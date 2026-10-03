import { APIResource, notImplemented } from "../resource.js";
import type { RequestOptions } from "../http.js";
import type { MachineRef } from "../types/common.js";
import type { VaultCredential, VaultDeleteResponse, VaultSetParams } from "../types/vault.js";

/**
 * Each machine's encrypted credential vault. Agents use credentials (`browser_login`,
 * `vault_type_secret`) without seeing them. The machine must be running. `client.vault`
 */
export class Vault extends APIResource {
  /** Credentials without secrets. `GET /api/machines/{id}/vault` */
  async list(machine: MachineRef, options?: RequestOptions): Promise<VaultCredential[]> {
    throw notImplemented("vault.list");
  }

  /** Create or update. `PUT /api/machines/{id}/vault/{name}` */
  async set(machine: MachineRef, name: string, params: VaultSetParams, options?: RequestOptions): Promise<VaultCredential> {
    throw notImplemented("vault.set");
  }

  /** `DELETE /api/machines/{id}/vault/{name}` */
  async delete(machine: MachineRef, name: string, options?: RequestOptions): Promise<VaultDeleteResponse> {
    throw notImplemented("vault.delete");
  }
}
