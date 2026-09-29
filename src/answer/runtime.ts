/**
 * A Node built-in, looked up at runtime so bundlers leave it alone and runtimes without it (edge, workers) get
 * undefined instead of a failed import.
 */
export function builtin<T>(name: string): T | undefined {
  try {
    const p = (globalThis as any).process;
    if (p?.getBuiltinModule) {
      const mod = p.getBuiltinModule(name) || p.getBuiltinModule(name.replace(/^node:/, ''));
      if (mod) return mod as T;
    }
    if (typeof (globalThis as any).require === 'function') {
      return (globalThis as any).require(name) as T;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

