// Cloudflare Pages Function: POST /api/rerank
// Body: { "query": "...", "documents": ["...", "..."] }
// Returns: { "scores": [0.92, 0.31, ...] } in same order as input documents
// Uses Workers AI native reranker bge-reranker-base.

export async function onRequestPost(context) {
  const { request, env } = context;

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

    // Call Workers AI reranker
    const result = await env.AI.run('@cf/baai/bge-reranker-base', {
      query,
      contexts: documents.map((text) => ({ text })),
    });

    // result.response is an array of { id, score } sorted by score desc.
    // Map back to original input order so the frontend can compare to its own list.
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

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
    },
  });
}
