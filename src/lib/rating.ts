/**
 * Утилиты для работы с рейтингом (0-5 шкала)
 *
 * ТЗ §6.12: Средневзвешенная оценка отзыва = (x1+...+x9)/9  (1-5 шкала)
 * Рейтинг компании/участника = среднее по всем отзывам (0-5 шкала)
 */

interface ReviewWithAverage {
  weightedAverage: number;
}

/**
 * Вычисляет рейтинг компании/участника (0-5) из массива отзывов
 */
export function computeRating(reviews: ReviewWithAverage[]): number | null {
  if (!reviews || reviews.length === 0) return null;
  const avg = reviews.reduce((sum, r) => sum + r.weightedAverage, 0) / reviews.length;
  return Math.round(avg * 10) / 10; // одна цифра после запятой
}

/**
 * Форматирует рейтинг для отображения (например, "4.3")
 */
export function formatRating(rating: number): string {
  return rating.toFixed(1);
}

/**
 * Конвертирует 0-5 рейтинг в количество звёзд (0-5)
 */
export function ratingToStars(rating: number): number {
  return Math.round(rating);
}

/**
 * Возвращает цвет для рейтинга (0-5 шкала)
 */
export function ratingColor(rating: number): string {
  if (rating >= 4) return "text-green-600";
  if (rating >= 3) return "text-menthol";
  if (rating >= 2) return "text-orange-accent";
  return "text-destructive";
}
