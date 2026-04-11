import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, mkdir } from "node:fs/promises";

import { createPlatformStore } from "../../scripts/platform-store.mjs";

async function createTempStore() {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), "ai-register-browser-environment-")
  );
  await mkdir(path.join(tempRoot, "config"), { recursive: true });
  return {
    tempRoot,
    store: createPlatformStore(tempRoot)
  };
}

test("store bootstrap seeds a default browser environment and plan binding", async () => {
  const { store } = await createTempStore();
  const state = await store.readState();

  assert.equal(state.browserEnvironmentConfigs.length, 1);
  assert.ok(state.selectedBrowserEnvironmentConfigId);
  assert.equal(
    state.plans[0]?.browserEnvironmentConfigId,
    state.selectedBrowserEnvironmentConfigId
  );
  assert.equal(state.browserEnvironmentConfigs[0]?.approvalStatus, "approved");
});

test("legacy browser environment import rejects banned fields", async () => {
  const { store } = await createTempStore();

  await assert.rejects(
    () =>
      store.importLegacyBrowserEnvironmentConfig({
        sourceLabel: "legacy-invalid.json",
        payload: {
          name: "legacy-invalid",
          version: "131.0.0.0",
          userAgent: "Mozilla/5.0",
          locale: "en-US",
          timezone: "America/Los_Angeles",
          viewport: { width: 1440, height: 900 },
          screen: { width: 1440, height: 900 },
          canvas: { noiseEnabled: true }
        }
      }),
    /禁止字段/
  );
});

test("browser environment referenced by a plan cannot be deleted", async () => {
  const { store } = await createTempStore();
  const state = await store.readState();
  const browserEnvironmentConfigId = state.selectedBrowserEnvironmentConfigId;

  await assert.rejects(
    () => store.deleteBrowserEnvironmentConfig(browserEnvironmentConfigId),
    /仍被 .*方案引用/
  );
});
