// Interactive 3D embedding visualization (server-backed)
// Calls /api/embed which uses Cloudflare Workers AI.
// No model download, no WASM, no CDN imports of large libraries.

const STARTER_SENTENCES = [
  "The dog chased the ball",
  "A puppy ran after the toy",
  "My cat loves to play fetch",
  "Quantum physics equations",
  "Einstein developed relativity theory",
];

let sentences = [...STARTER_SENTENCES];
let vectors = []; // array of arrays (each length 768)

const statusEl = document.getElementById('embed-status');
const plotEl = document.getElementById('embed-plot');
const inputEl = document.getElementById('embed-input');
const buttonEl = document.getElementById('embed-button');
const resetEl = document.getElementById('embed-reset');

// --- Load Plotly once from CDN ---
function loadPlotly() {
  return new Promise((resolve, reject) => {
    if (window.Plotly) return resolve();
    const s = document.createElement('script');
    s.src = 'https://cdn.plot.ly/plotly-2.35.2.min.js';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Failed to load Plotly'));
    document.head.appendChild(s);
  });
}

// --- Simple PCA (power iteration, fast on ~10-30 vectors) ---
function pca(data, k = 3) {
  if (data.length === 0) return [];
  const n = data.length;
  const d = data[0].length;

  const mean = new Float32Array(d);
  for (const v of data) for (let i = 0; i < d; i++) mean[i] += v[i];
  for (let i = 0; i < d; i++) mean[i] /= n;
  const centered = data.map(v => {
    const c = new Float32Array(d);
    for (let i = 0; i < d; i++) c[i] = v[i] - mean[i];
    return c;
  });

  const matCopy = centered.map(v => new Float32Array(v));
  const components = [];

  for (let comp = 0; comp < k; comp++) {
    let w = new Float32Array(d);
    for (let i = 0; i < d; i++) w[i] = Math.random() - 0.5;
    normalize(w);

    for (let iter = 0; iter < 50; iter++) {
      const xw = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        let s = 0;
        for (let j = 0; j < d; j++) s += matCopy[i][j] * w[j];
        xw[i] = s;
      }
      const wNew = new Float32Array(d);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < d; j++) wNew[j] += matCopy[i][j] * xw[i];
      }
      normalize(wNew);
      let diff = 0;
      for (let i = 0; i < d; i++) diff += Math.abs(wNew[i] - w[i]);
      w = wNew;
      if (diff < 1e-6) break;
    }
    components.push(w);
    for (let i = 0; i < n; i++) {
      let proj = 0;
      for (let j = 0; j < d; j++) proj += matCopy[i][j] * w[j];
      for (let j = 0; j < d; j++) matCopy[i][j] -= proj * w[j];
    }
  }

  return centered.map(v => {
    const out = new Array(k);
    for (let c = 0; c < k; c++) {
      let s = 0;
      for (let j = 0; j < d; j++) s += v[j] * components[c][j];
      out[c] = s;
    }
    return out;
  });
}

function normalize(v) {
  let mag = 0;
  for (const x of v) mag += x * x;
  mag = Math.sqrt(mag);
  if (mag > 1e-10) for (let i = 0; i < v.length; i++) v[i] /= mag;
}

function cosineSim(a, b) {
  let dot = 0, mA = 0, mB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    mA += a[i] * a[i];
    mB += b[i] * b[i];
  }
  return dot / (Math.sqrt(mA) * Math.sqrt(mB) + 1e-10);
}

function similarityColor(sim) {
  const t = Math.max(0, Math.min(1, sim));
  const r = Math.round(148 + t * (37 - 148));
  const g = Math.round(163 + t * (99 - 163));
  const b = Math.round(184 + t * (235 - 184));
  return `rgb(${r},${g},${b})`;
}

function render() {
  if (!window.Plotly || vectors.length === 0) return;
  const projected = pca(vectors, 3);
  const referenceVec = vectors[0];
  const colors = vectors.map(v => similarityColor(cosineSim(referenceVec, v)));
  const sizes = vectors.map((_, i) => i === 0 ? 14 : 10);

  const trace = {
    x: projected.map(v => v[0]),
    y: projected.map(v => v[1]),
    z: projected.map(v => v[2]),
    text: sentences.map(s => s.length > 40 ? s.slice(0, 40) + '...' : s),
    mode: 'markers+text',
    type: 'scatter3d',
    marker: { size: sizes, color: colors, line: { color: '#0c2461', width: 1 } },
    textposition: 'top center',
    textfont: { family: 'Inter Tight, sans-serif', size: 11, color: '#0a1628' },
    hovertemplate: '<b>%{text}</b><extra></extra>',
  };

  const layout = {
    margin: { l: 0, r: 0, t: 0, b: 0 },
    scene: {
      xaxis: { title: 'PC1', gridcolor: '#e2e8f0', zerolinecolor: '#cbd5e1', titlefont: { size: 10 } },
      yaxis: { title: 'PC2', gridcolor: '#e2e8f0', zerolinecolor: '#cbd5e1', titlefont: { size: 10 } },
      zaxis: { title: 'PC3', gridcolor: '#e2e8f0', zerolinecolor: '#cbd5e1', titlefont: { size: 10 } },
      bgcolor: '#fafbfc',
    },
    paper_bgcolor: '#fafbfc',
    showlegend: false,
  };

  window.Plotly.newPlot(plotEl, [trace], layout, { responsive: true, displayModeBar: false });
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

async function init() {
  try {
    statusEl.textContent = 'Loading visualization library...';
    await loadPlotly();

    statusEl.textContent = `Embedding ${sentences.length} starter sentences...`;
    vectors = await embedTexts(sentences);

    statusEl.textContent = `Ready. ${sentences.length} sentences embedded. Type your own below.`;
    buttonEl.disabled = false;
    render();
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Setup failed: ' + err.message;
  }
}

buttonEl.addEventListener('click', async () => {
  const text = inputEl.value.trim();
  if (!text) return;
  buttonEl.disabled = true;
  statusEl.textContent = `Embedding "${text.slice(0, 40)}"...`;
  try {
    const [vec] = await embedTexts([text]);
    sentences.push(text);
    vectors.push(vec);
    inputEl.value = '';
    statusEl.textContent = `Ready. ${sentences.length} sentences embedded.`;
    render();
  } catch (err) {
    statusEl.textContent = 'Embed failed: ' + err.message;
    console.error(err);
  }
  buttonEl.disabled = false;
});

inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') buttonEl.click();
});

resetEl.addEventListener('click', async () => {
  buttonEl.disabled = true;
  sentences = [...STARTER_SENTENCES];
  statusEl.textContent = 'Resetting...';
  try {
    vectors = await embedTexts(sentences);
    render();
    statusEl.textContent = `Reset. ${sentences.length} sentences.`;
  } catch (err) {
    statusEl.textContent = 'Reset failed: ' + err.message;
  }
  buttonEl.disabled = false;
});

init();
