---
title: 'RAG, explained without the hype'
description: 'What Retrieval-Augmented Generation actually is, why it solves the "LLM made it up" problem, and how to build a minimal version in under 50 lines of Python.'
pubDate: 2026-05-14
author: 'Raymond Kipngetich'
category: ai
tags: ['rag', 'llm', 'vector-db', 'embeddings']
---

The first time I used an LLM to answer a question about my own notes, it confidently made up three citations that didn't exist. That's the problem RAG was built to solve.

This post is the short version of what RAG actually is, why it works, and the smallest useful example I could write.

## The problem in one sentence

An LLM only knows what it saw during training. Ask it about your private documents, your company's internal wiki, last week's news, or this morning's log files — it has no idea, but it will often answer anyway. That's hallucination.

## What RAG actually does

RAG stands for **Retrieval-Augmented Generation**. The name describes the architecture exactly:

1. **Retrieval** — when the user asks a question, first search your own documents for relevant chunks
2. **Augmented** — paste those chunks into the prompt as context
3. **Generation** — let the LLM answer using that context

The model isn't doing anything new or magical. It's just answering with material that's now sitting right there in the prompt. The intelligence is in *how you fetch the right chunks*.

## Why "just search" isn't enough

Old-school search uses keywords. If you search "automobile" but the document says "car", keyword search misses it.

RAG uses **embeddings** instead — a way to represent meaning as a list of numbers (typically 768 or 1536 of them). Texts with similar meaning end up close to each other in that high-dimensional space. So "automobile" and "car" land in roughly the same neighborhood, and a similarity search finds both.

The vector database is just a fast way to ask: *"which of my 10,000 chunks are closest to this query, by cosine distance?"*

## The whole pipeline

\`\`\`
Documents → Chunks → Embeddings → Vector DB
                                       ↓
                                    [search]
                                       ↑
User question → Embedding → top-k chunks → LLM prompt → Answer
\`\`\`

That's it. Every RAG system in production is some elaboration on this loop.

## When NOT to use RAG

RAG isn't the answer to every problem. Skip it when:

- The answer is purely about **how to reason or write**, not about facts (e.g., "rewrite this email")
- The knowledge is **already in the model's training data** and not changing (e.g., classic SQL syntax)
- You need **structured data** — RAG retrieves text; for numbers, query a real database

The honest mental model: RAG is how you give an LLM access to *facts it doesn't have*. If facts aren't the bottleneck, RAG won't help.

Next post: I'll wire a real RAG pipeline into a small "ask my homelab docs" assistant and run it on the lab server.
