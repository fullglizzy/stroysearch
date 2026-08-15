import { z } from "zod";

// ────────────── Auth ──────────────

export const loginSchema = z.object({
  username: z.string().min(1, "Логин обязателен"),
  password: z.string().min(1, "Пароль обязателен"),
});

export const registerSchema = z.object({
  username: z
    .string()
    .min(3, "Логин должен быть не менее 3 символов")
    .max(63, "Логин должен быть не более 63 символов")
    .regex(/^[a-zA-Z0-9_]+$/, "Логин может содержать только латинские буквы, цифры и _"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Некорректный email"),
  password: z.string().min(8, "Пароль должен быть не менее 8 символов"),
  agreePersonalData: z
    .boolean()
    .refine((value) => value, "Необходимо согласие на обработку персональных данных"),
  agreeTerms: z
    .boolean()
    .refine((value) => value, "Необходимо согласие с пользовательским соглашением"),
});

/**
 * Проверяет контрольную сумму ИНН:
 * 10 цифр — организация, 12 цифр — ИП (алгоритм ФНС).
 */
export function isValidInn(inn: string): boolean {
  if (!/^\d{10}$|^\d{12}$/.test(inn)) return false;
  const digits = [...inn].map(Number);
  const checksum = (coeffs: number[], from: number, pos: number) =>
    (coeffs.reduce((sum, c, i) => sum + c * digits[from + i], 0) % 11) % 10 === digits[pos];

  if (digits.length === 10) {
    return checksum([2, 4, 10, 3, 5, 9, 4, 6, 8], 0, 9);
  }
  return (
    checksum([7, 2, 4, 10, 3, 5, 9, 4, 6, 8], 0, 10) &&
    checksum([3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8], 0, 11)
  );
}

export const registerCompanySchema = registerSchema.extend({
  // На форме регистрации компании согласие на обработку персональных
  // данных не требуется (переопределяем поле базовой схемы)
  agreePersonalData: z.boolean().optional(),
  inn: z
    .string()
    .regex(/^\d{10}$|^\d{12}$/, "ИНН должен содержать ровно 10 или 12 цифр")
    .refine(isValidInn, "Такого ИНН не существует — проверьте номер"),
  companyName: z
    .string()
    .trim()
    .min(1, "Укажите название компании")
    .max(255, "Название должно быть не более 255 символов"),
});

// ────────────── Profile ──────────────

export const profileSchema = z.object({
  firstName: z.string().max(127).optional(),
  lastName: z.string().max(127).optional(),
  middleName: z.string().max(127).optional(),
  phone: z.string()
    .regex(/^(\+7|8)?[\s-]?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}$/, "Неверный формат телефона. Пример: +7 (999) 123-45-67")
    .optional()
    .or(z.literal("")),
  regions: z.array(z.string().min(1).max(255)).optional(),
  classifierIds: z.array(z.string().uuid("Некорректный классификатор")).optional(),
  roles: z
    .array(
      z.enum(
        ["PRODUCTOLOGIST", "TENDER_SPECIALIST", "DESIGNER", "COMPANY_OWNER", "OTHER"],
        { error: "Некорректная роль" },
      ),
    )
    .optional(),
  isContactsHidden: z.boolean().optional(),
  kpp: z.string().regex(/^\d{9}$/, "КПП должен содержать ровно 9 цифр").optional().or(z.literal("")),
  legalAddress: z.string().max(511).optional(),
  directorName: z.string().max(255).optional(),
  companyName: z.string().max(255).optional(),
  website: z.string().max(255, "Сайт должен быть не более 255 символов").optional().or(z.literal("")),
});

// ────────────── Company ──────────────

export const addCompanySchema = z.object({
  inn: z.string()
    .regex(/^\d{10}$|^\d{12}$/, "ИНН должен содержать ровно 10 или 12 цифр"),
  name: z.string()
    .min(1, "Название компании обязательно")
    .max(255, "Название должно быть не более 255 символов"),
  email: z.string().email("Некорректный email"),
  phone: z.string().regex(/^(\+7|8)?[\s-]?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}$/, "Неверный формат телефона. Пример: +7 (999) 123-45-67"),
  website: z.string().max(255, "Сайт должен быть не более 255 символов").optional().or(z.literal("")),
  regions: z.array(z.string().min(1).max(255)).min(1, "Выберите регион"),
  classifierIds: z.array(z.string().uuid()).min(1, "Выберите хотя бы одну категорию классификатора"),
});

// ────────────── Review ──────────────

