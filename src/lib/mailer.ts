// Почта через self-hosted Postal (https://github.com/postalserver/postal).
// Включается парой env-переменных: POSTAL_API_URL (адрес установки, например
// https://postal.example.com) и POSTAL_API_KEY (ключ сервера из веб-интерфейса
// Postal, страница Credentials). Без любой из них сервис полностью отключён:
// sendMail/sendMailBatch мгновенно возвращаются, не ломая основную операцию.

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Платформа";
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
// Отправитель: поддерживает «Имя <адрес>» или просто адрес.
// Домен отправителя должен быть подтверждён в Postal (Mail Servers → Domains),
// иначе API вернёт ошибку UnauthenticatedFromAddress.
const POSTAL_FROM = process.env.POSTAL_FROM || `${APP_NAME} <noreply@localhost>`;
const REQUEST_TIMEOUT_MS = 15_000;
// Postal не имеет батч-эндпоинта, поэтому массовая отправка идёт параллельными
// запросами с ограничением конкурентности — Postal сам кладёт письма в очередь
const BATCH_CONCURRENCY = 8;

export interface EmailItem {
  to: string;
  subject: string;
  html: string;
}

/** Настройки Postal или null, если почтовый сервис отключён (нет env-переменных) */
function postalConfig(): { url: string; key: string } | null {
  const url = (process.env.POSTAL_API_URL || "").replace(/\/+$/, "");
  const key = process.env.POSTAL_API_KEY || "";
  return url && key ? { url, key } : null;
}

/** Включена ли отправка писем (задают POSTAL_API_URL и POSTAL_API_KEY в .env) */
export function mailEnabled(): boolean {
  return !!postalConfig();
}

/** Экранирование пользовательского текста для HTML-письма */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function money(value: number): string {
  return `${value.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ₽`;
}

function dateRu(value: Date): string {
  return value.toLocaleDateString("ru-RU");
}

