import type { Action, BrowserMode, Labels, MachineSize, OnExpire, Timestamp, VpnInput } from "./common.js";
import type { MachineWithToken } from "./machines.js";

/** Output of the most recent template run. */
export interface PoolSetupLog {
  at: Timestamp;
  ok: boolean;
  machineId: string;
  durationMs: number;
  output: string;
}

export interface Pool {
  /** e.g. `pool_3fa91c`. */
  id: string;
  name: string;
  size: MachineSize;
  screen: string;
  browser: BrowserMode;
  /** Idle machines to keep (0–10). */
  target: number;
  /** Set up and waiting. */
  ready: number;
  /** Booting or running the template. */
  warming: number;
  /** Template: setup steps every new pool machine runs (≤ 10). Empty = none. */
  setup: Action[];
  /** `true` after 3 setup failures in a row; any update resumes. */
  paused: boolean;
  setupFailures: number;
  lastSetup: PoolSetupLog | null;
  createdAt: Timestamp;
}

export interface PoolCreateParams {
  /** Default `pool`. */
  name?: string;
  /** Default `tiny`. */
  size?: MachineSize;
  /** Default `1440x900`. */
  screen?: string;
  /** 0–10. Default 1. */
  target?: number;
  /** Default `light`. */
  browser?: BrowserMode;
  setup?: Action[];
}

export interface PoolUpdateParams {
  name?: string;
  target?: number;
  size?: MachineSize;
  screen?: string;
  browser?: BrowserMode;
  /** `null` (or `[]`) removes the template. */
  setup?: Action[] | null;
}

export interface PoolDeleteResponse {
  id: string;
  deleted: true;
  destroyedMachines: number;
}

export interface PoolClaimParams {
  name?: string;
  externalId?: string;
  labels?: Labels;
  ttlMinutes?: number;
  onExpire?: OnExpire;
  vpn?: VpnInput & { country: string };
}

export interface PoolClaimResponse extends MachineWithToken {
  /** `true` (HTTP 200) = handed over a ready machine; `false` (HTTP 201) = a new one was booted. */
  fromPool: boolean;
  /** Present when a fresh machine is still running the template in the background. */
  setup?: "pending" | "running" | "done" | "failed" | string;
}
