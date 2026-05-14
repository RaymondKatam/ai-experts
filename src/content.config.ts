import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    heroImage: z.string().optional(),
    author: z.string().default('Raymond Kipngetich'),
    tags: z.array(z.string()).default([]),
    category: z.enum(['ai', 'infra', 'homelab', 'notes', 'tutorial']).default('notes'),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
