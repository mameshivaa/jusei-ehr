import test from "node:test";
import assert from "node:assert/strict";
import { validateCronBearerAuth } from "../src/lib/cron/auth";

test("validateCronBearerAuth fails when CRON_SECRET is missing", () => {
  const result = validateCronBearerAuth("Bearer any", "");
  assert.equal(result.ok, false);
  assert.equal(result.status, 503);
});

test("validateCronBearerAuth fails on invalid token", () => {
  const result = validateCronBearerAuth("Bearer invalid", "expected-token");
  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
});

test("validateCronBearerAuth accepts bearer token", () => {
  const result = validateCronBearerAuth(
    "Authorization is ignored, only Bearer expected-token",
    "expected-token",
  );
  assert.equal(result.ok, false);

  const valid = validateCronBearerAuth(
    "Bearer expected-token",
    "expected-token",
  );
  assert.equal(valid.ok, true);
});

test("validateCronBearerAuth accepts case-insensitive prefix and trim", () => {
  const result = validateCronBearerAuth(
    "bearer    expected-token   ",
    "expected-token",
  );
  assert.equal(result.ok, true);
});
