import type { APIRoute } from "astro";

const getRobotsTxt = (sitemapURL: URL) => `\
User-agent: *
Allow: /

Sitemap: ${sitemapURL.href}
`;

export const GET: APIRoute = () => {
  const sitemapURL = new URL("sitemap-index.xml", process.env.BASE_URL);
  return new Response(getRobotsTxt(sitemapURL));
};
