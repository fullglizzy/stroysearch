-- Названия счетов и примечания в шаблонах документов (только данные,
-- схема не меняется — таблица doc_template_lines создана ранее)

INSERT OR IGNORE INTO "doc_template_lines" ("id", "docKind", "code", "label", "description", "enabled", "sortOrder", "createdAt", "updatedAt") VALUES
('tpl_billing_title', 'billing_invoice', 'title', 'Название счёта', 'Счёт на оплату № {number} от {date}', 1, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('tpl_billing_note', 'billing_invoice', 'note', 'Примечание', 'Оплата данного счёта означает полное и безоговорочное согласие с условиями Публичной оферты (акцепт оферты согласно ст. 438 ГК РФ).\n*Упрощенная система налогообложения (УСН) / ст. 346.11 НК РФ (или пп. 26 п. 2 ст. 149 НК РФ, если софт в реестре РФ).', 1, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('tpl_coin_title', 'coin_invoice', 'title', 'Название счёта', 'Счёт на оплату № {number} от {date}', 1, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('tpl_coin_note', 'coin_invoice', 'note', 'Примечание', 'Оплата данного счёта означает полное и безоговорочное согласие с условиями Публичной оферты (акцепт оферты согласно ст. 438 ГК РФ).\n*Упрощенная система налогообложения (УСН) / ст. 346.11 НК РФ (или пп. 26 п. 2 ст. 149 НК РФ, если софт в реестре РФ).', 1, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
