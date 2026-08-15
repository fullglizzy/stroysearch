/**
 * Скачивание DOM-узла как PDF.
 *
 * Узел рендерится в canvas (modern-screenshot рендерит браузером через SVG
 * foreignObject, поэтому поддерживает все современные CSS-цвета и шрифты),
 * затем нарезается на страницы A4 и собирается в PDF (jspdf). Библиотеки
 * подгружаются динамически — в основной бандл они не попадают.
 */
export async function downloadHtmlNodeAsPdf(node: HTMLElement, filename: string): Promise<void> {
  const [{ domToCanvas }, { jsPDF }] = await Promise.all([
    import("modern-screenshot"),
    import("jspdf"),
  ]);

  const canvas = await domToCanvas(node, {
    scale: 2,
    backgroundColor: "#ffffff",
  });

  const pageWidthMm = 210; // A4
  const pageHeightMm = 297;
  // Сколько пикселей исходного canvas умещается на одну страницу A4
  const pageHeightPx = Math.floor((pageHeightMm * canvas.width) / pageWidthMm);

  const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4", compress: true });
  const totalPages = Math.max(1, Math.ceil(canvas.height / pageHeightPx));

  for (let page = 0; page < totalPages; page++) {
    if (page > 0) pdf.addPage();

    const y = page * pageHeightPx;
    const chunkHeight = Math.min(pageHeightPx, canvas.height - y);

    const chunk = document.createElement("canvas");
    chunk.width = canvas.width;
    chunk.height = chunkHeight;
    const ctx = chunk.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, chunk.width, chunk.height);
      ctx.drawImage(canvas, 0, y, canvas.width, chunkHeight, 0, 0, canvas.width, chunkHeight);
    }

    const chunkHeightMm = (chunkHeight * pageWidthMm) / canvas.width;
    pdf.addImage(chunk.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, pageWidthMm, chunkHeightMm);
  }

  pdf.save(filename);
}
