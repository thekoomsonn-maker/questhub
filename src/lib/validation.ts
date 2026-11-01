import { z } from "zod";

const email = z.email("Enter a valid email address").trim().toLowerCase().max(254);
const password = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Use 72 characters or fewer")
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/[0-9]/, "Include at least one number");

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password"),
});

export const registerSchema = z.object({
  displayName: z.string().trim().min(2, "Enter at least 2 characters").max(60),
  email,
  password,
  acceptTerms: z.literal("on", { error: "Accept the terms to continue" }),
});

export const forgotPasswordSchema = z.object({ email });
export const resetPasswordSchema = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match" });

/** Ghanaian numbers: 0XX XXX XXXX or +233 XX XXX XXXX. */
export const ghanaPhone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .refine((v) => v === "" || /^(\+233|0)[235][0-9]{8}$/.test(v), "Enter a Ghana number like 024 123 4567");

export const profileSchema = z.object({
  displayName: z.string().trim().min(2, "Enter at least 2 characters").max(60),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .transform((v) => (v === "" ? null : v))
    .refine((v) => v === null || /^[a-z0-9][a-z0-9-]{2,39}$/.test(v), "3–40 lowercase letters, numbers or hyphens")
    .nullable(),
  bio: z.string().trim().max(500, "Keep it under 500 characters"),
  regionId: z.coerce.number().int().min(1).max(16).nullable().catch(null),
  city: z.string().trim().max(80),
  phone: ghanaPhone,
  whatsapp: ghanaPhone,
  showPhone: z.boolean(),
  emailNotifications: z.boolean(),
});

export const conditionValues = ["new", "used", "refurbished", "not_applicable"] as const;

/** Server-side schema for listing content (the wizard validates the same rules). */
export const listingSchema = z.object({
  categoryId: z.uuid("Choose a category"),
  title: z.string().trim().min(5, "Use at least 5 characters").max(100, "Keep the title under 100 characters"),
  description: z
    .string()
    .trim()
    .min(20, "Describe the item in at least 20 characters")
    .max(5000, "Keep the description under 5,000 characters"),
  price: z
    .union([z.literal(""), z.coerce.number().min(0, "Price can't be negative").max(1_000_000_000)])
    .transform((v) => (v === "" ? null : v)),
  isNegotiable: z.boolean(),
  condition: z.enum(conditionValues),
  quantity: z.coerce.number().int().min(0).max(100000),
  regionId: z.coerce.number().int().min(1, "Choose a region").max(16),
  city: z.string().trim().min(2, "Enter the town or area").max(80),
  attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
  orderable: z.boolean().optional(),
}).refine((v) => !v.orderable || v.price !== null, { path: ["price"], message: "Set a price to sell online" })
  .refine((v) => !v.orderable || v.quantity > 0, { path: ["quantity"], message: "Add stock to sell online" });
export type ListingInput = z.input<typeof listingSchema>;

export const reportSchema = z.object({
  targetType: z.enum(["listing", "user", "message"]),
  targetId: z.uuid(),
  reason: z.enum(["scam", "fake_or_misleading", "prohibited_item", "spam", "harassment", "impersonation", "other"]),
  details: z.string().trim().max(1000).optional(),
});

export const messageSchema = z.object({
  conversationId: z.uuid(),
  body: z.string().trim().min(1, "Write a message").max(2000, "Messages can be up to 2,000 characters"),
});

export function fieldErrors(error: z.ZodError) {
  return z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
}
