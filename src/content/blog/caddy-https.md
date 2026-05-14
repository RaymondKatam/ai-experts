---
title: 'Self-hosting with Caddy: HTTPS in 4 lines'
description: 'A reverse proxy with automatic Let''s Encrypt certificates and a config so short it fits on a sticky note.'
pubDate: 2026-05-05
author: 'Raymond Kipngetich'
category: infra
tags: ['caddy', 'reverse-proxy', 'https', 'self-hosting']
---

I used to spend an afternoon every time I wanted to put a service behind HTTPS. Nginx config, Certbot, cron jobs, renewals breaking silently. Then I tried Caddy.

## The whole config

```caddy
blog.example.com {
  reverse_proxy localhost:4321
}
```

That's it. Four lines, including the closing brace. Caddy will:

- Get a Let's Encrypt cert automatically on first request
- Renew it before it expires
- Redirect HTTP to HTTPS
- Serve HTTP/2 and HTTP/3

No flags. No background services to remember. No "wait, did the renewal hook run?" panic.

## Install

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install caddy
```

The Caddyfile lives at `/etc/caddy/Caddyfile`. Edit it, then:

```bash
sudo systemctl reload caddy
```

## Caveats

You need ports 80 and 443 open and forwarded to the host. The ACME challenge runs on 80, so don't block it even if you only want HTTPS.

That's the whole guide. Caddy is one of those rare tools that does exactly what you want with no ceremony.
