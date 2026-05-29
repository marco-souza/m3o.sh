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
    "nav.newsletter": "Newsletter",
    "nav.blog": "Blog",

    "nav.mock-interview": "Mock Interviews",
    "nav.work-with-me": "Work with Me",

    "home.presentation.title":
      "Hi! I’m Marco, and I like to make CLI tools for humans.",
    "home.presentation.description":
      "I’m Staff Software Development Engineer at <MongoDB>! Outside of that fancy title, I’m a social startup advisor and investor, open sourcerer, and beat-maker. I enjoy DJing, playing music, hanging out with my family and friends, and teaching at <PodCodar> in my free time.",
    "home.presentation.subscribe": "You should subscribe to my <newsletter>!",

    "footer.built-by": "© <year> Marco Souza. This site is <oss>! <3",
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
