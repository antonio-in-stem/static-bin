import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const tenets = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/tenets" }),
  schema: z.object({
    title: z.string(),
    order: z.number(),
    kicker: z.string(),
  }),
});

const usecases = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/usecases" }),
  schema: z.object({
    title: z.string(),
    order: z.number(),
    footnote: z.string().optional(),
  }),
});

const roadmap = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/roadmap" }),
  schema: z.object({
    title: z.string(),
    order: z.number(),
    status: z.enum(["considering", "planned", "wont-fix"]),
  }),
});

export const collections = { tenets, usecases, roadmap };