export const reviewSchema = z.object({
  targetId: z.string().uuid(),
  companyId: z.string().uuid().optional(),
  comment: z
    .string()
    .min(100, "Комментарий должен быть не менее 100 знаков")
    .max(5000, "Комментарий должен быть не более 5000 знаков"),
  signatureType: z.enum(["nick", "name"]),
  criteria: z
    .array(
      z.object({
        criteriaIndex: z.number().min(1).max(9),
        score: z.number().min(1).max(5),
      })
    )
    .length(9, "Необходимо оценить все 9 критериев"),
});

// ────────────── Conference ──────────────

export const conferenceSchema = z.object({
  title: z.string().min(1, "Название обязательно").max(511),
  date: z.string().or(z.date()),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Формат времени: ЧЧ:ММ"),
  description: z.string().min(1, "Описание обязательно").max(2500),
  treeItemId: z.string().uuid().optional().nullable(),
  coinPrice: z.number().int().min(0).default(0),
  isPublic: z.boolean().default(true),
  connectionLink: z.string().url().optional().nullable(),
  logoUrl: z.string().max(511).optional().nullable(),
});

// ────────────── Library ──────────────

export const libraryDocumentSchema = z.object({
  title: z.string().min(1, "Название обязательно").max(511),
  treeItemId: z.string().uuid().optional().nullable(),
  coinPrice: z.number().int().min(0).max(100).default(5),
  fileUrl: z.string().min(1, "Файл обязателен"),
  fileSize: z.number().int().min(1).max(10_485_760, "Максимальный размер файла 10 МБ"),
});

// ────────────── Poll ──────────────

export const pollSchema = z.object({
  question: z.string().min(1, "Вопрос обязателен"),
  treeItemId: z.string().uuid().optional().nullable(),
  pollType: z.enum(["DICHOTOMOUS", "MULTIPLE"]),
  coinReward: z.number().min(0).max(10, "Награда не может превышать 10 монет").default(0.1),
  options: z
    .array(
      z.object({
        id: z.string().optional(), // при редактировании — id существующего варианта
        text: z.string().min(1).max(255),
        sortOrder: z.number().int().default(0),
      }),
    )
    .min(2, "Минимум 2 варианта ответа"),
});

// ────────────── Support ──────────────

export const supportTicketSchema = z.object({
  subject: z.string().min(1, "Тема обязательна").max(511),
  message: z.string().min(1, "Сообщение обязательно"),
});

// ────────────── Coins ──────────────

export const giftCoinsSchema = z.object({
  targetUsername: z.string().min(1, "Укажите ник или ИНН получателя"),
  amount: z.number().positive("Сумма должна быть положительной"),
});

// ────────────── Product Tree ──────────────

export const productTreeItemSchema = z.object({
  name: z.string().min(1, "Название обязательно").max(255),
  parentId: z.string().uuid().optional().nullable(),
  description: z.string().optional().nullable(),
  bannerUrl: z.string().optional().nullable(),
});

// ────────────── Page Content ──────────────

export const pageContentSchema = z.object({
  pageKey: z.string().min(1).max(63),
  title: z.string().max(255).default(""),
  content: z.string(),
  bannerUrl: z.string().optional().nullable(),
});

// ────────────── Product (goods) ──────────────

export const productSchema = z.object({
  companyId: z.string().uuid(),
  treeItemId: z.string().uuid("Выберите категорию классификатора"),
  name: z.string().min(1, "Название обязательно").max(511),
  classes: z.array(z.enum(["STANDARD", "COMFORT", "BUSINESS", "PREMIUM"])).min(1, "Выберите хотя бы один класс товара"),
  regions: z.array(z.string().min(1).max(255)).optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  unit: z.string().max(63).optional().nullable(),
  characteristics: z.any().optional(),
  price: z.number().min(0, "Цена не может быть отрицательной").optional().nullable(),
});

// ────────────── Types ──────────────

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type RegisterCompanyInput = z.infer<typeof registerCompanySchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type AddCompanyInput = z.infer<typeof addCompanySchema>;
export type ReviewInput = z.infer<typeof reviewSchema>;
export type ConferenceInput = z.infer<typeof conferenceSchema>;
export type LibraryDocumentInput = z.infer<typeof libraryDocumentSchema>;
export type PollInput = z.infer<typeof pollSchema>;
export type SupportTicketInput = z.infer<typeof supportTicketSchema>;
export type GiftCoinsInput = z.infer<typeof giftCoinsSchema>;
export type ProductTreeItemInput = z.infer<typeof productTreeItemSchema>;
export type PageContentInput = z.infer<typeof pageContentSchema>;
export type ProductInput = z.infer<typeof productSchema>;
