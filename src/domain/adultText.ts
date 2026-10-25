// Free text describes adults only; UI text is always rendered as plain text.
export function isAdultText(value: string): boolean {
  if (
    /未成年|未满\s*(?:18|十八)|小学生|中学生|初中生|高中生|幼儿|儿童|幼女|萝莉|正太|初[一二三]学生|高[一二三]学生/u.test(
      value,
    )
  )
    return false;
  for (const match of value.matchAll(
    /(\d{1,3})\s*(?:岁|周岁|years?\s*old|yo\b)/giu,
  )) {
    if (Number(match[1]) < 18) return false;
  }
  const digits: Record<string, number> = {
    零: 0,
    〇: 0,
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  };
  for (const match of value.matchAll(
    /([零〇一二三四五六七八九十两]{1,3})\s*岁/gu,
  )) {
    const numeral = match[1]!;
    const parts = numeral.split('十');
    const age =
      parts.length === 2
        ? (digits[parts[0]!] ?? 1) * 10 + (digits[parts[1]!] ?? 0)
        : digits[numeral];
    if (age !== undefined && age < 18) return false;
  }
  return true;
}
