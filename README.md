# burrowbox-js

TypeScript client library for the [Burrowbox](https://burrowbox.dev) API: persistent Linux computers for AI agents, each with a desktop, a browser that stays signed in, a credential vault and its own MCP endpoint.

**[→ Start using Burrowbox](https://burrowbox.dev)** · [API docs](https://burrowbox.dev/docs)

## Install

```bash
bun add burrowbox
```

npm (`npm install burrowbox`) and pnpm (`pnpm add burrowbox`) work too. No runtime dependencies. Works anywhere with a global `fetch`: Bun, Node 18+, Deno, Cloudflare Workers. Keep API keys on your server.

## Quickstart

Create an API key under **Account → API keys** and export it:

```bash
export BURROWBOX_KEY=tmk_...
```

Create a machine and connect an agent to it over MCP:

```ts
import { Burrowbox, toAgentSdkMcpServers } from "burrowbox";
import { query } from "@anthropic-ai/claude-agent-sdk";

const bb = new Burrowbox(); // reads BURROWBOX_KEY

// Boots in a few seconds. It turns itself off (keeping its state) after an hour.
const machine = await bb.machines.create({ name: "research-bot", size: "tiny", ttlMinutes: 60 });

// MCP URL + the machine's scoped token (tmm_…), which only works on this machine.
const mcp = await bb.machines.mcp(machine);

for await (const msg of query({
  prompt: "Open news.ycombinator.com and summarise the top 5 stories.",
  options: { mcpServers: toAgentSdkMcpServers(mcp) },
})) {
  if (msg.type === "result" && msg.subtype === "success") console.log(msg.result);
}

await bb.machines.stop(machine); // files, apps, logins and open windows are kept
```

`mcp` is plain data (`{ name, url, token, headers }`), so it works with any Streamable HTTP MCP client. `toMessagesApiMcpServer(mcp)` gives the Anthropic Messages API MCP connector shape, and `toClaudeCodeCommand(mcp)` prints a `claude mcp add` command.

## Features

- **Machines:** create, list, start, stop, resize, schedule and destroy, plus screenshots, apps and windows.
- **MCP:** connection details for each machine's endpoint and for the platform endpoint.
- **Live view:** signed links to embed a machine's screen in your product. You choose whether viewers can take control.
- **Vault:** store logins in a machine. Agents can use them without ever seeing them.
- **Warm pools:** keep machines booted and set up from a template, then claim one instantly for a customer.
- **Automations:** cron jobs and webhooks that run commands, MCP tools or HTTP calls inside a machine.
- **Event webhooks:** signed notifications when machines change state, plus `verifyWebhookSignature()`.
- **Billing and VPN:** balance, usage per customer, and residential VPN locations.
- **Typed errors** (`NotFoundError`, `InsufficientCreditError`, `RateLimitError`…), timeouts, and automatic retries for idempotent requests.

```ts
const bb = new Burrowbox({
  apiKey: process.env.BURROWBOX_KEY, // or a machine token (tmm_…) for MCP and live-view only
  baseUrl: "https://burrowbox.dev",
  timeoutMs: 60_000,
  maxRetries: 2,
  fetch: customFetch, // optional
});
```

### Verify event webhooks

```ts
import { constructWebhookEvent } from "burrowbox";

// Pass the raw body, not re-serialized JSON. Throws WebhookSignatureError if it doesn't verify.
const event = await constructWebhookEvent(await req.text(), req.headers.get("burrowbox-signature"), process.env.BURROWBOX_WEBHOOK_SECRET!);
if (event.type === "machine.stopped") console.log(event.data.machine.id, event.data.detail);
```

It uses Web Crypto, so the same code runs in Bun, Node, Deno, Workers and edge runtimes.

The full surface is in [API.md](./API.md).

## Development

The repo uses [Bun](https://bun.sh) for installs and scripts. Tests run on Vitest, the build on tsup (ESM + CJS + types).

```bash
bun install
bun run typecheck && bun run test && bun run build
bun run smoke   # import the built package from Node (ESM and CJS)
```

## License

MIT
