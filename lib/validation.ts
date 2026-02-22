/** ユーザー名: 半角英数字と記号（. _ -）のみ、2〜50文字 */
export const USERNAME_REGEX = /^[a-zA-Z0-9._-]{2,50}$/;

export function validateUsername(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "ユーザー名を入力してください";
  if (trimmed.length < 2) return "ユーザー名は2文字以上にしてください";
  if (trimmed.length > 50) return "ユーザー名は50文字以内にしてください";
  if (!USERNAME_REGEX.test(trimmed)) return "半角英数字と記号（. _ -）のみ使用できます";
  return null;
}
