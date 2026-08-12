export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { formatFileSize } from "@/lib/utils";

export default async function TermsPage() {
  const [content, doc] = await Promise.all([
    prisma.pageContent.findUnique({ where: { pageKey: "terms" } }),
    prisma.legalDocument.findUnique({ where: { key: "terms" } }),
  ]);

  const defaultContent = `
    <h2>Пользовательское соглашение</h2>
    <p>Настоящее Пользовательское соглашение является публичной офертой и определяет условия
    использования веб-сайта «Единый независимый центр продуктовых решений, закупок и технических
    заданий строительной отрасли».</p>
    <h3>1. Общие положения</h3>
    <p>1.1. Сайт представляет собой платформу для поиска и установления деловых контактов.</p>
    <p>1.2. Администрация Сайта предоставляет Пользователю возможность использования Сайта
    без взимания оплаты на условиях настоящих УИС.</p>
    <p>1.3. Регистрация Пользователя означает полное и безоговорочное принятие УИС.</p>
    <h3>2. Права и обязанности</h3>
    <p>Пользователь обязуется соблюдать законодательство РФ, настоящие УИС, не нарушать
    права третьих лиц при использовании Сайта.</p>
    <h3>3. Ответственность</h3>
    <p>Администрация Сайта не несет ответственности за содержание Профиля Пользователя,
    оставляемые отзывы, размещаемые информационные данные.</p>
  `;

  return (
    <div className="container-page py-8 max-w-3xl">
      <h1 className="text-3xl font-bold mb-6">Пользовательское соглашение</h1>
      {doc ? (
        <div className="space-y-3">
          <iframe
            src={doc.fileUrl}
            title="Пользовательское соглашение"
            className="w-full h-[80vh] border rounded-lg bg-white"
          />
          <div className="flex items-center gap-4 text-sm">
            <a href={doc.fileUrl} download={doc.fileName} className="text-menthol hover:underline">
              Скачать PDF
            </a>
            <span className="text-xs text-muted-foreground">
              {doc.fileName} · {formatFileSize(doc.fileSize)}
            </span>
          </div>
        </div>
      ) : (
        <div
          className="prose prose-gray max-w-none"
          dangerouslySetInnerHTML={{ __html: content?.content || defaultContent }}
        />
      )}
      <p className="text-xs text-muted-foreground mt-8 pt-4 border-t">
        Используя настоящую платформу, пользователи подтверждают своё согласие с условиями работы на ней,
        а также с предоставлением и обработкой своих персональных данных.
      </p>
    </div>
  );
}
