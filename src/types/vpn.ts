import type { VpnSetting, VpnType } from "./common.js";
import type { MachineAppliedResponse } from "./machines.js";

export interface VpnTypeInfo {
  type: VpnType;
  name: string;
  description: string;
  available: boolean;
  /** Whether `city` can be used with this type. */
  cityTargeting: boolean;
  pricing: { centsPerHour: number; centsPerGb: number; centsPer1kConnections: number };
}

export interface VpnLocations {
  available: boolean;
  types: VpnTypeInfo[];
  /** Common locations; any two-letter country code works. */
  locations: { country: string; name: string }[];
  /** Same list, older shape. */
  countries?: { code: string; name: string }[];
  note: string;
}

/** Public IP and location the machine's traffic leaves from (looked up through the VPN). */
export interface VpnEgress {
  ok: boolean;
  ip?: string;
  /** Two-letter country code as the geo-IP service reports it (uppercase, e.g. `DE`). */
  country?: string;
  region?: string;
  city?: string;
  org?: string;
  /** Why the lookup failed (`ok: false`). */
  error?: string;
}

export interface MachineVpnStatus {
  vpn: VpnSetting | null;
  /** Where traffic currently leaves from; `null` when the machine isn't running. */
  egress: VpnEgress | null;
}

/** The updated machine, plus whether the change was applied live (`note` explains when it wasn't). */
export type MachineVpnResponse = MachineAppliedResponse;
