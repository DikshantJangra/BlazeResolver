export interface SearchResult {
  path: string;
  line?: number;
  content?: string;
}

export interface FileContent {
  path: string;
  content: string;
}

export interface SymbolResult {
  name: string;
  path: string;
  line?: number;
  kind?: string;
}

export interface ReferenceResult {
  name: string;
  path: string;
  line?: number;
}

export interface DefinitionResult {
  name: string;
  path: string;
  line?: number;
  content?: string;
}

export interface DependencyResult {
  path: string;
  type?: string;
}

export interface ImpactResult {
  target: string;
  affectedFiles: string[];
  affectedSymbols?: SymbolResult[];
}

export interface ExploreResult {
  query: string;
  files?: string[];
  symbols?: SymbolResult[];
  references?: ReferenceResult[];
  dependencies?: DependencyResult[];
  impact?: ImpactResult;
  context?: string;
}

export interface Workspace {
  id: string;
  path: string;
  branch?: string;
}

export interface TestResult {
  success: boolean;
  output: string;
}

export interface BuildResult {
  success: boolean;
  output: string;
}

export interface CommitResult {
  hash: string;
  message: string;
}


// ============================================================
// CODEBASE INTERFACE
// ============================================================

export interface CodebaseInterface {
  search(query: string): Promise<SearchResult[]>;

  readFile(path: string): Promise<FileContent>;

  readRange(
    path: string,
    startLine: number,
    endLine: number
  ): Promise<FileContent>;

  findSymbol(
    name: string
  ): Promise<SymbolResult[]>;

  findReferences(
    symbol: string
  ): Promise<ReferenceResult[]>;

  getDefinition(
    symbol: string
  ): Promise<DefinitionResult | null>;

  getCallers(
    symbol: string
  ): Promise<SymbolResult[]>;

  getCallees(
    symbol: string
  ): Promise<SymbolResult[]>;

  getDependencies(
    path: string
  ): Promise<DependencyResult[]>;

  getReverseDependencies(
    path: string
  ): Promise<DependencyResult[]>;

  getImpact(
    symbol: string
  ): Promise<ImpactResult>;

  explore(
    query: string
  ): Promise<ExploreResult>;
}


// ============================================================
// WORKSPACE INTERFACE
// ============================================================

export interface WorkspaceInterface {
  createWorkspace(): Promise<Workspace>;

  /**
   * Reads a file as the workspace currently has it (its base plus applied patches).
   * Resolves to null when the file does not exist. Patches are generated against this content.
   */
  readFile(
    workspace: Workspace,
    path: string
  ): Promise<string | null>;

  applyPatch(
    workspace: Workspace,
    patch: string
  ): Promise<void>;

  gitDiff(
    workspace: Workspace
  ): Promise<string>;

  runTests(
    workspace: Workspace
  ): Promise<TestResult>;

  runBuild(
    workspace: Workspace
  ): Promise<BuildResult>;

  commit(
    workspace: Workspace,
    message: string
  ): Promise<CommitResult>;
}
