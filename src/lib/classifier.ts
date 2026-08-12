export interface ClassifierOption {
  value: string;
  label: string;
}

const PATH_RE = /^[\d.\s]+$/;

/**
 * Точный поиск по классификатору (label вида «4.1.2 — Название»):
 * - запрос-путь («4.1.2») матчит только сам узел и его потомков (4.1.2.x),
 *   а не любые подстроки вроде «14.1.2»;
 * - текстовый запрос ищет подстроку в названии узла.
 */
export function matchClassifier(opt: ClassifierOption, search: string): boolean {
  const s = search.trim().toLowerCase();
  if (!s) return true;

  const sepIdx = opt.label.indexOf("—");
  const path = (sepIdx >= 0 ? opt.label.slice(0, sepIdx) : opt.label).trim().toLowerCase();
  const name = (sepIdx >= 0 ? opt.label.slice(sepIdx + 1) : "").trim().toLowerCase();

  if (PATH_RE.test(s)) {
    const q = s.replace(/\s+/g, "");
    if (!q) return false;
    // точное совпадение пути или дочерние категории
    return path === q || path.startsWith(`${q}.`);
  }

  return name.includes(s) || (!name && path.includes(s));
}
