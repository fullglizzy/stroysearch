/** Строка поиска компании: имя + ИНН в нижнем регистре.
 * SQLite LIKE чувствителен к регистру для кириллицы, поэтому строку
 * поиска приводим к нижнему регистру на стороне JS при записи,
 * а запросы приходят уже в нижнем регистре. */
export function companySearchText(name: string, inn: string): string {
  return `${name} ${inn}`.toLowerCase();
}

/** Строка поиска товара: название в нижнем регистре (см. companySearchText). */
export function productSearchText(name: string): string {
  return name.toLowerCase();
}
