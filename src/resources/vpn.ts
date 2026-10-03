import { APIResource } from "../resource.js";
import { path, type RequestOptions } from "../http.js";
import { idOf, type MachineRef, type VpnInput } from "../types/common.js";
import type { MachineVpnResponse, MachineVpnStatus, VpnLocations } from "../types/vpn.js";

/**
 * VPN locations: route a machine's browser and apps through an IP in a chosen country.
 * `client.vpn`. See https://burrowbox.dev/docs/vpn
 */
export class Vpn extends APIResource {
  /** Types, prices and common locations. Public: no API key needed. `GET /api/vpn/locations` */
  async locations(options?: RequestOptions): Promise<VpnLocations> {
    return this._http.request<VpnLocations>({ ...options, method: "GET", path: "/api/vpn/locations", auth: false });
  }

  /**
   * The machine's VPN setting and where its traffic currently leaves from (`egress` is `null` when
   * the machine isn't running). `GET /api/machines/{id}/vpn`
   */
  async get(machine: MachineRef, options?: RequestOptions): Promise<MachineVpnStatus> {
    return this._http.get<MachineVpnStatus>(path`/api/machines/${idOf(machine)}/vpn`, undefined, options);
  }

  /**
   * Set (partial: omitted fields keep their value; `city: null` removes the city) or turn off
   * (`null`) the VPN. Live on a running machine. `PUT /api/machines/{id}/vpn` with `{ vpn }`
   */
  async set(machine: MachineRef, vpn: VpnInput | null, options?: RequestOptions): Promise<MachineVpnResponse> {
    return this._http.put<MachineVpnResponse>(path`/api/machines/${idOf(machine)}/vpn`, { vpn }, options);
  }

  /** Turn the VPN off. Same as `set(machine, null)`. */
  async disable(machine: MachineRef, options?: RequestOptions): Promise<MachineVpnResponse> {
    return this.set(machine, null, options);
  }
}
