"use client";

import { useState } from "react";
import Link from "next/link";
import { HelpCircle } from "lucide-react";
import { SupportDialog } from "@/components/shared/SupportDialog";

export function Footer() {
  const [supportOpen, setSupportOpen] = useState(false);

  return (
    <footer className="border-t bg-secondary/30">
      <div className="container-page py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="sm:col-span-2 md:col-span-1">
            <Link href="/" aria-label="ЕЦПР — на главную" className="flex items-center gap-1 mb-2">
              <img
                src="/logo/logo.svg"
                alt=""
                // Справа в холсте SVG ~33% пустоты (425px из 1280): при h-36 это ~60px —
                // убираем их отрицательным отступом, чтобы текст был вплотную к рисунку
                className="h-36 w-auto translate-y-[9.7%] -mr-[60px]"
              />
              <span className="font-bold text-lg">
                <span className="text-menthol">Е</span>
                <span className="text-foreground">ЦПР</span>
              </span>
            </Link>
            <p className="text-sm text-muted-foreground mb-3">
              Единый независимый центр продуктовых решений, закупок и
              технических заданий строительной отрасли
            </p>
          </div>

          {/* Navigation — названия совпадают с шапкой */}
          <div>
            <h4 className="font-semibold mb-3 text-sm">Разделы</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/products" className="text-muted-foreground hover:text-menthol transition-colors">
                  Продуктовые решения
                </Link>
              </li>
              <li>
                <Link href="/suppliers" className="text-muted-foreground hover:text-menthol transition-colors">
                  База поставщиков и заказчиков
                </Link>
              </li>
              <li>
                <Link href="/matrix" className="text-muted-foreground hover:text-menthol transition-colors">
                  Даешь аналог! Матрица материалов
                </Link>
              </li>
              <li>
                <Link href="/library" className="text-muted-foreground hover:text-menthol transition-colors">
                  Продуктовая библиотека
                </Link>
              </li>
              <li>
                <Link href="/conferences" className="text-muted-foreground hover:text-menthol transition-colors">
                  Встречи и конференции
                </Link>
              </li>
              <li>
                <Link href="/polls" className="text-muted-foreground hover:text-menthol transition-colors">
                  Статистика и опросы
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold mb-3 text-sm">Документы</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/privacy" className="text-muted-foreground hover:text-menthol transition-colors">
                  Согласие на обработку персональных данных
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-muted-foreground hover:text-menthol transition-colors">
                  Условия пользовательского соглашения
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-semibold mb-3 text-sm">Поддержка</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <button
                  type="button"
                  onClick={() => setSupportOpen(true)}
                  className="text-muted-foreground hover:text-menthol transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                  Задать вопрос
                </button>
              </li>
              <li>
                <Link href="/register" className="text-muted-foreground hover:text-menthol transition-colors">
                  Регистрация участника
                </Link>
              </li>
              <li>
                <Link href="/register/company" className="text-muted-foreground hover:text-menthol transition-colors">
                  Регистрация компании
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t text-center text-sm text-muted-foreground">
          <p>
            Используя настоящую платформу, пользователи подтверждают своё согласие
            с условиями работы на ней, а также с предоставлением и обработкой своих
            персональных данных.
          </p>
          <p className="mt-2">
            © {new Date().getFullYear()} ЕЦПР. Все права защищены.
          </p>
        </div>
      </div>

      {/* Модалка обращения в поддержку */}
      <SupportDialog open={supportOpen} onOpenChange={setSupportOpen} />
    </footer>
  );
}
