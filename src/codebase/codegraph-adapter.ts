import { relative, resolve, isAbsolute } from 'node:path';
import { CodegraphClient } from './codegraph-client.js';
import type {
  CodebaseInterface,
  DefinitionResult,
  DependencyResult,
  ExploreResult,
  FileContent,
  ImpactResult,
  ReferenceResult,
  SearchResult,
  SymbolResult
} from './contracts.js';

export interface CodeGraphAdapterOptions {
  /** Repository to index. codegraph refuses to read files outside it. */
  root: string;
  /** Per-tool-call timeout; the first call on a large repository includes a cold index build. */
  toolTimeoutMs?: number;
}

/** codegraph's maximum for refs, calls and file_deps collections. */
const MAX_RESULTS = 500;
/** codegraph's maximum page size for get_file. */
const MAX_PAGE_LINES = 10000;
const MAX_PAGE_BYTES = 500000;
/** Lines returned as a definition's content, starting at its declaration. */
const DEFINITION_CONTEXT_LINES = 30;
/** How far callers and reverse dependencies are followed when computing impact. */
const IMPACT_DEPTH = 2;

interface RawPosition {
  line: number;
  column: number;
}

interface RawSymbol {
  handle: string;
  name: string;
  qualifiedName?: string;
  kind: string;
  location: { file: string; range: { start: RawPosition } };
}

interface RawSearchResult {
  file?: string;
  range?: { start: RawPosition };
  evidence?: Array<{ snippet?: string }>;
}

interface RawExploreAnchor extends RawSearchResult {
  kind: string;
  label: string;
}

interface RawFilePage {
  text: string;
  page?: { nextOffset?: number };
}

/**
 * CodebaseInterface backed by the codegraph MCP server
 * (`@lzehrung/codegraph`, run as `codegraph mcp serve --stdio`).
 *
 * Symbol arguments accept a plain name (`formatMoney`), a qualified path
 * (`src/core/domain.ts::formatMoney`) or a codegraph handle (`symbol:...`).
 * A plain name that is declared in several places is answered for every declaration.
 */
export class CodeGraphAdapter implements CodebaseInterface {
  private root: string;
  private codegraph: CodegraphClient;

  constructor(options: CodeGraphAdapterOptions) {
    this.root = resolve(options.root);
    this.codegraph = new CodegraphClient({ root: this.root, toolTimeoutMs: options.toolTimeoutMs });
  }

  /** Stops the codegraph server process. */
  public close(): Promise<void> {
    return this.codegraph.close();
  }

  public async search(query: string): Promise<SearchResult[]> {
    const res = await this.codegraph.callTool<{ results: RawSearchResult[] }>('search', { query, limit: 20 });
    return res.results
      .filter((r) => r.file)
      .map((r) => ({
        path: r.file!,
        line: r.range?.start.line,
        content: r.evidence?.find((e) => e.snippet)?.snippet
      }));
  }

  public async readFile(path: string): Promise<FileContent> {
    return { path, content: await this.readLines(path, 1) };
  }

  public async readRange(path: string, startLine: number, endLine: number): Promise<FileContent> {
    if (startLine < 1 || endLine < startLine) {
      throw new RangeError(`Invalid line range ${startLine}-${endLine} for ${path}`);
    }
    return { path, content: await this.readLines(path, startLine, endLine - startLine + 1) };
  }

  public async findSymbol(name: string): Promise<SymbolResult[]> {
    const res = await this.codegraph.callTool<{ symbols: RawSymbol[] }>('workspace_symbols', { query: name, limit: 50 });
    return res.symbols.map(toSymbolResult);
  }

  public async findReferences(symbol: string): Promise<ReferenceResult[]> {
    const references: ReferenceResult[] = [];
    for (const target of await this.resolveSymbols(symbol)) {
      const res = await this.codegraph.callTool<{ references: Array<{ file: string; range: { start: RawPosition } }> }>(
        'refs',
        { handle: target.handle, limit: MAX_RESULTS }
      );
      for (const ref of res.references) {
        references.push({ name: target.name, path: ref.file, line: ref.range.start.line });
      }
    }
    return unique(references, (r) => `${r.path}:${r.line}:${r.name}`);
  }

  public async getDefinition(symbol: string): Promise<DefinitionResult | null> {
    const [target] = await this.resolveSymbols(symbol);
    if (!target) return null;

    const res = await this.codegraph.callTool<{
      status: string;
      definition?: { file: string; localName: string; range: { start: RawPosition } };
    }>('goto', { handle: target.handle });

    const path = res.status === 'ok' && res.definition ? this.toProjectPath(res.definition.file) : target.location.file;
    const line = res.status === 'ok' && res.definition ? res.definition.range.start.line : target.location.range.start.line;
    const { content } = await this.readRange(path, line, line + DEFINITION_CONTEXT_LINES - 1);

    return { name: res.definition?.localName ?? target.name, path, line, content };
  }

  public async getCallers(symbol: string): Promise<SymbolResult[]> {
    return this.calls(symbol, 'callers', 1);
  }

  public async getCallees(symbol: string): Promise<SymbolResult[]> {
    return this.calls(symbol, 'callees', 1);
  }

  public async getDependencies(path: string): Promise<DependencyResult[]> {
    const res = await this.codegraph.callTool<{ dependencies: Array<{ file: string }> }>('file_deps', {
      file: path,
      direction: 'deps',
      limit: MAX_RESULTS
    });
    return res.dependencies.map((d) => ({ path: d.file }));
  }

