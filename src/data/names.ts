/** Letters that don't decompose into base letter + accent. */
const SPECIAL: Record<string, string> = {
  ø: 'o', Ø: 'O', ł: 'l', Ł: 'L', ß: 'ss', æ: 'ae', Æ: 'Ae', œ: 'oe', Œ: 'Oe',
  đ: 'd', Đ: 'D', ð: 'd', Ð: 'D', þ: 'th', Þ: 'Th', ı: 'i', ħ: 'h', Ħ: 'H',
};

/** "Ødegaard" → "Odegaard", "Gyökeres" → "Gyokeres": plain Latin letters only. */
export function plainName(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[øØłŁßæÆœŒđĐðÐþÞıħĦ]/g, (c) => SPECIAL[c] ?? c);
}

/** Lower-cased, accent-free text for searching. */
export function searchKey(s: string): string {
  return plainName(s).toLowerCase().replace(/[^a-z0-9 ]/g, '');
}