/** Общая вёрстка письма: шапка, карточка с контентом, подпись */
function layout(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="ru">
<body style="margin:0;padding:0;background:#f2f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr>
          <td style="padding:0 8px 16px;font-size:18px;font-weight:bold;color:#00A896;">
            ${esc(APP_NAME)}
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;border-radius:12px;padding:28px 28px 24px;color:#1f2937;font-size:15px;line-height:1.55;">
            <h1 style="margin:0 0 16px;font-size:19px;line-height:1.35;color:#111827;">${esc(title)}</h1>
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 8px;font-size:12px;color:#6b7280;line-height:1.5;">
            Это автоматическое письмо платформы ${esc(APP_NAME)}. Если вы не регистрировались
            и не пользуетесь сервисом — просто игнорируйте его.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 12px;">${text}</p>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:20px 0 4px;"><a href="${APP_URL}${esc(href)}" style="display:inline-block;background:#00A896;color:#ffffff;text-decoration:none;border-radius:8px;padding:10px 20px;font-size:14px;font-weight:bold;">${esc(label)}</a></p>
<p style="margin:8px 0 0;font-size:12px;color:#6b7280;">${esc(APP_URL + href)}</p>`;
}

/**
 * Отправка одного письма через HTTP API Postal. Никогда не бросает
 * исключение — почта не должна ломать основную операцию (как notifyUser).
 */
export async function sendMail(item: EmailItem): Promise<boolean> {
  const cfg = postalConfig();
  if (!cfg || !item.to) return false;
  try {
    const res = await fetch(`${cfg.url}/api/v1/send/message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Server-API-Key": cfg.key,
      },
      body: JSON.stringify({
        to: [item.to],
        from: POSTAL_FROM,
        subject: item.subject,
        html_body: item.html,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const json = (await res.json()) as { status?: string; data?: unknown };
    if (json.status !== "success") {
      console.error(`[mailer] Postal отклонил письмо (${item.to}):`, JSON.stringify(json.data ?? json));
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[mailer] не удалось отправить письмо (${item.to}):`, e);
    return false;
  }
}

/**
 * Пакетная отправка (массовое выставление счетов): параллельные запросы
 * с ограничением конкурентности. Ошибки отдельных писем не прерывают
 * остальные — sendMail никогда не бросает исключений.
 */
export async function sendMailBatch(items: EmailItem[]): Promise<void> {
  if (items.length === 0) return;
  let next = 0;
  const workers = Array.from(
    { length: Math.min(BATCH_CONCURRENCY, items.length) },
    async () => {
      while (next < items.length) {
        await sendMail(items[next++]);
      }
    },
  );
  await Promise.all(workers);
}

// --- Шаблоны писем -------------------------------------------------------

/** Успешная регистрация (участник или компания) */
export function buildRegistrationEmail(
  to: string,
  opts: { username: string; company: boolean },
): EmailItem {
  const title = opts.company
    ? `Компания зарегистрирована на ${APP_NAME}`
    : `Добро пожаловать в ${APP_NAME}!`;
  const body =
    paragraph(
      opts.company
        ? `Аккаунт компании успешно создан. Логин: <b>${esc(opts.username)}</b>. Карточка компании уже доступна в базе поставщиков.`
        : `Вы успешно зарегистрировались. Логин: <b>${esc(opts.username)}</b>.`,
    ) +
    paragraph(
      "Через личный кабинет доступны все возможности платформы: база поставщиков, матрица цен, заявки и поддержка.",
    ) +
    button(opts.company ? "/company" : "/account", "Перейти в личный кабинет");
  return { to, subject: title, html: layout(title, body) };
}

/** Ответ службы поддержки на обращение */
export function buildSupportReplyEmail(
  to: string,
  opts: { message: string; ticketId: string; cabinetBase: string },
): EmailItem {
  const title = "Ответ службы поддержки";
  const body =
    paragraph("Служба поддержки ответила на ваше обращение:") +
    `<blockquote style="margin:0 0 12px;padding:10px 14px;background:#f6f8f8;border-left:3px solid #00A896;border-radius:6px;white-space:pre-wrap;">${esc(opts.message)}</blockquote>` +
    paragraph("Ответить и посмотреть историю переписки можно в личном кабинете.") +
    button(`${opts.cabinetBase}/support?ticket=${encodeURIComponent(opts.ticketId)}`, "Открыть обращение");
  return { to, subject: title, html: layout(title, body) };
}

/** Выставление счёта за услуги платформы */
export function buildInvoiceEmail(
  to: string,
  opts: {
    companyName?: string | null;
    number: string;
    total: number;
    periodLabel?: string | null;
    dueDate?: Date | null;
    note?: string;
  },
): EmailItem {
  const title = `Счёт ${opts.number} на ${money(opts.total)}`;
  const rows: string[] = [];
  if (opts.note) rows.push(paragraph(esc(opts.note)));
  rows.push(
    paragraph(
      `Для компании <b>${esc(opts.companyName || "—")}</b> выставлен счёт <b>${esc(opts.number)}</b> на сумму <b>${money(opts.total)}</b>.`,
    ),
  );
  if (opts.periodLabel) rows.push(paragraph(`Период: ${esc(opts.periodLabel)}.`));
  if (opts.dueDate) rows.push(paragraph(`Срок оплаты — <b>${esc(dateRu(opts.dueDate))}</b>.`));
  rows.push(paragraph("Оплатить счёт и скачать документы можно в разделе «Финансы» личного кабинета."));
  rows.push(button("/company/finances", "Открыть счёт"));
  return { to, subject: `Счёт ${opts.number} — ${APP_NAME}`, html: layout(title, rows.join("")) };
}

/** Скрытие контактов компании в базе (санкция за неуплату) */
export function buildContactsHiddenEmail(
  to: string,
  opts: { companyName: string; reason: string | null },
): EmailItem {
  const title = "Контакты компании скрыты в базе";
  const body =
    paragraph(
      `Контакты компании <b>${esc(opts.companyName)}</b> скрыты в базе поставщиков: компания не видна потенциальным клиентам.`,
    ) +
    paragraph(`Причина: ${esc(opts.reason || "не указана")}.`) +
    paragraph(
      "Оплатите задолженность — после этого администратор вернёт контакты в базу.",
    ) +
    button("/company/finances", "Оплатить задолженность");
  return { to, subject: `${title} — ${APP_NAME}`, html: layout(title, body) };
}

/** Блокировка аккаунта */
export function buildBanEmail(
  to: string,
  opts: { username: string; reason: string },
): EmailItem {
  const title = "Ваш аккаунт заблокирован";
  const body =
    paragraph(`Аккаунт <b>${esc(opts.username)}</b> заблокирован администрацией платформы.`) +
    paragraph(`Причина: ${esc(opts.reason)}.`) +
    paragraph("Если вы считаете блокировку ошибочной, свяжитесь с поддержкой платформы.");
  return { to, subject: `${title} — ${APP_NAME}`, html: layout(title, body) };
}
