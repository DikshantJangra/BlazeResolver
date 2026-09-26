import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { fileURLToPath } from 'node:url';

export interface CodegraphClientOptions {
  /** Repository the server indexes. codegraph refuses reads outside it. */
  root: string;
  /** Per-tool-call timeout. The first call on a large repo may include a cold index build. */
  toolTimeoutMs?: number;
}

export class CodegraphToolError extends Error {
  constructor(
    public readonly tool: string,
    message: string
  ) {
    super(`codegraph ${tool}: ${message}`);
    this.name = 'CodegraphToolError';
  }
}

const STDERR_TAIL_BYTES = 4096;

/** codegraph serves at most four concurrent tool calls and rejects the rest as busy instead of queueing. */
const MAX_CONCURRENT_CALLS = 4;

/** The codegraph CLI bundled with this package, so callers need no global install. */
function codegraphCliPath(): string {
  return fileURLToPath(new URL('./bin/cli.js', import.meta.resolve('@lzehrung/codegraph')));
}

/**
 * Owns one `codegraph mcp serve --stdio` subprocess for a repository and exposes its tools.
 * The server keeps the index warm between calls, so reuse one client per repository.
 */
export class CodegraphClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private connecting: Promise<Client> | null = null;
  private stderrTail = '';
  private active = 0;
  private waiting: Array<() => void> = [];

  constructor(private options: CodegraphClientOptions) {}

  public async callTool<T = any>(name: string, args: Record<string, unknown> = {}): Promise<T> {
    const client = await this.connect();
    await this.acquireSlot();
    let result;
    try {
      result = await client.callTool(
        { name, arguments: args },
        { timeout: this.options.toolTimeoutMs ?? 5 * 60 * 1000, resetTimeoutOnProgress: true }
      );
    } catch (err) {
      throw new CodegraphToolError(name, `${err instanceof Error ? err.message : String(err)}${this.describeStderr()}`);
    } finally {
      this.releaseSlot();
    }

    const text = (result.content as Array<{ type: string; text?: string }>)
      .filter((part) => part.type === 'text')
      .map((part) => part.text ?? '')
      .join('');

    if (result.isError) {
      throw new CodegraphToolError(name, text || 'tool reported an error');
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new CodegraphToolError(name, `expected JSON, got: ${text.slice(0, 200)}`);
    }
  }

  public async close(): Promise<void> {
    const client = this.client;
    this.client = null;
    this.connecting = null;
    this.transport = null;
    await client?.close();
  }

  private acquireSlot(): Promise<void> {
    if (this.active < MAX_CONCURRENT_CALLS) {
      this.active++;
      return Promise.resolve();
    }
    return new Promise((resolve) => this.waiting.push(resolve));
  }

  private releaseSlot(): void {
    const next = this.waiting.shift();
    if (next) {
      next();
    } else {
      this.active--;
    }
  }

  private connect(): Promise<Client> {
    if (this.client) return Promise.resolve(this.client);
    this.connecting ??= this.start().catch((err) => {
      this.connecting = null;
      throw err;
    });
    return this.connecting;
  }

  private async start(): Promise<Client> {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [codegraphCliPath(), 'mcp', 'serve', '--root', this.options.root, '--stdio', '--warmup-symbols'],
      cwd: this.options.root,
      stderr: 'pipe'
    });
    transport.stderr?.on('data', (chunk: Buffer) => {
      this.stderrTail = (this.stderrTail + chunk.toString('utf-8')).slice(-STDERR_TAIL_BYTES);
    });

    const client = new Client({ name: 'blazeresolver-codebase-adapter', version: '1.0.0' });
    try {
      await client.connect(transport);
    } catch (err) {
      throw new Error(`Failed to start codegraph MCP server: ${err instanceof Error ? err.message : String(err)}${this.describeStderr()}`);
    }

    this.transport = transport;
    this.client = client;
    return client;
  }

  private describeStderr(): string {
    const tail = this.stderrTail.trim();
    return tail ? `\ncodegraph stderr:\n${tail}` : '';
  }
}
