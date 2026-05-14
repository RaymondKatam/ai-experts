// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import expressiveCode from 'astro-expressive-code';

// https://astro.build/config
export default defineConfig({
  // CHANGE THIS to your actual domain once you have it
  site: 'https://your-domain.com',
  integrations: [
    expressiveCode({
      themes: ['github-dark', 'github-light'],
      styleOverrides: {
        borderRadius: '6px',
        codeFontFamily: "'JetBrains Mono', monospace",
      },
    }),
    mdx(),
    sitemap(),
  ],
});
