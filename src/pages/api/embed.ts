// Astro server endpoint: POST /api/embed
// Runs on Cloudflare Workers via the @astrojs/cloudflare adapter.
// Body: { "texts": ["sentence 1", ...] }
// Returns: { "vectors": [[...], ...] }

export const prerender = false;

export async function POST({ request, locals }) {
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

    if (texts.length > 30) {
      return new Response(
        JSON.stringify({ error: 'Max 30 texts per request' }),
        { status: 400, headers }
      );
    }

    for (const t of texts) {
      if (typeof t !== 'string' || t.length === 0 || t.length > 1000) {
        return new Response(
          JSON.stringify({ error: 'Each text must be a 1-1000 char string' }),
          { status: 400, headers }
        );
      }
    }

    // Workers AI binding is available via Astro's locals.runtime.env on Cloudflare
    const env = locals.runtime?.env;
    if (!env || !env.AI) {
      return new Response(
        JSON.stringify({ error: 'Workers AI binding not available' }),
        { status: 500, headers }
      );
    }

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

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
    },
  });
}
