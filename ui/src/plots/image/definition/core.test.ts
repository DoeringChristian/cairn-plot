import assert from "node:assert/strict";
import test from "node:test";

import { defineImageBackendCapabilities } from "../backend.ts";
import { DISPLAY_OPERATION_IDS } from "./display-operations.ts";
import { IMAGE_OPERATION_IDS } from "./image-operations.ts";
import {
  CORE_DISPLAY_OPERATION_IDS,
  CORE_IMAGE_OPERATION_IDS,
  FALLBACK_COMPARISON_OPERATION,
  fallbackDisplayOperation,
  projectComparisonOperation,
  projectDisplayOperation,
} from "./core.ts";

const full = defineImageBackendCapabilities({
  imageOperations: IMAGE_OPERATION_IDS,
  displayOperations: DISPLAY_OPERATION_IDS,
});
// A backend that lacks plasma, aces, normal and flip-hdr but has the core.
const partial = defineImageBackendCapabilities({
  imageOperations: IMAGE_OPERATION_IDS.filter((id) => id !== "flip-hdr"),
  displayOperations: DISPLAY_OPERATION_IDS.filter((id) => !["plasma", "aces", "normal"].includes(id)),
});

test("core ids are catalogue entries and the fallbacks are core", () => {
  for (const id of CORE_IMAGE_OPERATION_IDS) assert.ok(IMAGE_OPERATION_IDS.includes(id), id);
  for (const id of CORE_DISPLAY_OPERATION_IDS) assert.ok(DISPLAY_OPERATION_IDS.includes(id), id);
  assert.ok((CORE_IMAGE_OPERATION_IDS as readonly string[]).includes(FALLBACK_COMPARISON_OPERATION));
  assert.ok((CORE_DISPLAY_OPERATION_IDS as readonly string[]).includes(fallbackDisplayOperation("plasma")));
  assert.ok((CORE_DISPLAY_OPERATION_IDS as readonly string[]).includes(fallbackDisplayOperation("aces")));
});

test("display fallback follows the requested category", () => {
  assert.equal(fallbackDisplayOperation("plasma"), "turbo");
  assert.equal(fallbackDisplayOperation("magma"), "turbo");
  assert.equal(fallbackDisplayOperation("aces"), "srgb");
  assert.equal(fallbackDisplayOperation("normal"), "srgb");
  assert.equal(fallbackDisplayOperation("not-a-display-op"), "srgb");
});

test("projection is the identity when the backend supports the id", () => {
  assert.deepEqual(projectDisplayOperation("plasma", full), { effective: "plasma", fallback: null });
  assert.deepEqual(projectDisplayOperation("aces", partial), {
    effective: "srgb",
    fallback: { kind: "display", requested: "aces", effective: "srgb" },
  });
  assert.deepEqual(projectDisplayOperation("plasma", partial), {
    effective: "turbo",
    fallback: { kind: "display", requested: "plasma", effective: "turbo" },
  });
  assert.deepEqual(projectDisplayOperation("turbo", partial), { effective: "turbo", fallback: null });
});

test("unsupported comparison operations project to split", () => {
  assert.deepEqual(projectComparisonOperation("flip-hdr", full), { effective: "flip-hdr", fallback: null });
  assert.deepEqual(projectComparisonOperation("flip-hdr", partial), {
    effective: "split",
    fallback: { kind: "comparison", requested: "flip-hdr", effective: "split" },
  });
  assert.deepEqual(projectComparisonOperation("split", partial), { effective: "split", fallback: null });
});
