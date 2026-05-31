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

    "nav.mock-interview": "Mock Interview",
    "nav.work-with-me": "Work with Me",

    "social.github": "GitHub",
    "social.linkedin": "LinkedIn",

    "home.presentation.title":
      "Hi! I’m Marco, and I like to make CLI tools for humans.",
    "home.presentation.description":
      "I’m Senior Software Development Engineer at <MongoDB>! Outside of that fancy title, I’m a social startup advisor and investor, open sourcerer, and beat-maker. I enjoy DJing, playing music, hanging out with my family and friends, and teaching at <PodCodar> in my free time.",
    "home.presentation.subscribe": "You should check my <lab>!",

    "footer.built-by": "© <year> Marco Souza. This site is <oss>! <3",

    "work-with-me.meta.title": "Work with Me - Marco Souza",
    "work-with-me.meta.description": "a tech lead that understands you",

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
    "work-with-me.consulting.services.mock-interview.title": "Mock Interview",
    "work-with-me.consulting.services.mock-interview.description":
      "Practice coding and system design interviews with detailed feedback. Book a session.",
    "work-with-me.consulting.cta.book-call": "Book a Call",
    "work-with-me.consulting.cta.linkedin": "View LinkedIn",

    "work-with-me.contact.heading": "Contact",
    "work-with-me.contact.email": "Email",
    "work-with-me.contact.linkedin": "LinkedIn",
    "work-with-me.contact.github": "GitHub",

    "mock-interview.meta.title": "Mock Interview - Marco Souza",
    "mock-interview.meta.description":
      "Practice for tech interview ith feedback",
    "mock-interview.intro.heading": "Mock Interview",
    "mock-interview.intro.text":
      "Get actionable feedback on your interview performance. We run realistic simulations, then review what went well and what to improve.",
    "mock-interview.types.heading": "What We Cover",
    "mock-interview.types.coding.title": "Coding",
    "mock-interview.types.coding.description":
      "Algorithms, data structures, and problem-solving under time pressure. Questions drawn from real Big Tech interviews.",
    "mock-interview.types.system-design.title": "System Design",
    "mock-interview.types.system-design.description":
      "Design scalable distributed systems. We'll map out architecture, discuss trade-offs, and stress-test your decisions.",
    "mock-interview.types.behavioral.title": "Behavioral",
    "mock-interview.types.behavioral.description":
      "STAR-method stories, leadership principles, and communication clarity. Polish how you present your impact.",
    "mock-interview.process.heading": "How It Works",
    "mock-interview.process.step1": "Book a 60-minute session",
    "mock-interview.process.step2":
      "Pick your focus: coding, system design, or behavioral",
    "mock-interview.process.step3": "Run a realistic interview simulation",
    "mock-interview.process.step4":
      "Receive detailed feedback + an action plan",
    "mock-interview.pricing.heading": "Pricing",
    "mock-interview.pricing.text":
      "$150 per 60-minute session. Package discounts available for 3+ sessions.",
    "mock-interview.pricing.podcodar-note":
      "PodCodar students receive a special discount - mention PodCodar when booking so we can check the available discount for you!",
    "mock-interview.cta.book": "Book a Session",

    "lab.meta.title": "Lab - Marco Souza",
    "lab.meta.description": "Side projects and experiments by Marco Souza",
    "lab.heading": "Lab",
    "lab.counter": "{count} experiments on the bench",
    "lab.counter-filtered": "{count} experiments tagged with {tag}",
    "lab.wip": "Work in progress",
    "lab.wip-banner": "This project is a work in progress. Expect rough edges.",
    "lab.view-project": "View Project",
    "lab.view-repo": "View Repository",
    "lab.back": "Back to Lab",
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
