import { APIResource } from "../resource.js";
import { path, type RequestOptions } from "../http.js";
import { AuthenticationError } from "../errors.js";
import type {
  AgentSdkMcpServer,
  MachineMcpOptions,
  McpServerConfig,
  MessagesApiMcpServer,
  PlatformMcpOptions,
} from "../types/mcp.js";

const cleanName = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 64) || "burrowbox";

function config(name: string, url: string, token: string): McpServerConfig {
  return { name: cleanName(name), url, token, headers: { Authorization: `Bearer ${token}` }, transport: "http" };
}

/**
 * MCP connection details. Burrowbox speaks MCP over Streamable HTTP:
 * - the **platform** server (`/mcp`, API key) lets an agent manage machines;
 * - each **machine** server (`/api/machines/{id}/mcp`, machine token) lets an agent operate that computer.
 *
 * `client.mcp`
 */
export class Mcp extends APIResource {
  /**
   * The platform MCP server (`{baseUrl}/mcp`), authenticated with the client's API key.
   * Synchronous: no request is made. Throws `AuthenticationError` if the client has no API key.
   */
  platform(opts: PlatformMcpOptions = {}): McpServerConfig {
    const key = this._client.apiKey;
    if (!key) throw new AuthenticationError("The platform MCP server needs an API key (tmk_…)");
    return config(opts.name ?? "burrowbox", this._http.url("/mcp"), key);
  }

  /**
   * A machine's MCP server (`{baseUrl}/api/machines/{id}/mcp`), authenticated with the machine's
   * scoped `mcpToken`. Pass a machine object that already has `mcpToken` (from `create`, `get` or a
   * pool claim) to skip the request; pass an id to look the token up with `GET /api/machines/{id}`.
   * With `useApiKey: true` it uses the client's key instead and makes no request.
   */
  async machine(
    machine: string | { id: string; mcpToken?: string },
    opts: MachineMcpOptions = {},
    options?: RequestOptions,
  ): Promise<McpServerConfig> {
    const id = typeof machine === "string" ? machine : machine.id;
    const name = opts.name ?? `burrowbox-${id}`;
    const url = this._http.url(path`/api/machines/${id}/mcp`);
    if (opts.useApiKey) {
      const key = this._client.apiKey;
      if (!key) throw new AuthenticationError("useApiKey: true needs a client API key");
      return config(name, url, key);
    }
    let token = typeof machine === "string" ? undefined : machine.mcpToken;
    if (!token && this._client.apiKey?.startsWith("tmm_")) token = this._client.apiKey;
    if (!token) token = (await this._client.machines.get(id, options)).mcpToken;
    return config(name, url, token);
  }
}

/**
 * `mcpServers` entry for the Claude Agent SDK:
 * `query({ prompt, options: { mcpServers: { [cfg.name]: toAgentSdkMcpServer(cfg) } } })`.
 */
export function toAgentSdkMcpServer(cfg: McpServerConfig): AgentSdkMcpServer {
  return { type: "http", url: cfg.url, headers: { ...cfg.headers } };
}

/** `mcpServers` object for the Claude Agent SDK from one or more configs, keyed by name. */
export function toAgentSdkMcpServers(...configs: McpServerConfig[]): Record<string, AgentSdkMcpServer> {
  return Object.fromEntries(configs.map((c) => [c.name, toAgentSdkMcpServer(c)]));
}

/**
 * `mcp_servers` entry for the Anthropic Messages API MCP connector:
 * `{ type: "url", url, name, authorization_token }`.
 */
export function toMessagesApiMcpServer(cfg: McpServerConfig): MessagesApiMcpServer {
  return { type: "url", url: cfg.url, name: cfg.name, authorization_token: cfg.token };
}

/** `claude mcp add --transport http <name> <url> --header "Authorization: Bearer …"` */
export function toClaudeCodeCommand(cfg: McpServerConfig): string {
  return `claude mcp add --transport http ${cfg.name} ${cfg.url} --header "Authorization: Bearer ${cfg.token}"`;
}
