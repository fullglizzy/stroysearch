// fileUrl документов библиотеки хранится как есть: относительный путь (/uploads/x.pdf)
// либо абсолютный URL (внешний ресурс или ссылка, занесённая с localhost).
// Абсолютные ссылки на «самого себя» (localhost / 127.0.0.1) превращаем в относительные:
// в проде за reverse-proxy они иначе уводят пользователя на localhost, а относительная
// ссылка браузер резолвит от текущего origin и работает в любом окружении.
export function docHref(fileUrl: string): string {
  if (/^https?:\/\//i.test(fileUrl)) {
    try {
      const url = new URL(fileUrl);
      if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
        return url.pathname + url.search + url.hash;
      }
    } catch {
      // повреждённый URL — отдаём как есть
    }
  }
  return fileUrl;
}
