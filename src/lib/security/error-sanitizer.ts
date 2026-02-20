/**
 * エラーメッセージサニタイザー
 * エラーメッセージから個人情報を除去
 */

/**
 * 個人情報のパターン（簡易的な検出）
 */
const PII_PATTERNS = [
  // 電話番号パターン（日本の電話番号形式）
  /\d{2,4}-?\d{2,4}-?\d{3,4}/g,
  // メールアドレスパターン
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  // 郵便番号パターン（日本の郵便番号形式）
  /\d{3}-?\d{4}/g,
  // 保険証番号パターン（数字とハイフン）
  /\d{4,}-?\d{2,}-?\d{2,}/g,
];

/**
 * 患者名の可能性がある文字列パターン（日本語名）
 * 注意: これは簡易的な検出であり、完全ではありません
 */
const NAME_PATTERNS = [
  // 日本語の名前パターン（ひらがな、カタカナ、漢字）
  /[あ-んア-ン一-龯]{2,}/g,
];

/**
 * エラーメッセージから個人情報をマスク
 * @param message エラーメッセージ
 * @returns サニタイズされたエラーメッセージ
 */
export function sanitizeErrorMessage(message: string): string {
  if (!message || typeof message !== "string") {
    return message || "エラーが発生しました";
  }

  let sanitized = message;

  // 電話番号をマスク
  sanitized = sanitized.replace(PII_PATTERNS[0], "[電話番号]");

  // メールアドレスをマスク
  sanitized = sanitized.replace(PII_PATTERNS[1], "[メールアドレス]");

  // 郵便番号をマスク
  sanitized = sanitized.replace(PII_PATTERNS[2], "[郵便番号]");

  // 保険証番号をマスク
  sanitized = sanitized.replace(PII_PATTERNS[3], "[保険証番号]");

  // 患者名の可能性がある文字列をマスク（簡易的）
  // 注意: これは誤検知の可能性があるため、慎重に使用
  // 実際の実装では、より高度な検出ロジックが必要
  // sanitized = sanitized.replace(NAME_PATTERNS[0], '[患者名]');

  return sanitized;
}

/**
 * エラーオブジェクトから安全なエラーメッセージを取得
 * @param error エラーオブジェクト
 * @returns サニタイズされたエラーメッセージ
 */
export function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return sanitizeErrorMessage(error.message);
  }
  if (typeof error === "string") {
    return sanitizeErrorMessage(error);
  }
  return "エラーが発生しました";
}

/**
 * エラーメッセージに個人情報が含まれている可能性があるかチェック
 * @param message エラーメッセージ
 * @returns 個人情報が含まれている可能性がある場合はtrue
 */
export function mayContainPII(message: string): boolean {
  if (!message || typeof message !== "string") {
    return false;
  }

  // パターンマッチングで個人情報の可能性をチェック
  for (const pattern of PII_PATTERNS) {
    if (pattern.test(message)) {
      return true;
    }
  }

  return false;
}
