// Cloudflare Pages Function: POST /api/embed
// Body: { "texts": ["sentence 1", "sentence 2", ...] }
// Returns: { "vectors": [[...], [...], ...] }
// Uses Workers AI native embedding model bge-base-en-v1.5 (768-dim).

export async function onRequestPost(context) {
  const { request, env } = context;

  // CORS headers so we can call this from the page
  const headers = {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
  };

  try {
    const body = await request.json();
    const texts = Array.isArray(body.texts) ? body.texts : null;

    if (!texts || texts.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Provide a non-empty "texts" array' }),
        { status: 400, headers }
      );
    }

    // Cap to prevent abuse
    if (texts.length > 30) {
      return new Response(
        JSON.stringify({ error: 'Max 30 texts per request' }),
        { status: 400, headers }
      );
    }

    // Validate each text
    for (const t of texts) {
      if (typeof t !== 'string' || t.length === 0 || t.length > 1000) {
        return new Response(
          JSON.stringify({ error: 'Each text must be a 1-1000 char string' }),
          { status: 400, headers }
        );
      }
    }

    // Call Workers AI binding
    const result = await env.AI.run('@cf/baai/bge-base-en-v1.5', { text: texts });

    return new Response(
      JSON.stringify({ vectors: result.data }),
      { status: 200, headers }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers }
    );
  }
}

// Handle CORS preflight
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
    },
  });
}
