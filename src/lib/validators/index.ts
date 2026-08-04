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
  email: z.string().email("Некорректный email"),
  password: z.string().min(8, "Пароль должен быть не менее 8 символов"),
  agreePersonalData: z.literal(true, {
    message: "Необходимо согласие на обработку персональных данных",
  }),
  agreeTerms: z.literal(true, {
    message: "Необходимо согласие с пользовательским соглашением",
  }),
});

export const registerCompanySchema = registerSchema.extend({
  inn: z
    .string()
    .length(10, "ИНН юридического лица должен содержать 10 цифр")
    .or(z.string().length(12, "ИНН физического лица должен содержать 12 цифр")),
});

// ────────────── Profile ──────────────

export const profileSchema = z.object({
  firstName: z.string().max(127).optional(),
  lastName: z.string().max(127).optional(),
  middleName: z.string().max(127).optional(),
  phone: z.string().max(20).optional(),
  region: z.string().max(255).optional(),
  classifierIds: z.array(z.string()).optional(),
  roles: z.array(z.enum(["PRODUCTOLOGIST", "TENDER_SPECIALIST", "DESIGNER", "COMPANY_OWNER", "OTHER"])).optional(),
  isContactsHidden: z.boolean().optional(),
});

// ────────────── Company ──────────────

export const addCompanySchema = z.object({
  inn: z.string().min(10, "ИНН обязателен").max(12),
  email: z.string().email("Некорректный email"),
});

// ────────────── Review ──────────────

export const reviewSchema = z.object({
  targetId: z.string().uuid(),
  companyId: z.string().uuid().optional(),
  comment: z.string().min(100, "Комментарий должен быть не менее 100 знаков"),
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
});

// ────────────── Library ──────────────

export const libraryDocumentSchema = z.object({
  title: z.string().min(1, "Название обязательно").max(511),
  treeItemId: z.string().uuid().optional().nullable(),
  coinPrice: z.number().int().min(0).max(100).default(5),
  fileUrl: z.string().min(1, "Ссылка на файл обязательна"),
  fileSize: z.number().int().max(10_485_760, "Максимальный размер файла 10 МБ"),
});

// ────────────── Poll ──────────────

export const pollSchema = z.object({
  question: z.string().min(1, "Вопрос обязателен"),
  treeItemId: z.string().uuid().optional().nullable(),
  pollType: z.enum(["DICHOTOMOUS", "MULTIPLE"]),
  coinReward: z.number().min(0).default(0.1),
  options: z
    .array(z.object({ text: z.string().min(1).max(255), sortOrder: z.number().int().default(0) }))
    .min(2, "Минимум 2 варианта ответа"),
});

// ────────────── Support ──────────────

export const supportTicketSchema = z.object({
  email: z.string().email("Некорректный email"),
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
  content: z.string(),
  bannerUrl: z.string().optional().nullable(),
});

// ────────────── Product (goods) ──────────────

export const productSchema = z.object({
  companyId: z.string().uuid(),
  treeItemId: z.string().uuid(),
  name: z.string().min(1).max(511),
  classes: z.array(z.enum(["STANDARD", "COMFORT", "BUSINESS", "PREMIUM"])),
  region: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  unit: z.string().max(63).optional().nullable(),
  characteristics: z.any().optional(),
  price: z.number().positive().optional().nullable(),
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
