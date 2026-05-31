import { z } from "astro/zod";
import { defaultLang, useTranslations } from "@/i18n/ui";

export type Link = {
  url: string;
  label: string;
};

const t = useTranslations(defaultLang);

export const navLinks: Link[] = [
  // { url: "/newsletter", label: t("nav.newsletter") },
  // { url: "/blog", label: t("nav.blog") },
  { url: "/lab", label: t("nav.lab") },
];

export const serviceLinks: Link[] = [
  { url: "/mock-interview", label: t("nav.mock-interview") },
  { url: "/work-with-me", label: t("nav.work-with-me") },
];

export const m3o = {
  linkedin: "https://linkedin.com/in/masouzajunior",
  github: "https://github.com/marco-souza",
  avatar: "https://github.com/marco-souza.png",
};

export const socialLinks: Link[] = [
  { url: m3o.github, label: t("social.github") },
  { url: m3o.linkedin, label: t("social.linkedin") },
];

const EnvSchema = z.object({
  CONTACT_EMAIL: z.string().default("me@m3o.sh"),
  RESUME_URL: z.string().default("/resume"),
});

const env = EnvSchema.parse(import.meta.env);

export const links = {
  contactEmail: env.CONTACT_EMAIL,
  resumeUrl: env.RESUME_URL,
};
