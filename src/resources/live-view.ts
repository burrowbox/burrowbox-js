import { APIResource, notImplemented } from "../resource.js";
import type { RequestOptions } from "../http.js";
import type { MachineRef } from "../types/common.js";
import type { LiveViewCreateParams, LiveViewLink, LiveViewMessage } from "../types/live-view.js";

/**
 * Embeddable live view: short-lived signed links to watch or take over a machine in an `<iframe>`.
 * Works with an API key or with the machine's own `tmm_` token. `client.liveView`
 */
export class LiveView extends APIResource {
  /** `POST /api/machines/{id}/live-view` → 201 */
  async create(machine: MachineRef, params: LiveViewCreateParams = {}, options?: RequestOptions): Promise<LiveViewLink> {
    throw notImplemented("liveView.create");
  }
}

/**
 * Browser helper: returns the viewer's message when `event` comes from a Burrowbox embed
 * (`event.origin` matches `origin`, default `https://burrowbox.dev`, and `data.source === "burrowbox"`),
 * otherwise `null`.
 */
export function parseLiveViewMessage(
  event: { origin: string; data: unknown },
  origin: string = "https://burrowbox.dev",
): LiveViewMessage | null {
  throw notImplemented("parseLiveViewMessage");
}
