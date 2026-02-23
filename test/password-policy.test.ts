import test from "node:test";
import assert from "node:assert/strict";
import {
  getPasswordPolicyErrors,
  isPasswordPolicyCompliant,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "../src/lib/security/password-policy";

test("password policy accepts strong password", () => {
  const password = "StrongerPass123";
  assert.equal(isPasswordPolicyCompliant(password), true);
  assert.deepEqual(getPasswordPolicyErrors(password), []);
});

test("password policy rejects missing requirements", () => {
  const errors = getPasswordPolicyErrors("short");
  assert.equal(
    errors.includes(`パスワードは${PASSWORD_MIN_LENGTH}文字以上にしてください`),
    true,
  );
  assert.equal(
    errors.includes("パスワードに英大文字を1文字以上含めてください"),
    true,
  );
  assert.equal(
    errors.includes("パスワードに数字を1文字以上含めてください"),
    true,
  );
});

test("password policy rejects over max length", () => {
  const tooLong = `Aa1${"x".repeat(PASSWORD_MAX_LENGTH)}`;
  const errors = getPasswordPolicyErrors(tooLong);
  assert.equal(
    errors.includes(`パスワードは${PASSWORD_MAX_LENGTH}文字以内にしてください`),
    true,
  );
});
