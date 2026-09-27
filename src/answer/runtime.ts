/**
 * A Node built-in, looked up at runtime so bundlers leave it alone and runtimes without it (edge, workers) get
 * undefined instead of a failed import.
 */
export function builtin<T>(name: string): T | undefined {
  try {
    return (globalThis as any).process?.getBuiltinModule?.(name) as T | undefined;
  } catch {
    return undefined;
  }
}
