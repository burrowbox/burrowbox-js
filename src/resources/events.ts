import { APIResource } from "../resource.js";
import { path, type RequestOptions } from "../http.js";
import type { DeletedResponse } from "../types/common.js";
import type {
  DeliveryListParams,
  EventDelivery,
  EventEndpoint,
  EventEndpointCreateParams,
  EventEndpointTestResult,
  EventEndpointUpdateParams,
  EventEndpointWithSecret,
} from "../types/events.js";

/** Your HTTPS endpoints that receive signed events (up to 10). `client.events.endpoints` */
export class EventEndpoints extends APIResource {
  /** All endpoints, oldest first (secrets are not included). `GET /api/event-webhooks` */
  list(options?: RequestOptions): Promise<EventEndpoint[]> {
    return this._http.get<EventEndpoint[]>("/api/event-webhooks", undefined, options);
  }

  /**
   * Returns the `whsec_` signing secret once. `POST /api/event-webhooks` → 201.
   * `RateLimitError` (429) past 10 endpoints.
   */
  create(params: EventEndpointCreateParams, options?: RequestOptions): Promise<EventEndpointWithSecret> {
    return this._http.post<EventEndpointWithSecret>("/api/event-webhooks", params, options);
  }

  /** Change the URL, events or description, or pause with `enabled: false`. `PATCH /api/event-webhooks/{id}` */
  update(endpointId: string, params: EventEndpointUpdateParams, options?: RequestOptions): Promise<EventEndpoint> {
    return this._http.patch<EventEndpoint>(path`/api/event-webhooks/${endpointId}`, params, options);
  }

  /** New signing secret (returned once); the old one stops working. `POST /api/event-webhooks/{id}/rotate-secret` */
  rotateSecret(endpointId: string, options?: RequestOptions): Promise<EventEndpointWithSecret> {
    return this._http.post<EventEndpointWithSecret>(path`/api/event-webhooks/${endpointId}/rotate-secret`, {}, options);
  }

  /** Send a `test` event now and report how the endpoint answered. `POST /api/event-webhooks/{id}/test` */
  test(endpointId: string, options?: RequestOptions): Promise<EventEndpointTestResult> {
    return this._http.post<EventEndpointTestResult>(path`/api/event-webhooks/${endpointId}/test`, {}, options);
  }

  /** `DELETE /api/event-webhooks/{id}` */
  delete(endpointId: string, options?: RequestOptions): Promise<DeletedResponse> {
    return this._http.delete<DeletedResponse>(path`/api/event-webhooks/${endpointId}`, options);
  }
}

/** Outgoing event webhooks (machine.*, run.*). `client.events` */
export class Events extends APIResource {
  readonly endpoints: EventEndpoints = new EventEndpoints(this._client);

  /** Recent deliveries, newest first. `GET /api/event-webhooks/deliveries?endpoint=&limit=` */
  deliveries(params: DeliveryListParams = {}, options?: RequestOptions): Promise<EventDelivery[]> {
    return this._http.get<EventDelivery[]>("/api/event-webhooks/deliveries", { endpoint: params.endpoint, limit: params.limit }, options);
  }
}
