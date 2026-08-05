/**
 * Утилиты для работы с рейтингом (0-100 шкала)
 *
 * ТЗ §6.12: Средневзвешенная оценка отзыва = (x1+...+x9)/9  (1-5 шкала)
 * ТЗ §6.13: Рейтинг = среднее по всем отзывам × 20 → 0-100 шкала
 */

interface ReviewWithAverage {
  weightedAverage: number;
}

/**
 * Вычисляет рейтинг компании/участника (0-100) из массива отзывов
 */
export function computeRating(reviews: ReviewWithAverage[]): number | null {
  if (!reviews || reviews.length === 0) return null;
  const avg = reviews.reduce((sum, r) => sum + r.weightedAverage, 0) / reviews.length;
  return Math.round(avg * 20);
}

/**
 * Форматирует рейтинг для отображения (например, "4.3")
 */
export function formatRating(rating: number): string {
  return (rating / 20).toFixed(1);
}

/**
 * Конвертирует 0-100 рейтинг в количество звёзд (0-5)
 */
export function ratingToStars(rating: number): number {
  return Math.round(rating / 20);
}

/**
 * Возвращает цвет для рейтинга
 */
export function ratingColor(rating: number): string {
  if (rating >= 80) return "text-green-600";
  if (rating >= 60) return "text-menthol";
  if (rating >= 40) return "text-orange-accent";
  return "text-destructive";
}
