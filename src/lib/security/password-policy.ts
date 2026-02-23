export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export const PASSWORD_POLICY_HINT =
  "パスワードは12文字以上で、英大文字・英小文字・数字をそれぞれ1文字以上含めてください。";

export function getPasswordPolicyErrors(password: string): string[] {
  const value = password ?? "";
  const errors: string[] = [];

  if (value.length < PASSWORD_MIN_LENGTH) {
    errors.push(`パスワードは${PASSWORD_MIN_LENGTH}文字以上にしてください`);
  }
  if (value.length > PASSWORD_MAX_LENGTH) {
    errors.push(`パスワードは${PASSWORD_MAX_LENGTH}文字以内にしてください`);
  }
  if (!/[A-Z]/.test(value)) {
    errors.push("パスワードに英大文字を1文字以上含めてください");
  }
  if (!/[a-z]/.test(value)) {
    errors.push("パスワードに英小文字を1文字以上含めてください");
  }
  if (!/[0-9]/.test(value)) {
    errors.push("パスワードに数字を1文字以上含めてください");
  }

  return errors;
}

export function isPasswordPolicyCompliant(password: string): boolean {
  return getPasswordPolicyErrors(password).length === 0;
}