  public async getReverseDependencies(path: string): Promise<DependencyResult[]> {
    const res = await this.codegraph.callTool<{ reverseDependencies: Array<{ file: string }> }>('file_deps', {
      file: path,
      direction: 'rdeps',
      limit: MAX_RESULTS
    });
    return res.reverseDependencies.map((d) => ({ path: d.file }));
  }

  public async getImpact(symbol: string): Promise<ImpactResult> {
    const files = new Set<string>();
    const affectedSymbols: SymbolResult[] = [];

    for (const target of await this.resolveSymbols(symbol)) {
      files.add(target.location.file);

      const [callers, rdeps] = await Promise.all([
        this.codegraph.callTool<{ entries: Array<{ symbol: RawSymbol }> }>('calls', {
          handle: target.handle,
          direction: 'callers',
          depth: IMPACT_DEPTH,
          limit: MAX_RESULTS
        }),
        this.codegraph.callTool<{ reverseDependencies: Array<{ file: string }> }>('file_deps', {
          file: target.location.file,
          direction: 'rdeps',
          depth: IMPACT_DEPTH,
          limit: MAX_RESULTS
        })
      ]);

      for (const entry of callers.entries) {
        affectedSymbols.push(toSymbolResult(entry.symbol));
        files.add(entry.symbol.location.file);
      }
      for (const dep of rdeps.reverseDependencies) {
        files.add(dep.file);
      }
    }

    return {
      target: symbol,
      affectedFiles: [...files].sort(),
      affectedSymbols: unique(affectedSymbols, (s) => `${s.path}:${s.line}:${s.name}`)
    };
  }

  public async explore(query: string): Promise<ExploreResult> {
    const res = await this.codegraph.callTool<{
      anchors?: RawExploreAnchor[];
      blastRadius?: Array<{ file: string; reverseDependencies: Array<{ file: string }> }>;
      summary?: string[];
      candidateTests?: string[];
    }>('explore', { query, limit: 10 });

    const anchors = (res.anchors ?? []).filter((a) => a.file);
    const blastRadius = res.blastRadius ?? [];
    const dependents = unique(
      blastRadius.flatMap((b) => b.reverseDependencies.map((d) => d.file)),
      (file) => file
    );

    const context = [...(res.summary ?? [])];
    if (res.candidateTests?.length) {
      context.push(`Candidate tests: ${res.candidateTests.join(', ')}`);
    }

    return {
      query,
      files: unique(anchors.map((a) => a.file!), (file) => file),
      symbols: anchors
        .filter((a) => a.kind === 'symbol')
        .map((a) => ({ name: a.label, path: a.file!, line: a.range?.start.line })),
      dependencies: dependents.map((file) => ({ path: file, type: 'reverse' })),
      impact: {
        target: query,
        affectedFiles: unique([...blastRadius.map((b) => b.file), ...dependents], (file) => file).sort()
      },
      context: context.join('\n')
    };
  }

  private async calls(symbol: string, direction: 'callers' | 'callees', depth: number): Promise<SymbolResult[]> {
    const results: SymbolResult[] = [];
    for (const target of await this.resolveSymbols(symbol)) {
      const res = await this.codegraph.callTool<{ entries: Array<{ symbol: RawSymbol }> }>('calls', {
        handle: target.handle,
        direction,
        depth,
        limit: MAX_RESULTS
      });
      results.push(...res.entries.map((entry) => toSymbolResult(entry.symbol)));
    }
    return unique(results, (s) => `${s.path}:${s.line}:${s.name}`);
  }

  /** Resolves a name, `file::name` path or codegraph handle to the declarations it refers to. */
  private async resolveSymbols(symbol: string): Promise<RawSymbol[]> {
    if (symbol.startsWith('symbol:')) {
      const [, encodedPath, encodedName, line, column] = symbol.split(':');
      return [
        {
          handle: symbol,
          name: decodeURIComponent(encodedName),
          kind: 'unknown',
          location: {
            file: decodeURIComponent(encodedPath),
            range: { start: { line: Number(line), column: Number(column) } }
          }
        }
      ];
    }

    const res = await this.codegraph.callTool<{ symbols: RawSymbol[] }>('workspace_symbols', { query: symbol, limit: 50 });
    return res.symbols.filter((s) => s.name === symbol || s.qualifiedName === symbol);
  }

  /** Reads lines through codegraph's paginated get_file, which confines reads to the project root. */
  private async readLines(file: string, startLine: number, lineCount?: number): Promise<string> {
    const pages: string[] = [];
    let offset = startLine;
    let remaining = lineCount;

    while (remaining === undefined || remaining > 0) {
      const limit = remaining === undefined ? MAX_PAGE_LINES : Math.min(remaining, MAX_PAGE_LINES);
      const page = await this.codegraph.callTool<RawFilePage>('get_file', {
        file,
        offset,
        limit,
        maxBytes: MAX_PAGE_BYTES
      });
      pages.push(page.text);

      const next = page.page?.nextOffset;
      if (next === undefined) break;
      if (next <= offset) {
        throw new Error(`Cannot read past line ${offset} of ${file}: a single line exceeds ${MAX_PAGE_BYTES} bytes`);
      }
      if (remaining !== undefined) remaining -= next - offset;
      offset = next;
    }

    return pages.join('\n');
  }

  private toProjectPath(file: string): string {
    return isAbsolute(file) ? relative(this.root, file) : file;
  }
}

function toSymbolResult(raw: RawSymbol): SymbolResult {
  return {
    name: raw.name,
    path: raw.location.file,
    line: raw.location.range.start.line,
    kind: raw.kind
  };
}

function unique<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
