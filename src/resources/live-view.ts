import { APIResource } from "../resource.js";
import { path, type RequestOptions } from "../http.js";
import { idOf, type MachineRef } from "../types/common.js";
import type { LiveViewCreateParams, LiveViewLink, LiveViewMessage, LiveViewMode } from "../types/live-view.js";

/**
 * Embeddable live view: short-lived signed links to watch or take over a machine in an `<iframe>`.
 * Works with an API key or with the machine's own `tmm_` token. `client.liveView`
 */
export class LiveView extends APIResource {
  /**
   * Create a signed link (default: whole desktop, watch only, 1 hour) to put in an `<iframe>`. Create
   * links on your server so the API key never reaches the browser.
   * `POST /api/machines/{id}/live-view` → 201. See https://burrowbox.dev/docs/embed
   */
  async create(machine: MachineRef, params: LiveViewCreateParams = {}, options?: RequestOptions): Promise<LiveViewLink> {
    return this._http.post<LiveViewLink>(path`/api/machines/${idOf(machine)}/live-view`, params, options);
  }
}

const MODES: readonly string[] = ["desktop", "app", "browser"] satisfies LiveViewMode[];

/**
 * Browser helper: returns the viewer's message when `event` comes from a Burrowbox embed
 * (`event.origin` matches `origin`, default `https://burrowbox.dev`, and `data.source === "burrowbox"`),
 * otherwise `null`. Use it in a `message` listener. See https://burrowbox.dev/docs/embed#events
 */
export function parseLiveViewMessage(
  event: { origin: string; data: unknown },
  origin: string = "https://burrowbox.dev",
): LiveViewMessage | null {
  if (!event || event.origin !== origin.replace(/\/+$/, "")) return null;
  const d = event.data;
  if (typeof d !== "object" || d === null || Array.isArray(d)) return null;
  const o = d as Record<string, unknown>;
  if (o.source !== "burrowbox") return null;
  const machine = typeof o.machine === "string" ? { machine: o.machine } : {};
  switch (o.type) {
    case "connected":
      if (typeof o.mode !== "string" || !MODES.includes(o.mode)) return null;
      return { source: "burrowbox", type: "connected", mode: o.mode as LiveViewMode, ...machine };
    case "disconnected":
      return { source: "burrowbox", type: "disconnected", ...machine };
    case "expired":
      return { source: "burrowbox", type: "expired", ...machine };
    case "url":
      if (typeof o.url !== "string") return null;
      return { source: "burrowbox", type: "url", url: o.url, title: typeof o.title === "string" ? o.title : "", ...machine };
    default:
      return null;
  }
}
