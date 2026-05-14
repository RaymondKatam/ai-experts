# Post-Deploy Setup Guide

The site works out of the box for writing posts as Markdown files. **Decap CMS** (browser editor for contributors) and **Giscus** (comments) need a few clicks to activate after your repo is on GitHub.

Do these AFTER you've pushed the repo to GitHub and deployed to Cloudflare Pages.

---

## Part 1 — Decap CMS (browser editor at /admin)

This lets contributors log in at `https://your-domain.com/admin` and write posts in a WYSIWYG editor instead of editing Markdown files. Drafts go through a review flow (they create Pull Requests, you merge them).

### Step 1.1 — Update the config file

Open `public/admin/config.yml` and replace the placeholder:

```yaml
repo: YOUR_GITHUB_USERNAME/ai-experts
```

Change to your actual GitHub username and repo name. Commit and push.

### Step 1.2 — Set up GitHub OAuth

Decap needs an OAuth proxy to handle GitHub login from the browser. The free way is to use **Netlify's free OAuth service** (you don't need to host on Netlify — they just give you the auth endpoint).

**Option A (recommended): Use Netlify's free OAuth**

1. Sign up at https://app.netlify.com (free, no credit card)
2. Click **Sites → Add new site → Deploy manually** — drag any empty folder, just to create a site
3. Open the new site → **Site configuration → Access & security → OAuth → Install provider**
4. Pick **GitHub** → it'll ask you to create a GitHub OAuth App. Follow the steps:
   - On GitHub: **Settings → Developer settings → OAuth Apps → New OAuth App**
   - Homepage URL: `https://your-domain.com`
   - Authorization callback URL: `https://api.netlify.com/auth/done`
   - Copy the **Client ID** and **Client Secret** into Netlify
5. Done — Decap will now route auth through Netlify

**Option B (more control): Self-host the OAuth proxy**

If you want zero third-party dependency, deploy a small OAuth handler yourself. The simplest is `decap-proxy` on Cloudflare Workers. See: https://decapcms.org/docs/external-oauth-clients/

For most people, Option A is fine — Netlify only handles the login redirect, your content still lives in your GitHub repo.

### Step 1.3 — Visit /admin

Go to `https://your-domain.com/admin` → click **Login with GitHub** → authorize. You'll see the editor with your existing posts.

### Step 1.4 — Add contributors

In GitHub: **Repo → Settings → Collaborators → Add people**. Anyone you add can log into `/admin` and write posts. The editorial workflow means their posts become Pull Requests for you to review and merge.

---

## Part 2 — Giscus (comments via GitHub Discussions)

### Step 2.1 — Enable Discussions on your repo

GitHub → your repo → **Settings → General** → scroll to **Features** → check **Discussions**.

Then go to the **Discussions** tab in your repo → **Categories** → create a category called **Announcements** (or use the existing "General"). Set its discussion format to **Announcement**.

### Step 2.2 — Install the Giscus GitHub App

Go to https://github.com/apps/giscus → **Install** → pick your repo → **Install**.

### Step 2.3 — Get your config from giscus.app

1. Visit https://giscus.app
2. Scroll to **Repository** → enter `your-username/ai-experts`
3. Scroll to **Page ↔ Discussions Mapping** → select **Discussion title contains page `<title>`**
4. Scroll to **Discussion Category** → select **Announcements** (or the category you made)
5. Scroll to the bottom — the page generates a `<script>` block. Inside it you'll see two values:
   - `data-repo-id="R_kgDO..."`
   - `data-category-id="DIC_kwDO..."`

### Step 2.4 — Paste them into the Comments component

Open `src/components/Comments.astro` and replace the two TODO placeholders:

```html
data-repo="YOUR_GITHUB_USERNAME/ai-experts"
data-repo-id="R_kgDO..."           <!-- paste here -->
data-category-id="DIC_kwDO..."     <!-- paste here -->
```

Commit, push. Comments now appear at the bottom of every post.

### Step 2.5 — Moderation

- Comments are GitHub Discussions, so you moderate them in the **Discussions** tab of your repo (lock, delete, mark answer, etc.)
- Only people with a GitHub account can comment — this filters out 99% of spam automatically
- To ban a user, block them on GitHub the normal way

---

## Quick verification checklist

After both setups:

- [ ] Visit `https://your-domain.com/admin` → can log in with GitHub
- [ ] Create a test draft in the admin → it shows up as a Pull Request in GitHub
- [ ] Merge the PR → post appears on the live site within 2 minutes
- [ ] Open any blog post → comments section loads at the bottom
- [ ] Post a test comment → it appears in the Discussions tab of your repo

---

## Common gotchas

**"Failed to authenticate" on /admin login**
The OAuth callback URL on GitHub must exactly match what Netlify uses: `https://api.netlify.com/auth/done`. Double-check for trailing slashes and `https`.

**Comments box shows "Discussion not found"**
Giscus creates the discussion automatically the first time someone tries to comment. The first visitor sees the "be the first to comment" prompt — they post and the discussion is created. This is normal.

**Decap admin shows "config error"**
The `repo:` value in `config.yml` must match your real GitHub repo exactly, case-sensitive. `Raymond/AI-Experts` is different from `raymond/ai-experts`.

**Contributor PRs don't trigger a preview deploy**
On Cloudflare Pages: **Settings → Builds & deployments → Preview deployments → enable for all branches**. Now every PR gets its own preview URL so you can review the rendered post before merging.

---

That's everything. Once both are set up, your workflow is:

- **You write a post**: edit `.md` in your local repo, push, live in 30s
- **A contributor writes a post**: logs into `/admin`, writes in the editor, hits publish → PR opens → you merge → live in 30s
- **Someone comments**: GitHub login → comment appears under the post and in your Discussions tab
