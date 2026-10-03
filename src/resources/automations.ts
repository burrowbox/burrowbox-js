import { APIResource } from "../resource.js";
import { path, type RequestOptions } from "../http.js";
import { idOf, type DeletedResponse, type MachineRef } from "../types/common.js";
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

/** A manual run waits for the action (up to 15 min) and possibly a machine boot (up to 3 min). */
const RUN_MS = 20 * 60_000;

const schedules = (machine: MachineRef) => path`/api/machines/${idOf(machine)}/schedules`;
const webhooks = (machine: MachineRef) => path`/api/machines/${idOf(machine)}/webhooks`;

/** Scheduled jobs (cron, UTC) that run an action inside a machine. `client.automations.schedules` */
export class Schedules extends APIResource {
  /** A machine's schedules, oldest first. `GET /api/machines/{id}/schedules` */
  list(machine: MachineRef, options?: RequestOptions): Promise<Schedule[]> {
    return this._http.get<Schedule[]>(schedules(machine), undefined, options);
  }

  /**
   * Create a schedule; the response includes the next three run times (`upcoming`).
   * `POST /api/machines/{id}/schedules` → 201. `RateLimitError` (429) past 20 per machine.
   */
  create(machine: MachineRef, params: ScheduleCreateParams, options?: RequestOptions): Promise<ScheduleWithUpcoming> {
    return this._http.post<ScheduleWithUpcoming>(schedules(machine), params, options);
  }

  /** Change any field; omitted fields are kept. `PATCH /api/machines/{id}/schedules/{scheduleId}` */
  update(machine: MachineRef, scheduleId: string, params: ScheduleUpdateParams, options?: RequestOptions): Promise<ScheduleWithUpcoming> {
    return this._http.patch<ScheduleWithUpcoming>(`${schedules(machine)}${path`/${scheduleId}`}`, params, options);
  }

  /** `DELETE /api/machines/{id}/schedules/{scheduleId}` */
  delete(machine: MachineRef, scheduleId: string, options?: RequestOptions): Promise<DeletedResponse> {
    return this._http.delete<DeletedResponse>(`${schedules(machine)}${path`/${scheduleId}`}`, options);
  }

  /**
   * Run now and wait for the result (default timeout 20 min). A failed action resolves with
   * `status: "error"`; it does not throw. `POST /api/machines/{id}/schedules/{scheduleId}/run`
   */
  run(machine: MachineRef, scheduleId: string, options?: RequestOptions): Promise<RunResult> {
    return this._http.post<RunResult>(`${schedules(machine)}${path`/${scheduleId}/run`}`, {}, {
      ...options,
      timeoutMs: options?.timeoutMs ?? RUN_MS,
    });
  }
}

/** Inbound webhooks: secret URLs that run an action inside a machine. `client.automations.webhooks` */
export class Webhooks extends APIResource {
  /** URLs are not included (shown only on create/rotate). `GET /api/machines/{id}/webhooks` */
  list(machine: MachineRef, options?: RequestOptions): Promise<Webhook[]> {
    return this._http.get<Webhook[]>(webhooks(machine), undefined, options);
  }

  /** Returns the secret `url` once. `POST /api/machines/{id}/webhooks` → 201 */
  create(machine: MachineRef, params: WebhookCreateParams, options?: RequestOptions): Promise<Webhook> {
    return this._http.post<Webhook>(webhooks(machine), params, options);
  }

  /** Change any field (`enabled: false` makes calls answer 409). `PATCH /api/machines/{id}/webhooks/{webhookId}` */
  update(machine: MachineRef, webhookId: string, params: WebhookUpdateParams, options?: RequestOptions): Promise<Webhook> {
    return this._http.patch<Webhook>(`${webhooks(machine)}${path`/${webhookId}`}`, params, options);
  }

  /** New secret URL; the old one stops working. `POST /api/machines/{id}/webhooks/{webhookId}/rotate` */
  rotate(machine: MachineRef, webhookId: string, options?: RequestOptions): Promise<Webhook> {
    return this._http.post<Webhook>(`${webhooks(machine)}${path`/${webhookId}/rotate`}`, {}, options);
  }

  /** `DELETE /api/machines/{id}/webhooks/{webhookId}` */
  delete(machine: MachineRef, webhookId: string, options?: RequestOptions): Promise<DeletedResponse> {
    return this._http.delete<DeletedResponse>(`${webhooks(machine)}${path`/${webhookId}`}`, options);
  }

  /**
   * Call a webhook URL (no API key is sent; the secret is in the URL). Returns the raw `Response`:
   * a sync `http` action answers with the in-machine app's response; sync shell/tool actions with
   * `{ runId, status, output }` (409 when skipped, 502 when the action failed); async mode with
   * `202 { accepted, runId }`. Non-2xx is NOT thrown. Sync calls default to a 20 min timeout.
   */
  call(url: string, params: WebhookCallParams = {}, options?: RequestOptions): Promise<Response> {
    const method = params.method ?? "POST";
    const sendsBody = method !== "GET" && params.body !== undefined;
    return this._http.request<Response>({
      ...options,
      method,
      path: url,
      query: params.query,
      body: sendsBody ? params.body : undefined,
      headers: { ...params.headers, ...options?.headers },
      timeoutMs: options?.timeoutMs ?? RUN_MS,
      auth: false,
      idempotent: false,
      responseType: "response",
      throwOnError: false,
    });
  }
}

/** Scheduled jobs, webhooks and their runs. `client.automations` */
export class Automations extends APIResource {
  readonly schedules: Schedules = new Schedules(this._client);
  readonly webhooks: Webhooks = new Webhooks(this._client);

  /** Recent runs from schedules, webhooks and manual triggers, newest first. `GET /api/machines/{id}/runs?limit=` */
  runs(machine: MachineRef, params: RunListParams = {}, options?: RequestOptions): Promise<JobRun[]> {
    return this._http.get<JobRun[]>(path`/api/machines/${idOf(machine)}/runs`, { limit: params.limit }, options);
  }
}
