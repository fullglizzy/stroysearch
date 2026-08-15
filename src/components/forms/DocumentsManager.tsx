"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { toastSuccess, toastError, toastWarning } from "@/lib/toast";
import { Upload, Trash2, FileText, ExternalLink, Loader2, Save } from "lucide-react";

const MAX_SIZE = 10 * 1024 * 1024; // 10 МБ

interface LegalDocRow {
  key: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  text: string;
  updatedAt: Date;
}

const DOC_META: { key: string; title: string; page: string }[] = [
  { key: "privacy", title: "Согласие на обработку персональных данных", page: "/privacy" },
  { key: "terms", title: "Условия пользовательского соглашения", page: "/terms" },
];

function formatSize(bytes: number): string {
  if (!bytes) return "0 КБ";
  const kb = bytes / 1024;
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} МБ` : `${Math.round(kb)} КБ`;
}

export function DocumentsManager({ documents }: { documents: LegalDocRow[] }) {
  const router = useRouter();
  const byKey = Object.fromEntries(documents.map((d) => [d.key, d]));
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [savingTextKey, setSavingTextKey] = useState<string | null>(null);
  const [deleteKey, setDeleteKey] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [texts, setTexts] = useState<Record<string, string>>(
    Object.fromEntries(documents.map((d) => [d.key, d.text || ""])),
  );

  async function handleUpload(key: string, file: File) {
    if (file.type !== "application/pdf") {
      toastWarning("Проверьте файл", "Принимаются только PDF файлы");
      return;
    }
    if (file.size > MAX_SIZE) {
      toastWarning("Проверьте файл", "Размер файла не должен превышать 10 МБ");
      return;
    }

    setUploadingKey(key);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      const uploadData = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok) {
        toastError("Ошибка загрузки", uploadData.error || "Не удалось загрузить файл");
        return;
      }

      const saveRes = await fetch("/api/admin/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          fileName: file.name,
          fileUrl: uploadData.fileUrl,
          fileSize: file.size,
        }),
      });
      const saveData = await saveRes.json().catch(() => ({}));
      if (saveRes.ok) {
        toastSuccess("Документ сохранён", file.name);
        if (saveData.doc?.text !== undefined) {
          setTexts((prev) => ({ ...prev, [key]: saveData.doc.text }));
        }
        router.refresh();
      } else {
        toastError("Ошибка сохранения", saveData.error || "Не удалось сохранить документ");
      }
    } catch {
      toastError("Ошибка соединения");
    }
    setUploadingKey(null);
  }

  async function handleSaveText(key: string) {
    setSavingTextKey(key);
    try {
      const res = await fetch("/api/admin/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, text: texts[key] ?? "" }),
      });
      if (res.ok) {
        toastSuccess("Текст сохранён");
        router.refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        toastError("Ошибка", d.error || "Не удалось сохранить текст");
      }
    } catch {
      toastError("Ошибка соединения");
    }
    setSavingTextKey(null);
  }

  async function handleDelete() {
    if (!deleteKey) return;
    setDeleteLoading(true);
    try {
      const res = await fetch("/api/admin/documents", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: deleteKey }),
      });
      if (res.ok) {
        toastSuccess("Документ удалён");
        setTexts((prev) => ({ ...prev, [deleteKey]: "" }));
        setDeleteKey(null);
        router.refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        toastError("Ошибка", d.error || "Не удалось удалить документ");
        setDeleteKey(null);
      }
    } catch {
      toastError("Ошибка соединения");
    }
    setDeleteLoading(false);
  }

  const deleteTarget = DOC_META.find((m) => m.key === deleteKey);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {DOC_META.map((meta) => {
        const doc = byKey[meta.key];
        return (
          <Card key={meta.key}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-menthol" />
                {meta.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {doc?.fileUrl ? (
                <div className="rounded-lg border p-3 text-sm space-y-2">
                  <p className="font-medium break-words">{doc.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatSize(doc.fileSize)} · обновлён {new Date(doc.updatedAt).toLocaleDateString("ru-RU")}
                  </p>
                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" onClick={() => window.open(doc.fileUrl, "_blank")}>
                      <ExternalLink className="h-3.5 w-3.5 mr-1" />Открыть
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteKey(meta.key)}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1 text-destructive" />Удалить
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  PDF не загружен — на странице {meta.page} выводится текст ниже
                </p>
              )}

              <div className="space-y-2">
                <Textarea
                  value={texts[meta.key] ?? ""}
                  onChange={(e) => setTexts((prev) => ({ ...prev, [meta.key]: e.target.value }))}
                  placeholder="Текст документа."
                  rows={8}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => handleSaveText(meta.key)}
                  disabled={savingTextKey === meta.key}
                >
                  {savingTextKey === meta.key ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  Сохранить текст
                </Button>
              </div>

              <input
                ref={(el) => { inputRefs.current[meta.key] = el; }}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload(meta.key, file);
                  e.target.value = "";
                }}
              />
              <Button
                className="w-full bg-menthol hover:bg-menthol-dark"
                disabled={uploadingKey === meta.key}
                onClick={() => inputRefs.current[meta.key]?.click()}
              >
                {uploadingKey === meta.key ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                {doc?.fileUrl ? "Заменить PDF" : "Загрузить PDF"}
              </Button>
            </CardContent>
          </Card>
        );
      })}

      <ConfirmDialog
        open={!!deleteKey}
        onOpenChange={(o) => { if (!o) setDeleteKey(null); }}
        title="Удалить документ?"
        message={
          deleteTarget
            ? `PDF-файл и текст «${deleteTarget.title}» будут удалены. На странице ${deleteTarget.page} снова отобразится текст по умолчанию.`
            : ""
        }
        confirmLabel="Удалить"
        variant="danger"
        loading={deleteLoading}
        onConfirm={handleDelete}
      />
    </div>
  );
}
