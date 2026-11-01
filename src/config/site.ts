/**
 * Brand and market configuration. Change the name, tagline and contact
 * details here; colours live in src/app/globals.css.
 */
export const site = {
  name: "QuestHub",
  tagline: "Buy and sell anything across Ghana",
  description:
    "QuestHub is a marketplace where people and businesses in Ghana list, discover and sell phones, cars, property, fashion and more.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  supportEmail: "support@questhub.example",
  market: {
    country: "Ghana",
    currency: "GHS",
    currencySymbol: "GH₵",
    locale: "en-GH",
    timezone: "Africa/Accra",
  },
  limits: {
    maxImageBytes: 5 * 1024 * 1024,
    maxAvatarBytes: 2 * 1024 * 1024,
    imageTypes: ["image/jpeg", "image/png", "image/webp"] as const,
    pageSize: 24,
  },
} as const;
