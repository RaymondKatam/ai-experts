---
title: 'Running Llama 3 locally on a single GPU'
description: 'Setting up Ollama on a home server, picking the right quantization, and what actually fits on 12GB of VRAM.'
pubDate: 2026-05-10
author: 'Raymond Kipngetich'
category: ai
tags: ['ollama', 'llama', 'local-llm', 'gpu']
---

Spent the weekend getting a local LLM running on the lab box. Here's the short version of what worked.

## The hardware

Old gaming PC repurposed as an AI server. One RTX 3060 with 12GB VRAM, 32GB system RAM, Ubuntu 24.04. Nothing fancy.

## Installing Ollama

One command:

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

That's it. It installs the binary, sets up a systemd service, and exposes an API on `localhost:11434`.

## Picking a model

This is where it gets interesting. With 12GB of VRAM, the question is which quantization of which model actually fits *and* runs fast.

| Model | Quant | VRAM | Speed |
|---|---|---|---|
| Llama 3 8B | Q4_K_M | ~5GB | very fast |
| Llama 3 8B | Q8_0 | ~9GB | fast |
| Llama 3 70B | Q4_K_M | won't fit | n/a |

The 8B model at Q4_K_M is the sweet spot for this card. Quality is good for most tasks, and you've got headroom left for context window.

## Pulling and running

```bash
ollama pull llama3:8b
ollama run llama3:8b
```

First run downloads ~4.7GB. After that it's instant.

## What I'd do differently

If I were buying again today, I'd target 16GB+ VRAM so I could comfortably run quantized 13B models or experiment with longer context windows. The 3060 is great value but you feel the ceiling pretty fast.

Next post: hooking this up to Open WebUI so I can use it from anywhere on my network.
