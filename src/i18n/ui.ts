export const languages = {
  en: "English",
};

export const defaultLang = "en";

export const ui = {
  en: {
    "layout.title": "m3o.sh - Marco's home",
    "layout.description":
      "I've been building different products in finances, healthcare, e-commerce, and leading development in the last two decade. I've failed more times than I can remember, so I know what pitfalls to avoid. If you need an interim CTO, I can help you.",

    "nav.newsletter": "Newsletter",
    "nav.blog": "Blog",
    "nav.lab": "Lab",

    "nav.mock-interview": "Mock Interviews",
    "nav.work-with-me": "Work with Me",

    "social.github": "GitHub",
    "social.linkedin": "LinkedIn",

    "home.presentation.title":
      "Hi! I’m Marco, and I like to make CLI tools for humans.",
    "home.presentation.description":
      "I’m Senior Software Development Engineer at <MongoDB>! Outside of that fancy title, I’m a social startup advisor and investor, open sourcerer, and beat-maker. I enjoy DJing, playing music, hanging out with my family and friends, and teaching at <PodCodar> in my free time.",
    "home.presentation.subscribe": "You should subscribe to my <newsletter>!",

    "footer.built-by": "© <year> Marco Souza. This site is <oss>! <3",

    "work-with-me.meta.title": "Work with Me — Marco Souza",
    "work-with-me.meta.description": "a tech lead for you",

    "work-with-me.fte.heading": "Full-Time Roles",
    "work-with-me.fte.elevator-pitch":
      "I'm a Senior Software Development Engineer at MongoDB with over a decade of experience shipping products across fintech, healthcare, and e-commerce. I've led teams of 6+ engineers, reduced CI/CD times by 5x, and built systems serving 11M+ users. If you're looking for a technical leader who can drive impact from day one, let's connect.",
    "work-with-me.fte.cta.linkedin": "View LinkedIn",
    "work-with-me.fte.cta.resume": "View Resume",

    "work-with-me.consulting.heading": "Consulting",
    "work-with-me.consulting.intro":
      "I help startups and scale-ups ship faster, reduce tech debt, and build high-performing engineering teams. Here are a few ways we can work together:",
    "work-with-me.consulting.services.interim-cto.title": "Interim CTO",
    "work-with-me.consulting.services.interim-cto.description":
      "Step in as your acting CTO to stabilize engineering, hire the right people, and set a technical roadmap.",
    "work-with-me.consulting.services.architecture-review.title":
      "Architecture Review",
    "work-with-me.consulting.services.architecture-review.description":
      "Audit your current stack, identify bottlenecks, and get a concrete plan for scaling.",
    "work-with-me.consulting.services.team-coaching.title": "Team Coaching",
    "work-with-me.consulting.services.team-coaching.description":
      "Level up your engineering team with code reviews, pair programming, and process improvements.",
    "work-with-me.consulting.services.advisory.title": "1:1 Advisory",
    "work-with-me.consulting.services.advisory.description":
      "Weekly or bi-weekly sessions to unblock hard technical decisions and accelerate your growth.",
    "work-with-me.consulting.services.mock-interviews.title": "Mock Interviews",
    "work-with-me.consulting.services.mock-interviews.description":
      "Practice coding and system design interviews with detailed feedback. Book a session.",
    "work-with-me.consulting.cta.book-call": "Book a Call",
    "work-with-me.consulting.cta.linkedin": "View LinkedIn",

    "work-with-me.contact.heading": "Contact",
    "work-with-me.contact.email": "Email",
    "work-with-me.contact.linkedin": "LinkedIn",
    "work-with-me.contact.github": "GitHub",
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
