// Interactive reranker visualization (server-backed)
// Calls /api/embed and /api/rerank which use Cloudflare Workers AI.

const CORPUS = [
  "Espresso is a concentrated coffee made by forcing hot water through finely-ground beans under pressure.",
  "Pasta carbonara uses eggs, hard cheese, pancetta, and pepper — no cream, despite what some recipes say.",
  "To make sourdough, mix flour and water and let wild yeast colonize the starter over several days.",
  "Python's GIL prevents multiple threads from executing Python bytecode simultaneously, limiting CPU-bound concurrency.",
  "Async/await in JavaScript is syntactic sugar over promises, making asynchronous code read like synchronous code.",
  "Rust's borrow checker enforces memory safety at compile time without needing a garbage collector.",
  "Transformer models replaced LSTMs because self-attention parallelizes across the sequence length.",
  "Fine-tuning a language model on domain-specific data improves performance on that domain at the cost of general capability.",
  "Vector databases use approximate nearest neighbor algorithms like HNSW to scale similarity search to millions of items.",
  "The 2026 FIFA World Cup was hosted across three countries: the United States, Mexico, and Canada.",
  "Lionel Messi won the Ballon d'Or eight times across his career, more than any other player in football history.",
  "Cardio training improves cardiovascular endurance; strength training increases muscle mass and bone density.",
];

let docEmbeddings = null;

const statusEl = document.getElementById('rerank-status');
const inputEl = document.getElementById('rerank-input');
const buttonEl = document.getElementById('rerank-button');
const resultsEl = document.getElementById('rerank-results');

function cosineSim(a, b) {
  let dot = 0, mA = 0, mB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    mA += a[i] * a[i];
    mB += b[i] * b[i];
  }
  return dot / (Math.sqrt(mA) * Math.sqrt(mB) + 1e-10);
}

async function embedTexts(texts) {
  const res = await fetch('/api/embed', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ texts }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'unknown error' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.vectors;
}

async function rerank(query, documents) {
  const res = await fetch('/api/rerank', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, documents }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'unknown error' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.scores;
}

async function init() {
  try {
    statusEl.textContent = `Indexing ${CORPUS.length} documents (one-time embedding of the corpus)...`;
    docEmbeddings = await embedTexts(CORPUS);
    statusEl.textContent = `Ready. ${CORPUS.length} documents indexed. Try a query.`;
    buttonEl.disabled = false;
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Setup failed: ' + err.message;
  }
}

async function runQuery(query) {
  buttonEl.disabled = true;
  statusEl.textContent = 'Embedding query and ranking by cosine similarity...';

  try {
    const [qVec] = await embedTexts([query]);

    const scored = CORPUS.map((doc, i) => ({
      doc,
      origIndex: i,
      cosScore: cosineSim(qVec, docEmbeddings[i]),
    }));
    scored.sort((a, b) => b.cosScore - a.cosScore);
    const topK = scored.slice(0, 5);

    // Show stage-1 results immediately while reranker runs
    renderResults(topK, null);

    statusEl.textContent = 'Reranking with cross-encoder...';
    const topDocs = topK.map(c => c.doc);
    const rerankScores = await rerank(query, topDocs);

    const rerankedList = topK.map((c, i) => ({ ...c, rerankScore: rerankScores[i] }));
    rerankedList.sort((a, b) => b.rerankScore - a.rerankScore);

    renderResults(topK, rerankedList);
    statusEl.textContent = `Done. ${CORPUS.length} docs scanned, top 5 reranked.`;
  } catch (err) {
    statusEl.textContent = 'Query failed: ' + err.message;
    console.error(err);
  }
  buttonEl.disabled = false;
}

function renderResults(stage1, stage2) {
  const stage1Order = new Map(stage1.map((c, i) => [c.origIndex, i]));

  function renderColumn(title, items, isReranked) {
    const rows = items.map((c, idx) => {
      let movementBadge = '';
      if (isReranked) {
        const from = stage1Order.get(c.origIndex);
        const to = idx;
        const delta = from - to;
        if (delta > 0) {
          movementBadge = `<span style="color:#10b981;font-weight:600;margin-right:0.4rem;">▲${delta}</span>`;
        } else if (delta < 0) {
          movementBadge = `<span style="color:#dc2626;font-weight:600;margin-right:0.4rem;">▼${-delta}</span>`;
        } else {
          movementBadge = `<span style="color:#94a3b8;margin-right:0.4rem;">—</span>`;
        }
      }
      const score = isReranked ? c.rerankScore.toFixed(3) : c.cosScore.toFixed(3);
      return `
        <div style="padding: 0.7rem 0.85rem; background: #fff; border: 1px solid #e2e8f0; border-radius: 4px; margin-bottom: 0.5rem; font-size: 0.88rem; line-height: 1.4;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.3rem;">
            <span style="font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: #64748b;">
              ${movementBadge}#${idx + 1}
            </span>
            <span style="font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: #2563eb; font-weight: 600;">
              ${score}
            </span>
          </div>
          <div style="color: #334155;">${c.doc}</div>
        </div>
      `;
    }).join('');

    return `
      <div>
        <div style="font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em; color: #2563eb; margin-bottom: 0.6rem; font-weight: 600;">${title}</div>
        ${rows}
      </div>
    `;
  }

  const leftCol = renderColumn('Stage 1 · cosine similarity', stage1, false);
  const rightCol = stage2
    ? renderColumn('Stage 2 · reranked', stage2, true)
    : `<div style="display:flex;align-items:center;justify-content:center;color:#94a3b8;font-family:'JetBrains Mono',monospace;font-size:0.85rem;">running reranker...</div>`;

  resultsEl.innerHTML = leftCol + rightCol;
}

buttonEl.addEventListener('click', () => {
  const q = inputEl.value.trim();
  if (!q) return;
  runQuery(q);
});

inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') buttonEl.click();
});

init();
