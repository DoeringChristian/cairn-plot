/** Optional subsystem hooks invoked after an atomically-applied runtime policy. */
const hooks = new Set<() => void>();

export function registerRuntimePolicyHook(hook: () => void): () => void {
  hooks.add(hook);
  return () => hooks.delete(hook);
}

export function applyRuntimePolicyHooks(): void {
  for (const hook of hooks) hook();
}
