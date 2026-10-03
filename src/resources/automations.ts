import { APIResource, notImplemented } from "../resource.js";
import type { RequestOptions } from "../http.js";
import type { DeletedResponse, MachineRef } from "../types/common.js";
import type {
  JobRun,
  RunListParams,
  RunResult,
  Schedule,
  ScheduleCreateParams,
  ScheduleUpdateParams,
  ScheduleWithUpcoming,
  Webhook,
  WebhookCallParams,
  WebhookCreateParams,
  WebhookUpdateParams,
} from "../types/automations.js";

/** Scheduled jobs (cron, UTC) that run an action inside a machine. `client.automations.schedules` */
export class Schedules extends APIResource {
  /** `GET /api/machines/{id}/schedules` */
  async list(machine: MachineRef, options?: RequestOptions): Promise<Schedule[]> {
    throw notImplemented("automations.schedules.list");
  }

  /** `POST /api/machines/{id}/schedules` → 201 */
  async create(machine: MachineRef, params: ScheduleCreateParams, options?: RequestOptions): Promise<ScheduleWithUpcoming> {
    throw notImplemented("automations.schedules.create");
  }

  /** `PATCH /api/machines/{id}/schedules/{scheduleId}` */
  async update(machine: MachineRef, scheduleId: string, params: ScheduleUpdateParams, options?: RequestOptions): Promise<ScheduleWithUpcoming> {
    throw notImplemented("automations.schedules.update");
  }

  /** `DELETE /api/machines/{id}/schedules/{scheduleId}` */
  async delete(machine: MachineRef, scheduleId: string, options?: RequestOptions): Promise<DeletedResponse> {
    throw notImplemented("automations.schedules.delete");
  }

  /** Run now and wait for the result (default timeout 20 min). `POST /api/machines/{id}/schedules/{scheduleId}/run` */
  async run(machine: MachineRef, scheduleId: string, options?: RequestOptions): Promise<RunResult> {
    throw notImplemented("automations.schedules.run");
  }
}

/** Inbound webhooks: secret URLs that run an action inside a machine. `client.automations.webhooks` */
export class Webhooks extends APIResource {
  /** URLs are not included (shown only on create/rotate). `GET /api/machines/{id}/webhooks` */
  async list(machine: MachineRef, options?: RequestOptions): Promise<Webhook[]> {
    throw notImplemented("automations.webhooks.list");
  }

  /** Returns the secret `url` once. `POST /api/machines/{id}/webhooks` → 201 */
  async create(machine: MachineRef, params: WebhookCreateParams, options?: RequestOptions): Promise<Webhook> {
    throw notImplemented("automations.webhooks.create");
  }

  /** `PATCH /api/machines/{id}/webhooks/{webhookId}` */
  async update(machine: MachineRef, webhookId: string, params: WebhookUpdateParams, options?: RequestOptions): Promise<Webhook> {
    throw notImplemented("automations.webhooks.update");
  }

  /** New secret URL; the old one stops working. `POST /api/machines/{id}/webhooks/{webhookId}/rotate` */
  async rotate(machine: MachineRef, webhookId: string, options?: RequestOptions): Promise<Webhook> {
    throw notImplemented("automations.webhooks.rotate");
  }

  /** `DELETE /api/machines/{id}/webhooks/{webhookId}` */
  async delete(machine: MachineRef, webhookId: string, options?: RequestOptions): Promise<DeletedResponse> {
    throw notImplemented("automations.webhooks.delete");
  }

  /**
   * Call a webhook URL (no API key is sent; the secret is in the URL). Returns the raw `Response`:
   * a sync `http` action answers with the in-machine app's response; sync shell/tool actions with
   * `{ runId, status, output }`; async mode with `202 { accepted, runId }`. Non-2xx is NOT thrown.
   */
  async call(url: string, params: WebhookCallParams = {}, options?: RequestOptions): Promise<Response> {
    throw notImplemented("automations.webhooks.call");
  }
}

/** Scheduled jobs, webhooks and their runs. `client.automations` */
export class Automations extends APIResource {
  readonly schedules: Schedules = new Schedules(this._client);
  readonly webhooks: Webhooks = new Webhooks(this._client);

  /** Recent runs from schedules, webhooks and manual triggers. `GET /api/machines/{id}/runs?limit=` */
  async runs(machine: MachineRef, params: RunListParams = {}, options?: RequestOptions): Promise<JobRun[]> {
    throw notImplemented("automations.runs");
  }
}
