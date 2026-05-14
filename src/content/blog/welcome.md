---
title: 'Welcome to AI Experts'
description: 'A quick intro to this site and what to expect — also serves as a template for new posts.'
pubDate: 2026-05-13
author: 'Raymond Kipngetich'
category: notes
tags: ['meta', 'getting-started']
---

This is the first post on the site — partly a hello, partly a template you can copy when writing the next one.

## What this site is

A notebook. I run a small home lab and I want a place to write down what I'm learning, what I'm building, and what's currently on fire. Topics will mostly be:

- **AI** — running local models, fine-tuning experiments, agent stuff
- **Infrastructure** — Docker, networking, self-hosting, observability
- **Whatever I'm currently breaking** — the unplanned posts are usually the most useful

## How posts work

Every post is a Markdown file in `src/content/blog/`. The frontmatter at the top sets the title, description, date, category, and tags. Filename becomes the URL slug.

You get all the usual Markdown:

> Block quotes look like this. Good for pulling out a key idea.

Inline `code snippets` and fenced code blocks with syntax highlighting:

```python
# This is rendered with Expressive Code — syntax-highlighted out of the box
def hello(name: str) -> str:
    return f"Hello, {name}"

print(hello("homelab"))
```

```bash
# Bash works too
docker compose up -d
docker compose logs -f app
```

## Images, PDFs, and attachments

Drop any image, PDF, or other file into the `public/` folder and reference it directly:

```markdown
![Diagram](/images/my-diagram.png)
[Download the PDF](/docs/notes.pdf)
```

Anything in `public/` is served as-is from the root of the site.

## Categories

Posts have one of these categories: `ai`, `infra`, `homelab`, `notes`, or `tutorial`. They show up as a label on the post card and at the top of the article.

## That's it

Delete this file when you're ready, or keep it as a reference. The next post is yours.
