import test from "node:test";
import assert from "node:assert/strict";
import { isDevBypassAuthEnabled } from "../src/lib/security/dev-bypass";

test("isDevBypassAuthEnabled returns false when not requested", () => {
  assert.equal(isDevBypassAuthEnabled({ NODE_ENV: "development" }), false);
  assert.equal(
    isDevBypassAuthEnabled({ DEV_BYPASS_AUTH: "false", NODE_ENV: "test" }),
    false,
  );
});

test("isDevBypassAuthEnabled returns true in non-production when requested", () => {
  assert.equal(
    isDevBypassAuthEnabled({
      DEV_BYPASS_AUTH: "true",
      NODE_ENV: "development",
    }),
    true,
  );
  assert.equal(
    isDevBypassAuthEnabled({ DEV_BYPASS_AUTH: "true", NODE_ENV: "test" }),
    true,
  );
});

test("isDevBypassAuthEnabled throws in production", () => {
  assert.throws(
    () =>
      isDevBypassAuthEnabled({
        DEV_BYPASS_AUTH: "true",
        NODE_ENV: "production",
      }),
    /forbidden in production/i,
  );
});

test("isDevBypassAuthEnabled defaults NODE_ENV to production", () => {
  const env = { DEV_BYPASS_AUTH: "true" } as unknown as NodeJS.ProcessEnv;
  assert.throws(() => isDevBypassAuthEnabled(env), /forbidden in production/i);
});
