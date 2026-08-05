/**
 * Валидация ИНН (контрольная сумма)
 * Поддерживает 10-значные (юрлица) и 12-значные (ИП/физлица) ИНН
 */
export function validateInn(inn: string): boolean {
  // Проверка на длину
  if (!/^\d{10}$|^\d{12}$/.test(inn)) {
    return false;
  }

  const digits = inn.split("").map(Number);

  if (inn.length === 10) {
    // 10-значный ИНН (юрлицо)
    // Контрольное число = последняя цифра
    const coefficients = [2, 4, 10, 3, 5, 9, 4, 6, 8];
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += digits[i] * coefficients[i];
    }
    const remainder = sum % 11;
    const checkDigit = remainder > 9 ? remainder % 10 : remainder;
    return checkDigit === digits[9];
  } else {
    // 12-значный ИНН (ИП/физлицо)
    // Две контрольные цифры: 11-я и 12-я
    const coeff1 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
    const coeff2 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8];

    let sum1 = 0;
    for (let i = 0; i < 10; i++) {
      sum1 += digits[i] * coeff1[i];
    }
    const rem1 = sum1 % 11;
    const check1 = rem1 > 9 ? rem1 % 10 : rem1;
    if (check1 !== digits[10]) return false;

    let sum2 = 0;
    for (let i = 0; i < 11; i++) {
      sum2 += digits[i] * coeff2[i];
    }
    const rem2 = sum2 % 11;
    const check2 = rem2 > 9 ? rem2 % 10 : rem2;
    return check2 === digits[11];
  }
}

/**
 * Форматирование ИНН для отображения
 */
export function formatInn(inn: string): string {
  if (inn.length === 10) {
    return `${inn.slice(0, 4)} ${inn.slice(4, 7)} ${inn.slice(7)}`;
  }
  if (inn.length === 12) {
    return `${inn.slice(0, 4)} ${inn.slice(4, 8)} ${inn.slice(8, 10)} ${inn.slice(10)}`;
  }
  return inn;
}

/**
 * Сообщение об ошибке ИНН
 */
export function getInnErrorMessage(inn: string): string | null {
  if (!inn) return null;
  if (!/^\d+$/.test(inn)) return "ИНН должен содержать только цифры";
  if (![10, 12].includes(inn.length)) return "ИНН должен состоять из 10 или 12 цифр";
  if (!validateInn(inn)) return "Неверный ИНН — проверьте контрольную сумму";
  return null;
}
