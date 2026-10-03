import type { Timestamp } from "./common.js";

export type LiveViewMode = "desktop" | "app" | "browser";

/** Only stream this area, in whole pixels (width and height ≥ 16). */
export interface LiveViewRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LiveViewCreateParams {
  /** Default `desktop`. */
  mode?: LiveViewMode;
  /** `false` (default) = watch only, enforced on the machine. `true` = viewer can use mouse and keyboard. */
  interactive?: boolean;
  /** `mode: "app"`: part of the window class or title (e.g. `gimp`). Default: the focused window. */
  app?: string;
  /** 60–86 400. Default 3600. */
  ttlSeconds?: number;
  /** Origins allowed to embed the link (≤ 10), e.g. `["https://app.example.com"]`. Default: any. */
  allowedOrigins?: string[];
  /** Show the status pill and fullscreen button. Default `true`. */
  showControls?: boolean;
  /** `desktop`: screen pixels; `browser`: CSS pixels of the 1280×800 viewport. Ignored for `app`. */
  region?: LiveViewRegion;
  /** `mode: "browser"` only: stream just this element (CSS selector ≤ 200 chars). */
  selector?: string;
}

export interface LiveViewLink {
  /** `https://burrowbox.dev/embed/{id}?t=…` — put it in an `<iframe>`. */
  url: string;
  expiresAt: Timestamp;
  mode: LiveViewMode;
  interactive: boolean;
  /** Ready-made `<iframe …>` HTML. */
  iframe: string;
}

/** Messages the embedded viewer posts to the parent page (`event.data` with `source: "burrowbox"`). */
export type LiveViewMessage =
  | { source: "burrowbox"; type: "connected"; mode: LiveViewMode }
  | { source: "burrowbox"; type: "disconnected" }
  | { source: "burrowbox"; type: "url"; url: string; title: string }
  | { source: "burrowbox"; type: "expired" };
