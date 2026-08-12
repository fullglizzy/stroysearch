export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { formatFileSize } from "@/lib/utils";

export default async function PrivacyPage() {
  const [content, doc] = await Promise.all([
    prisma.pageContent.findUnique({ where: { pageKey: "privacy" } }),
    prisma.legalDocument.findUnique({ where: { key: "privacy" } }),
  ]);

  const defaultContent = `
    <h2>Согласие на обработку персональных данных</h2>
    <p>Настоящим я, действуя своей волей и в своем интересе, даю согласие Администрации Сайта
    «Единый независимый центр продуктовых решений, закупок и технических заданий строительной отрасли»
    на обработку моих персональных данных на следующих условиях:</p>
    <p>Персональные данные: фамилия, имя, отчество, адрес электронной почты, номер телефона,
    ИНН (для юридических лиц), регион, должность, сведения о профессиональной деятельности.</p>
    <p>Цели обработки: предоставление доступа к функционалу Сайта, информационное сопровождение,
    проведение исследований, создание новых продуктов и сервисов Сайта.</p>
    <p>Настоящее согласие действует с момента регистрации до его отзыва.</p>
  `;

  return (
    <div className="container-page py-8 max-w-3xl">
      <h1 className="text-3xl font-bold mb-6">Согласие на обработку персональных данных</h1>
      {doc ? (
        <div className="space-y-3">
          <iframe
            src={doc.fileUrl}
            title="Согласие на обработку персональных данных"
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
