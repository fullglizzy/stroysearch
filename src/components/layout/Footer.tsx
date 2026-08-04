import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t bg-secondary/50">
      <div className="container-page py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <Link href="/" className="flex items-center gap-2 font-bold text-lg mb-2">
              <span className="text-menthol">Е</span>
              <span>ЦПР</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              Единый независимый центр продуктовых решений, закупок и
              технических заданий строительной отрасли
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="font-semibold mb-3">Разделы</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/products"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Продуктовые решения
                </Link>
              </li>
              <li>
                <Link
                  href="/suppliers"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  База поставщиков
                </Link>
              </li>
              <li>
                <Link
                  href="/matrix"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Матрица материалов
                </Link>
              </li>
              <li>
                <Link
                  href="/library"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Библиотека
                </Link>
              </li>
              <li>
                <Link
                  href="/conferences"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Конференции
                </Link>
              </li>
              <li>
                <Link
                  href="/polls"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Статистика и опросы
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold mb-3">Документы</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/privacy"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Согласие на обработку персональных данных
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Условия пользовательского соглашения
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} ЕЦПР. Все права защищены.</p>
        </div>
      </div>
    </footer>
  );
}
