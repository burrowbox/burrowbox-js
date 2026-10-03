import { APIResource, notImplemented } from "../resource.js";
import type { RequestOptions } from "../http.js";
import type { MachineRef, VpnInput } from "../types/common.js";
import type { MachineVpnResponse, MachineVpnStatus, VpnLocations } from "../types/vpn.js";

/** VPN locations: browse from a residential IP in a chosen country. `client.vpn` */
export class Vpn extends APIResource {
  /** Types, prices and common locations (no auth). `GET /api/vpn/locations` */
  async locations(options?: RequestOptions): Promise<VpnLocations> {
    throw notImplemented("vpn.locations");
  }

  /** The machine's VPN setting and where it currently browses from. `GET /api/machines/{id}/vpn` */
  async get(machine: MachineRef, options?: RequestOptions): Promise<MachineVpnStatus> {
    throw notImplemented("vpn.get");
  }

  /**
   * Set (partial: omitted fields keep their value) or turn off (`null`) the VPN. Live on a running
   * machine. `PUT /api/machines/{id}/vpn` with `{ vpn }`
   */
  async set(machine: MachineRef, vpn: VpnInput | null, options?: RequestOptions): Promise<MachineVpnResponse> {
    throw notImplemented("vpn.set");
  }

  /** Same as `set(machine, null)`. */
  async disable(machine: MachineRef, options?: RequestOptions): Promise<MachineVpnResponse> {
    throw notImplemented("vpn.disable");
  }
}
