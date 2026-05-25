export const languages = {
  en: "English",
};

export const defaultLang = "en";

export const ui = {
  en: {
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
