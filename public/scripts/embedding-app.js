// Interactive 3D embedding visualization
// Loads Transformers.js + Plotly from CDN, runs the embedding model in-browser,
// projects 384D vectors to 3D with PCA, and renders an interactive plot.

const STARTER_SENTENCES = [
  "The dog chased the ball",
  "A puppy ran after the toy",
  "My cat loves to play fetch",
  "Quantum physics equations",
  "Einstein developed relativity theory",
];

let embedder = null;
let sentences = [...STARTER_SENTENCES];
let vectors = []; // array of Float32Array, each length 384

const statusEl = document.getElementById('embed-status');
const plotEl = document.getElementById('embed-plot');
const inputEl = document.getElementById('embed-input');
const buttonEl = document.getElementById('embed-button');
const resetEl = document.getElementById('embed-reset');

// --- Dynamically load Plotly from CDN ---
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// --- PCA implementation (simple, no deps) ---
// Input: array of vectors (each same length). Output: array of [x,y,z] per input.
function pca(data, k = 3) {
  if (data.length === 0) return [];
  const n = data.length;
  const d = data[0].length;

  // 1. Center the data
  const mean = new Float32Array(d);
  for (const v of data) for (let i = 0; i < d; i++) mean[i] += v[i];
  for (let i = 0; i < d; i++) mean[i] /= n;
  const centered = data.map(v => {
    const c = new Float32Array(d);
    for (let i = 0; i < d; i++) c[i] = v[i] - mean[i];
    return c;
  });

  // 2. Power iteration to find top-k principal components
  // For a small number of vectors this is fast enough.
  const components = [];
  const matCopy = centered.map(v => new Float32Array(v));

  for (let comp = 0; comp < k; comp++) {
    // Random init
    let w = new Float32Array(d);
    for (let i = 0; i < d; i++) w[i] = Math.random() - 0.5;
    normalize(w);

    // Power iterate
    for (let iter = 0; iter < 50; iter++) {
      // w_new = X^T X w
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
      // Check convergence
      let diff = 0;
      for (let i = 0; i < d; i++) diff += Math.abs(wNew[i] - w[i]);
      w = wNew;
      if (diff < 1e-6) break;
    }
    components.push(w);

    // Deflate: subtract this component's contribution
    for (let i = 0; i < n; i++) {
      let proj = 0;
      for (let j = 0; j < d; j++) proj += matCopy[i][j] * w[j];
      for (let j = 0; j < d; j++) matCopy[i][j] -= proj * w[j];
    }
  }

  // 3. Project original centered data onto the k components
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

// --- Color interpolation: gray → blue based on similarity to first sentence ---
function similarityColor(sim) {
  // sim ranges roughly -0.2 to 1.0. Clamp to [0, 1] visual range.
  const t = Math.max(0, Math.min(1, sim));
  // Interpolate from light gray (148,163,184) to bright blue (37,99,235)
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
    marker: {
      size: sizes,
      color: colors,
      line: { color: '#0c2461', width: 1 },
    },
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

async function embed(sentence) {
  const out = await embedder(sentence, { pooling: 'mean', normalize: true });
  return new Float32Array(out.data);
}

async function init() {
  try {
    // Load Plotly
    await loadScript('https://cdn.plot.ly/plotly-2.35.2.min.js');

    // Load Transformers.js
    statusEl.textContent = 'Downloading embedding model (~30MB on first visit)...';
    const { pipeline, env } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
    env.allowLocalModels = false;
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      progress_callback: (p) => {
        if (p.status === 'progress' && p.file && p.progress) {
          statusEl.textContent = `Downloading ${p.file}: ${Math.round(p.progress)}%`;
        }
      },
    });

    // Embed starter sentences
    statusEl.textContent = 'Embedding starter sentences...';
    vectors = [];
    for (const s of sentences) {
      vectors.push(await embed(s));
    }

    statusEl.textContent = `Ready. ${sentences.length} sentences embedded. Type your own below.`;
    buttonEl.disabled = false;
    render();
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Error loading model. Check console for details.';
  }
}

buttonEl.addEventListener('click', async () => {
  const text = inputEl.value.trim();
  if (!text || !embedder) return;
  buttonEl.disabled = true;
  statusEl.textContent = `Embedding "${text.slice(0, 40)}"...`;
  try {
    const v = await embed(text);
    sentences.push(text);
    vectors.push(v);
    inputEl.value = '';
    statusEl.textContent = `Ready. ${sentences.length} sentences embedded.`;
    render();
  } catch (err) {
    statusEl.textContent = 'Embed failed. See console.';
    console.error(err);
  }
  buttonEl.disabled = false;
});

inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') buttonEl.click();
});

resetEl.addEventListener('click', () => {
  sentences = [...STARTER_SENTENCES];
  vectors = vectors.slice(0, STARTER_SENTENCES.length);
  if (vectors.length < STARTER_SENTENCES.length) {
    // shouldn't happen, but re-init if so
    init();
    return;
  }
  statusEl.textContent = `Reset. ${sentences.length} sentences.`;
  render();
});

init();
