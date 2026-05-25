export const languages = {
  en: "English",
};

export const defaultLang = "en";

export const ui = {
  en: {
    "layout.title": "m3o.sh - Marco's home",
    "layout.description":
      "I've been building different products in finances, healthcare, e-commerce, and leading development in the last two decade. I've failed more times than I can remember, so I know what pitfalls to avoid. If you need an interim CTO, I can help you.",

    "nav.home": "Home",
    "nav.about": "About",
    "nav.blog": "Blog",

    "nav.mock-interview": "Mock Interviews",
    "nav.work-with-me": "Work with Me",
  },
} as const;

export function getLangFromUrl(url: URL) {
  const [, lang] = url.pathname.split("/");
  if (lang in ui) return lang as keyof typeof ui;
  return defaultLang;
}

export function useTranslations(lang: keyof typeof ui) {
  return function t(key: keyof (typeof ui)[typeof defaultLang]) {
    return ui[lang][key] || ui[defaultLang][key];
  };
}
