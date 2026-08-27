import type { JsonValue } from "./json.ts";
import type { PaneSpec, SettingsPatch } from "./spec.ts";

export type Invalidation = "none" | "presentation" | "content" | "layout" | "remount";

export interface SettingDefinition {
  key: string;
  kinds: readonly string[] | "*";
  default?: JsonValue;
  invalidates: Invalidation;
  link: "always" | "opt-in" | "never";
  validate(value: JsonValue): boolean;
}

export interface SettingsRegistry {
  get(key: string): SettingDefinition | undefined;
  defaults(kind: string): SettingsPatch;
  validate(patch: SettingsPatch): void;
  invalidation(keys: Iterable<string>): Invalidation;
}

const LEVEL: Record<Invalidation, number> = {
  none: 0,
  presentation: 1,
  content: 2,
  layout: 3,
  remount: 4,
};

export function createSettingsRegistry(
  definitions: readonly SettingDefinition[],
): SettingsRegistry {
  const table = new Map(definitions.map((definition) => [definition.key, definition]));
  return {
    get: (key) => table.get(key),
    defaults(kind) {
      const out: SettingsPatch = {};
      for (const definition of definitions) {
        if (
          definition.default !== undefined &&
          (definition.kinds === "*" || definition.kinds.includes(kind))
        ) out[definition.key] = definition.default;
      }
      return out;
    },
    validate(patch) {
      for (const [key, value] of Object.entries(patch)) {
        const definition = table.get(key);
        if (definition && !definition.validate(value)) {
          throw new TypeError(`invalid value for setting ${key}`);
        }
      }
    },
    invalidation(keys) {
      let result: Invalidation = "none";
      for (const key of keys) {
        const candidate = table.get(key)?.invalidates ?? "content";
        if (LEVEL[candidate] > LEVEL[result]) result = candidate;
      }
      return result;
    },
  };
}

export function resolveSettings(
  registry: SettingsRegistry,
  pane: PaneSpec,
  override?: SettingsPatch,
): SettingsPatch {
  return { ...registry.defaults(pane.kind), ...pane.settings, ...override };
}

const finite = (value: JsonValue) => typeof value === "number" && Number.isFinite(value);
const anyJson = (_value: JsonValue) => true;

/** Initial table; generation can replace these declarations without changing consumers. */
export const defaultSettingsRegistry = createSettingsRegistry([
  { key: "image.encoding", kinds: ["image", "compare"], invalidates: "content", link: "opt-in", validate: anyJson },
  { key: "image.exposureEV", kinds: ["image", "compare"], default: 0, invalidates: "presentation", link: "opt-in", validate: finite },
  { key: "image.offset", kinds: ["image", "compare"], default: 0, invalidates: "presentation", link: "opt-in", validate: finite },
  { key: "image.view", kinds: ["image", "compare"], invalidates: "presentation", link: "opt-in", validate: anyJson },
  { key: "compare.operation", kinds: ["compare"], default: "split", invalidates: "content", link: "opt-in", validate: anyJson },
  { key: "compare.split", kinds: ["compare"], default: 0.5, invalidates: "presentation", link: "opt-in", validate: finite },
  { key: "panel.info", kinds: "*", invalidates: "layout", link: "never", validate: anyJson },
]);
