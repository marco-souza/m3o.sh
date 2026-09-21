import { z } from "astro/zod";
import { defaultLang, useTranslations } from "@/i18n/ui";

export type Link = {
  url: string;
  label: string;
};
const t = useTranslations(defaultLang);

export const navLinks: Link[] = [
  { url: "/blog", label: t("nav.blog") },
  { url: "/lab", label: t("nav.lab") },
  { url: "/socials", label: t("nav.socials") },
  { url: "/mock-interview", label: t("nav.mock-interview") },
  { url: "/work-with-me", label: t("nav.work-with-me") },
];

export const m3o = {
  linkedin: "https://linkedin.com/in/masouzajunior",
  github: "https://github.com/marco-souza",
  discord: "https://discord.com/users/488746421944582154",
  avatar: "https://github.com/marco-souza.png",
};

export const podcodar = {
  page: "https://podcodar.org",
  discord: "https://discord.gg/vnEAM9sFb7",
};

const EnvSchema = z.object({
  CONTACT_EMAIL: z.string().default("me@m3o.sh"),
  RESUME_URL: z.string().default("/resume"),
});

const env = EnvSchema.parse(import.meta.env);

export const links = {
  contactEmail: env.CONTACT_EMAIL,
  resumeUrl: env.RESUME_URL,
};
