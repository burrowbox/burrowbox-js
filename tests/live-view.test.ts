import { describe, expect, it } from "vitest";
import { AuthenticationError, BadRequestError, parseLiveViewMessage } from "../src/index.js";
import { client, json, machineFixture } from "./helpers.js";

const base = "https://bb.test/api/machines";
const link = {
  url: "https://bb.test/embed/2f6aeedcd3?t=abc.def",
  expiresAt: 1790800000000,
  mode: "browser",
  interactive: false,
  iframe: '<iframe src="https://bb.test/embed/2f6aeedcd3?t=abc.def"></iframe>',
};

describe("liveView.create", () => {
  it("POSTs the params and returns the link (201)", async () => {
    const { bb, calls } = client([json(link, 201)]);
    const params = {
      mode: "browser" as const,
      interactive: false,
      ttlSeconds: 900,
      allowedOrigins: ["https://app.example.com"],
      showControls: false,
      region: { x: 0, y: 0, width: 640, height: 400 },
      selector: "#agenda",
    };
    const res = await bb.liveView.create("2f6aeedcd3", params);
    expect(res).toEqual(link);
    expect(calls[0]!.method).toBe("POST");
    expect(calls[0]!.url).toBe(`${base}/2f6aeedcd3/live-view`);
    expect(calls[0]!.body).toEqual(params);
    expect(calls[0]!.headers.authorization).toBe("Bearer tmk_test");
  });

  it("sends {} by default, accepts a machine object, and machines.liveView delegates", async () => {
    const { bb, calls } = client([json(link, 201)]);
    await bb.liveView.create(machineFixture);
    await bb.machines.liveView("abc", { mode: "app", app: "gimp", interactive: true });
    expect(calls.map((c) => [c.method, c.url, c.body])).toEqual([
      ["POST", `${base}/2f6aeedcd3/live-view`, {}],
      ["POST", `${base}/abc/live-view`, { mode: "app", app: "gimp", interactive: true }],
    ]);
  });

  it("works with a machine token", async () => {
    const { bb, calls } = client([json(link, 201)], { apiKey: "tmm_abc" });
    await bb.liveView.create("2f6aeedcd3");
    expect(calls[0]!.headers.authorization).toBe("Bearer tmm_abc");
  });

  it("maps 400 and 401, and is not retried", async () => {
    const { bb, calls } = client(
      [json({ error: "region must be {x, y, width, height} in whole pixels (width and height at least 16)" }, 400), json({ error: "unauthorized" }, 401)],
      { maxRetries: 3 },
    );
    await expect(bb.liveView.create("abc", { region: { x: 0, y: 0, width: 1, height: 1 } })).rejects.toBeInstanceOf(BadRequestError);
    await expect(bb.liveView.create("abc")).rejects.toBeInstanceOf(AuthenticationError);
    expect(calls).toHaveLength(2);
  });
});

describe("parseLiveViewMessage", () => {
  const ev = (data: unknown, origin = "https://burrowbox.dev") => ({ origin, data });

  it("parses each message type", () => {
    expect(parseLiveViewMessage(ev({ source: "burrowbox", machine: "abc", type: "connected", mode: "desktop" }))).toEqual({
      source: "burrowbox",
      type: "connected",
      mode: "desktop",
      machine: "abc",
    });
    expect(parseLiveViewMessage(ev({ source: "burrowbox", type: "disconnected" }))).toEqual({ source: "burrowbox", type: "disconnected" });
    expect(parseLiveViewMessage(ev({ source: "burrowbox", type: "expired" }))).toEqual({ source: "burrowbox", type: "expired" });
    expect(parseLiveViewMessage(ev({ source: "burrowbox", type: "url", url: "https://example.com/", title: "Example" }))).toEqual({
      source: "burrowbox",
      type: "url",
      url: "https://example.com/",
      title: "Example",
    });
  });

  it("checks the origin (custom origin allowed)", () => {
    const data = { source: "burrowbox", type: "expired" };
    expect(parseLiveViewMessage(ev(data, "https://evil.example"))).toBeNull();
    expect(parseLiveViewMessage(ev(data, "https://bb.test"), "https://bb.test")).not.toBeNull();
    expect(parseLiveViewMessage(ev(data, "https://bb.test"), "https://bb.test/")).not.toBeNull();
    expect(parseLiveViewMessage(ev(data), "https://bb.test")).toBeNull();
  });

  it("rejects foreign or malformed data", () => {
    expect(parseLiveViewMessage(ev(null))).toBeNull();
    expect(parseLiveViewMessage(ev("expired"))).toBeNull();
    expect(parseLiveViewMessage(ev({ type: "expired" }))).toBeNull();
    expect(parseLiveViewMessage(ev({ source: "other", type: "expired" }))).toBeNull();
    expect(parseLiveViewMessage(ev({ source: "burrowbox", type: "unknown" }))).toBeNull();
    expect(parseLiveViewMessage(ev({ source: "burrowbox", type: "connected", mode: "tv" }))).toBeNull();
    expect(parseLiveViewMessage(ev({ source: "burrowbox", type: "url" }))).toBeNull();
  });
});
