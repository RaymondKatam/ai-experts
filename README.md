# AI Experts

A custom Astro blog for AI Experts — a collective writing about AI, infrastructure, and home lab experiments. Blue & white theme, fast, static, deploys for free.

**Founded by Raymond Kipngetich.**

## What's in here

- **Astro 5** + MDX for posts
- **Expressive Code** for syntax-highlighted code blocks (essential for tech posts)
- **Decap CMS** at `/admin` — browser-based editor for contributors (needs activation, see `SETUP.md`)
- **Giscus** comments on every post via GitHub Discussions (needs activation, see `SETUP.md`)
- **Multi-author** support — every post credits its author by name
- **RSS feed** auto-generated at `/rss.xml`
- **Sitemap** at `/sitemap-index.xml`
- **Tag pages** that build automatically from post frontmatter
- **404 page**
- **5 categories**: `ai`, `infra`, `homelab`, `notes`, `tutorial`

---

## Quick start (local)

You need Node.js 18.17+ installed.

```bash
npm install
npm run dev
```

Open <http://localhost:4321>.

---

## Customizing

### 1. Update site info

Edit `src/consts.ts`:

```ts
export const SITE = {
  title: 'Homelab Notes',
  tagline: '...',
  author: 'Your Name',
  email: 'you@example.com',
  github: 'https://github.com/yourusername',
  twitter: 'https://twitter.com/yourusername',
};
```

### 2. Set your domain

In `astro.config.mjs`, change `site:` to your real domain:

```js
site: 'https://your-domain.com',
```

Also update `public/robots.txt` with the same domain.

### 3. Write a post

Create a new file in `src/content/blog/`:

```markdown
---
title: 'Post title'
description: 'One-sentence summary for the card and meta tags.'
pubDate: 2026-05-13
author: 'Raymond Kipngetich'   # who wrote it
category: ai          # ai | infra | homelab | notes | tutorial
tags: ['tag1', 'tag2']
draft: false          # set to true to hide
---

Your content here. Markdown works. Code blocks get syntax highlighting.
```

### 4. Add images, PDFs, attachments

Drop files in `public/`:

```
public/
  images/diagram.png
  docs/notes.pdf
```

Reference them from any post:

```markdown
![Diagram](/images/diagram.png)
[Download PDF](/docs/notes.pdf)
```

---

## Deploying to Cloudflare Pages (free, recommended)

### Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOU/homelab-blog.git
git push -u origin main
```

### Step 2: Connect Cloudflare Pages

1. Go to <https://dash.cloudflare.com> → Workers & Pages → Create → Pages → Connect to Git
2. Pick your GitHub repo
3. Build settings:
   - **Framework preset**: Astro
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Node version**: `20` (add `NODE_VERSION=20` as an environment variable)
4. Click **Save and Deploy**

First build takes ~2 minutes. You'll get a URL like `homelab-blog.pages.dev`.

### Step 3: Buy and connect a domain

Buy a domain at **Cloudflare Registrar** (~$10/yr for `.com`, no markup) or **Porkbun**. If you buy from Cloudflare, DNS is already configured. If from elsewhere, point the nameservers to Cloudflare.

Then in Pages:
1. Open your project → Custom domains → Set up a custom domain
2. Type your domain → Cloudflare creates the DNS record automatically
3. SSL cert is provisioned in ~1 minute

Done. Every `git push` to `main` auto-deploys.

---

## After deploy — activate /admin and comments

The CMS and comments are pre-installed but need a few clicks to activate after your repo is on GitHub.

**See `SETUP.md` for the full step-by-step guide.** Short version:

1. **Decap CMS** (`/admin` editor): update `public/admin/config.yml` with your repo name, set up Netlify's free OAuth bridge, visit `/admin` and log in with GitHub
2. **Giscus comments**: enable Discussions on your repo, install the Giscus GitHub App, paste two IDs into `src/components/Comments.astro`

Total time: ~15 minutes.

---

## Alternatives

### Netlify

Same flow — connect repo, build command `npm run build`, output `dist`. Free for personal use.

### Vercel

Same. Astro is a first-class preset.

### Self-host on home lab

If you want to keep it on your own hardware:

```bash
npm run build
```

The `dist/` folder is plain static HTML/CSS/JS. Serve it with any web server:

```caddy
your-domain.com {
  root * /var/www/homelab-blog/dist
  file_server
  encode gzip
}
```

You'll need port 80/443 forwarded from your router to the box. See the included `caddy-https.md` post for the full setup.

---

## Project structure

```
src/
├── components/      Header, Footer, PostCard
├── content/blog/    Your posts (Markdown/MDX)
├── layouts/         BaseLayout (header + footer + meta)
├── pages/           Routes
│   ├── index.astro      Homepage
│   ├── about.astro      About page
│   ├── 404.astro
│   ├── rss.xml.ts       RSS feed
│   ├── blog/
│   │   ├── index.astro      Post list
│   │   └── [...slug].astro  Individual post
│   └── tags/
│       ├── index.astro      All tags
│       └── [tag].astro      Single tag
├── styles/global.css   Global styles, theme variables
├── consts.ts        Site config
└── content.config.ts   Post schema

public/              Static files served as-is (images, PDFs, favicon)
```

---

## Theme

Edit `src/styles/global.css`. Top of the file has the color variables:

```css
--color-blue:        #1e40af;
--color-blue-bright: #2563eb;
--color-blue-deep:   #0c2461;
--color-blue-tint:   #eff4ff;
```

Change those four values to recolor the whole site.

---

That's everything. Happy writing.
