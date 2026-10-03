import type { Burrowbox } from "./client.js";
import type { HttpClient } from "./http.js";

/** Base class for API resources (`client.machines`, `client.pools`, …). */
export abstract class APIResource {
  protected readonly _client: Burrowbox;

  constructor(client: Burrowbox) {
    this._client = client;
  }

  protected get _http(): HttpClient {
    return this._client.http;
  }
}

/** Thrown by resource methods that haven't been implemented yet. */
export function notImplemented(method: string): Error {
  return new Error(`${method} is not implemented yet`);
}
