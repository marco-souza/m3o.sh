import { defaultLang, useTranslations } from "@/i18n/ui";

export type Link = {
  url: string;
  label: string;
};

const t = useTranslations(defaultLang);

export const navLinks: Link[] = [
  { url: "/", label: t("nav.home") },
  { url: "/about", label: t("nav.about") },
  { url: "/blog", label: t("nav.blog") },
];

export const serviceLinks: Link[] = [
  { url: "/mock-interviews", label: t("nav.mock-interview") },
  { url: "/work-with-me", label: t("nav.work-with-me") },
];

export const m3o = {
  linkedin: "https://linkedin.com/in/masouzajunior",
  github: "https://github.com/marco-souza",
  avatar: "https://github.com/marco-souza.png",
};
