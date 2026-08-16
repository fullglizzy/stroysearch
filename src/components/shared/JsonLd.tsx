/**
 * JSON-LD разметка (Schema.org) для SEO.
 * Рендерится на сервере: <script type="application/ld+json">.
 */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
