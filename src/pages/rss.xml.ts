import { getCollection } from "astro:content";
import rss from "@astrojs/rss";
import type { APIRoute } from "astro";
import { getLangFromUrl, useTranslations } from "@/i18n/ui";

export const GET: APIRoute = async ({ site }) => {
  const url = site ?? new URL(process.env.BASE_URL);

  const lang = getLangFromUrl(url);
  const t = useTranslations(lang);

  const title = t("blog.meta.title");
  const description: string = t("blog.meta.description");

  const blog = await getCollection("blog");

  return rss({
    title,
    description,
    site: url,
    customData: `<language>en-us</language>`,

    items: blog.map((post) => ({
      title: post.data.title,
      pubDate: post.data.publishedAt,
      description: post.data.description,
      // Compute RSS link from post `id`
      // This example assumes all posts are rendered as `/blog/[id]` routes
      link: `/blog/${post.id}/`,
    })),
  });
};
