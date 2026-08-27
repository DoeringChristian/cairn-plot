export interface ReadonlySignal<T> {
  get(): T;
  subscribe(listener: (value: T) => void): () => void;
}

export interface MutableSignal<T> extends ReadonlySignal<T> {
  set(value: T): void;
}

export function createSignal<T>(initial: T): MutableSignal<T> {
  let value = initial;
  const listeners = new Set<(value: T) => void>();
  return {
    get: () => value,
    set(next) {
      if (Object.is(value, next)) return;
      value = next;
      for (const listener of [...listeners]) listener(value);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
