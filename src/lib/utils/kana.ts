/**
 * ひらがなをカタカナに変換
 * @param text 変換するテキスト
 * @returns カタカナに変換されたテキスト
 */
export function hiraganaToKatakana(text: string): string {
  return text.replace(/[\u3041-\u3096]/g, (char) => {
    // ひらがな（\u3041-\u3096）をカタカナ（\u30A1-\u30F6）に変換
    return String.fromCharCode(char.charCodeAt(0) + 0x60);
  });
}

/**
 * カタカナをひらがなに変換
 * @param text 変換するテキスト
 * @returns ひらがなに変換されたテキスト
 */
export function katakanaToHiragana(text: string): string {
  return text.replace(/[\u30A1-\u30F6]/g, (char) => {
    // カタカナ（\u30A1-\u30F6）をひらがな（\u3041-\u3096）に変換
    return String.fromCharCode(char.charCodeAt(0) - 0x60);
  });
}

/**
 * 検索クエリを正規化（ひらがなとカタカナの両方で検索できるように）
 * ひらがなをカタカナに変換して返す（データベースにはカタカナで保存されている想定）
 * @param query 検索クエリ
 * @returns 正規化された検索クエリ
 */
export function normalizeSearchQuery(query: string): string {
  // ひらがなをカタカナに変換
  return hiraganaToKatakana(query);
}
