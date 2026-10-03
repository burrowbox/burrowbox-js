/**
 * MCP connection details. A {@link McpServerConfig} is plain data: pass it to one of the
 * converters (`toAgentSdkMcpServer`, `toMessagesApiMcpServer`, `toClaudeCodeCommand`) or use
 * `url` + `headers` with any Streamable HTTP MCP client.
 */
export interface McpServerConfig {
  /** Server name for MCP clients: `[a-zA-Z0-9_-]`, e.g. `burrowbox` or `burrowbox-2f6aeedcd3`. */
  name: string;
  /** Streamable HTTP endpoint: `{baseUrl}/mcp` (platform) or `{baseUrl}/api/machines/{id}/mcp` (machine). */
  url: string;
  /** The bearer token: the machine's `tmm_` token, or your `tmk_` API key. */
  token: string;
  /** `{ Authorization: "Bearer <token>" }`. */
  headers: { Authorization: string };
  /** Always `"http"` (Streamable HTTP). */
  transport: "http";
}

export interface MachineMcpOptions {
  /** Server name. Default `burrowbox-<machineId>`. */
  name?: string;
  /**
   * Authenticate with the client's API key instead of the machine's `mcpToken`. Default `false`:
   * prefer the scoped machine token for agents.
   */
  useApiKey?: boolean;
}

export interface PlatformMcpOptions {
  /** Server name. Default `burrowbox`. */
  name?: string;
}

/** Entry for `mcpServers` in the Claude Agent SDK (`query({ options: { mcpServers } })`). */
export interface AgentSdkMcpServer {
  type: "http";
  url: string;
  headers: Record<string, string>;
}

/** Entry for `mcp_servers` in the Anthropic Messages API MCP connector. */
export interface MessagesApiMcpServer {
  type: "url";
  url: string;
  name: string;
  authorization_token: string;
}
