"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toastError, toastWarning } from "@/lib/toast";
import { Loader2, Save, Upload, X } from "lucide-react";

interface RequisitesConfig {
  organizationName: string | null;
  organizationInn: string | null;
  organizationKpp: string | null;
  organizationAddress: string | null;
  bankName: string | null;
  bankBik: string | null;
  bankAccount: string | null;
  bankCorrAccount: string | null;
  directorName: string | null;
  invoiceBasis: string | null;
  vatRate: number;
  signatureImage: string | null;
}

/**
 * Реквизиты и оформление печатных форм (продавец, банк, подписант, НДС,
 * основание, подпись). Раньше — вкладка «Шаблон счёта» настроек, теперь
 * часть вкладки «Шаблоны счетов и актов».
 */
export function RequisitesEditor({ config }: { config: RequisitesConfig | null }) {
  const router = useRouter();
  const [orgName, setOrgName] = useState(config?.organizationName || "");
  const [orgInn, setOrgInn] = useState(config?.organizationInn || "");
  const [orgKpp, setOrgKpp] = useState(config?.organizationKpp || "");
  const [orgAddress, setOrgAddress] = useState(config?.organizationAddress || "");
  const [bankName, setBankName] = useState(config?.bankName || "");
  const [bankBik, setBankBik] = useState(config?.bankBik || "");
  const [bankAccount, setBankAccount] = useState(config?.bankAccount || "");
  const [bankCorr, setBankCorr] = useState(config?.bankCorrAccount || "");
  const [director, setDirector] = useState(config?.directorName || "");
  const [basis, setBasis] = useState(config?.invoiceBasis || "");
  const [vatRate, setVatRate] = useState(String(config?.vatRate ?? 0));
  const [signature, setSignature] = useState(config?.signatureImage || "");
  const [signatureLoading, setSignatureLoading] = useState(false);
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function handleSignaturePhoto(file: File) {
    if (!file.type.startsWith("image/")) {
      toastWarning("Проверьте файл", "Фото должно быть изображением");
      return;
    }
    setSignatureLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSignature(data.fileUrl);
      } else {
        toastError("Ошибка загрузки", data.error || "Не удалось загрузить подпись");
      }
    } catch {
      toastError("Ошибка соединения");
    }
    setSignatureLoading(false);
  }

  async function save() {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationName: orgName,
          organizationInn: orgInn,
          organizationKpp: orgKpp,
          organizationAddress: orgAddress,
          bankName,
          bankBik,
          bankAccount,
          bankCorrAccount: bankCorr,
          directorName: director,
          invoiceBasis: basis || null,
          vatRate: parseFloat(vatRate) || 0,
          signatureImage: signature || null,
        }),
      });
      if (res.ok) {
        setMsg("✅ Сохранено");
        router.refresh();
      } else {
        const d = await res.json();
        setMsg("❌ " + (d.error || "Ошибка"));
      }
    } catch {
      setMsg("❌ Ошибка");
    }
    setLoading(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Реквизиты и оформление счёта</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Организация (продавец)</Label><Input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="ООО «ЕНЦПР»" /></div>
          <div className="space-y-2"><Label>ИНН организации</Label><Input value={orgInn} onChange={(e) => setOrgInn(e.target.value)} placeholder="7700000001" /></div>
          <div className="space-y-2"><Label>КПП</Label><Input value={orgKpp} onChange={(e) => setOrgKpp(e.target.value)} placeholder="770001001" /></div>
          <div className="space-y-2"><Label>Адрес организации</Label><Input value={orgAddress} onChange={(e) => setOrgAddress(e.target.value)} placeholder="г. Москва, ул. Строителей, д. 1" /></div>
          <div className="space-y-2"><Label>Банк</Label><Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="ПАО Сбербанк" /></div>
          <div className="space-y-2"><Label>БИК</Label><Input value={bankBik} onChange={(e) => setBankBik(e.target.value)} placeholder="044525225" /></div>
          <div className="space-y-2"><Label>Расчётный счёт</Label><Input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} placeholder="40702810000000000001" /></div>
          <div className="space-y-2"><Label>Корр. счёт</Label><Input value={bankCorr} onChange={(e) => setBankCorr(e.target.value)} placeholder="30101810400000000225" /></div>
          <div className="space-y-2"><Label>Подписант (ФИО)</Label><Input value={director} onChange={(e) => setDirector(e.target.value)} placeholder="Кокорев Кирилл Владимирович" /></div>
          <div className="space-y-2"><Label>Основание в счёте (напр., договор)</Label><Input value={basis} onChange={(e) => setBasis(e.target.value)} placeholder="Договор №1 от 01.01.2026" /></div>
          <div className="space-y-2">
            <Label>Ставка НДС</Label>
            <Select value={vatRate} items={{ "0": "Без НДС", "20": "20%" }} onValueChange={(v) => setVatRate(v || "0")}>
              <SelectTrigger className="w-full justify-between"><SelectValue placeholder="Ставка НДС" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0" label="Без НДС">Без НДС</SelectItem>
                <SelectItem value="20" label="20%">20%</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Фото рукописной подписи руководителя платформы</Label>
            <input
              ref={signatureInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleSignaturePhoto(file);
                e.target.value = "";
              }}
            />
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => signatureInputRef.current?.click()}
                disabled={signatureLoading}
              >
                {signatureLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                {signature ? "Заменить подпись" : "Загрузить подпись"}
              </Button>
              {signature && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={signature}
                    alt="Подпись руководителя"
                    className="h-14 w-auto rounded-md border object-contain bg-white"
                    loading="lazy"
                    decoding="async"
                  />
                  <Button type="button" variant="ghost" size="sm" onClick={() => setSignature("")}>
                    <X className="h-4 w-4 mr-1" />
                    Убрать
                  </Button>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Вставляется автоматически на место подписи во всех генерируемых счетах и актах
            </p>
          </div>
        </div>
        {msg && <Alert><AlertDescription>{msg}</AlertDescription></Alert>}
        <Button onClick={save} className="bg-menthol hover:bg-menthol-dark" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}Сохранить реквизиты
        </Button>
      </CardContent>
    </Card>
  );
}
