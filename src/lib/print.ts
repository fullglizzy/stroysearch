/**
 * Печать произвольного DOM-узла через скрытый iframe.
 *
 * Вместо CSS-трюков (@media print поверх диалога) документ клонируется в
 * отдельный iframe вместе со стилями приложения и печатается оттуда:
 * обёртки диалога (fixed-попап, max-height, overflow) не участвуют,
 * поэтому печатается ровно сам документ с корректной разбивкой на страницы.
 */
export function printHtmlNode(node: HTMLElement, title: string): void {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    iframe.remove();
    return;
  }
  const contentWindow: Window = win;

  doc.open();
  doc.write("<!DOCTYPE html><html><head><meta charset='utf-8'></head><body></body></html>");
  doc.close();
  doc.title = title;

  // Копируем таблицы стилей страницы, чтобы классы (Tailwind) применились и в iframe
  const styleNodes = new Set<HTMLElement>();
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const owner = sheet.ownerNode;
      if (owner instanceof HTMLElement && !styleNodes.has(owner)) {
        styleNodes.add(owner.cloneNode(true) as HTMLElement);
      }
    } catch {
      // чужие (cross-origin) таблицы пропускаем
    }
  }
  for (const styleNode of styleNodes) doc.head.appendChild(styleNode);

  // Локальные правила печатного документа
  const printStyle = doc.createElement("style");
  printStyle.textContent = `
    body { margin: 0; padding: 16px; background: #fff; color: #000; }
    .invoice-print { border: none !important; border-radius: 0 !important; }
  `;
  doc.head.appendChild(printStyle);

  const root = doc.createElement("div");
  root.appendChild(node.cloneNode(true));
  doc.body.appendChild(root);

  function doPrint() {
    contentWindow.focus();
    contentWindow.print();
    const cleanup = () => {
      iframe.remove();
      contentWindow.removeEventListener("afterprint", cleanup);
    };
    contentWindow.addEventListener("afterprint", cleanup);
    // страховка на случай, если событие afterprint не придёт
    setTimeout(() => {
      if (document.body.contains(iframe)) iframe.remove();
    }, 60_000);
  }

  // Ждём загрузку внешних стилей, шрифтов и декодирование картинок
  const imagesReady = Promise.all(
    Array.from(doc.images).map((img) => img.decode().catch(() => undefined)),
  );
  const fontsReady = doc.fonts?.ready.catch(() => undefined) ?? Promise.resolve();
  const linksReady = Promise.all(
    Array.from(doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).map(
      (link) =>
        new Promise<void>((resolve) => {
          if (link.sheet) return resolve();
          link.addEventListener("load", () => resolve());
          link.addEventListener("error", () => resolve());
        }),
    ),
  );

  void Promise.all([imagesReady, fontsReady, linksReady])
    .then(() => new Promise((resolve) => setTimeout(resolve, 50)))
    .then(doPrint);
}
