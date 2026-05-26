// Astro server endpoint: POST /api/rerank
// Runs on Cloudflare Workers via the @astrojs/cloudflare adapter.
// Body: { "query": "...", "documents": ["...", "..."] }
// Returns: { "scores": [...] } in original document order

export const prerender = false;

export async function POST({ request, locals }) {
  const headers = {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
  };

  try {
    const body = await request.json();
    const query = typeof body.query === 'string' ? body.query.trim() : null;
    const documents = Array.isArray(body.documents) ? body.documents : null;

    if (!query || query.length === 0 || query.length > 1000) {
      return new Response(
        JSON.stringify({ error: 'Provide a "query" string (1-1000 chars)' }),
        { status: 400, headers }
      );
    }

    if (!documents || documents.length === 0 || documents.length > 30) {
      return new Response(
        JSON.stringify({ error: 'Provide 1-30 "documents"' }),
        { status: 400, headers }
      );
    }

    for (const d of documents) {
      if (typeof d !== 'string' || d.length === 0 || d.length > 2000) {
        return new Response(
          JSON.stringify({ error: 'Each document must be a 1-2000 char string' }),
          { status: 400, headers }
        );
      }
    }

    const env = locals.runtime?.env;
    if (!env || !env.AI) {
      return new Response(
        JSON.stringify({ error: 'Workers AI binding not available' }),
        { status: 500, headers }
      );
    }

    const result = await env.AI.run('@cf/baai/bge-reranker-base', {
      query,
      contexts: documents.map((text) => ({ text })),
    });

    // result.response: array of { id, score } sorted desc.
    // Map back to original input order.
    const scoresInOriginalOrder = new Array(documents.length).fill(0);
    for (const item of result.response) {
      scoresInOriginalOrder[item.id] = item.score;
    }

    return new Response(
      JSON.stringify({ scores: scoresInOriginalOrder }),
      { status: 200, headers }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
    },
  });
}
