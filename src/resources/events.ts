import { APIResource, notImplemented } from "../resource.js";
import type { RequestOptions } from "../http.js";
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
  /** `GET /api/event-webhooks` */
  async list(options?: RequestOptions): Promise<EventEndpoint[]> {
    throw notImplemented("events.endpoints.list");
  }

  /** Returns the `whsec_` signing secret once. `POST /api/event-webhooks` → 201 */
  async create(params: EventEndpointCreateParams, options?: RequestOptions): Promise<EventEndpointWithSecret> {
    throw notImplemented("events.endpoints.create");
  }

  /** `PATCH /api/event-webhooks/{id}` */
  async update(endpointId: string, params: EventEndpointUpdateParams, options?: RequestOptions): Promise<EventEndpoint> {
    throw notImplemented("events.endpoints.update");
  }

  /** New signing secret (returned once); the old one stops working. `POST /api/event-webhooks/{id}/rotate-secret` */
  async rotateSecret(endpointId: string, options?: RequestOptions): Promise<EventEndpointWithSecret> {
    throw notImplemented("events.endpoints.rotateSecret");
  }

  /** Send a `test` event now. `POST /api/event-webhooks/{id}/test` */
  async test(endpointId: string, options?: RequestOptions): Promise<EventEndpointTestResult> {
    throw notImplemented("events.endpoints.test");
  }

  /** `DELETE /api/event-webhooks/{id}` */
  async delete(endpointId: string, options?: RequestOptions): Promise<DeletedResponse> {
    throw notImplemented("events.endpoints.delete");
  }
}

/** Outgoing event webhooks (machine.*, run.*). `client.events` */
export class Events extends APIResource {
  readonly endpoints: EventEndpoints = new EventEndpoints(this._client);

  /** Recent deliveries. `GET /api/event-webhooks/deliveries?endpoint=&limit=` */
  async deliveries(params: DeliveryListParams = {}, options?: RequestOptions): Promise<EventDelivery[]> {
    throw notImplemented("events.deliveries");
  }
}
