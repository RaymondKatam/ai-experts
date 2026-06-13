// Hosted vs self-hosted LLM cost calculator
// All numbers are illustrative based on public May-2026 listed prices.
// State is local; no API calls.

// ========== CONSTANTS ==========

// $ per 1M tokens. [input, output]
const MODEL_RATES = {
  'gpt-4o':         { in: 2.50, out: 10.00, color: '#10b981', label: 'OpenAI GPT-4o' },
  'claude-opus':    { in: 15.00, out: 75.00, color: '#dc2626', label: 'Claude Opus 4' },
  'claude-sonnet':  { in: 3.00, out: 15.00, color: '#a855f7', label: 'Claude Sonnet 4' },
  'cf-llama':       { in: 0.30, out: 0.50, color: '#0ea5e9', label: 'Cloudflare Llama 3.1 70B' },
  'self-hosted':    { in: null, out: null, color: '#2563eb', label: 'Self-hosted H100' },
};

const REGIONS = {
  'nairobi':    { kwh: 0.22, label: 'Nairobi \u00b7 $0.22/kWh' },
  'lagos':      { kwh: 0.18, label: 'Lagos \u00b7 $0.18/kWh' },
  'capetown':   { kwh: 0.16, label: 'Cape Town \u00b7 $0.16/kWh' },
  'mumbai':     { kwh: 0.09, label: 'Mumbai \u00b7 $0.09/kWh' },
  'frankfurt':  { kwh: 0.40, label: 'Frankfurt \u00b7 $0.40/kWh' },
  'us-east':    { kwh: 0.10, label: 'US East \u00b7 $0.10/kWh' },
};

const PROFILES = {
  'support':    { in: 1500, out: 300,  requestsLog: 5.0 },   // 100k chat turns, modest history
  'rag':        { in: 8000, out: 800,  requestsLog: 4.5 },   // 30k research queries with big context
  'code':       { in: 3000, out: 500,  requestsLog: 5.7 },   // 500k completions
  'summarizer': { in: 20000, out: 600, requestsLog: 4.0 },   // 10k long docs
  'custom':     null,
};

// Self-hosted assumptions
const H100_COST = 30000;                  // $ street price
const H100_AMORT_MONTHS = 36;             // 3-year depreciation
const SERVER_OVERHEAD = 170;              // chassis, networking, storage per month
const H100_WATTS = 700;                   // sustained inference draw
const HOURS_PER_MONTH = 24 * 30;          // 720 hours
const SUSTAINED_TPS = 2000;               // tokens/sec, Llama 3.1 70B FP8
const UTILIZATION = 0.60;                 // realistic uptime/load factor

// ========== STATE ==========
const state = {
  profile: 'support',
  requests: 100000,
  input: 2000,
  output: 500,
  region: 'nairobi',
};

// ========== HELPERS ==========
function $(id) { return document.getElementById(id); }

function fmtMoney(n) {
  if (n < 1) return '$' + n.toFixed(3);
  if (n < 10) return '$' + n.toFixed(2);
  if (n < 1000) return '$' + n.toFixed(0);
  if (n < 1_000_000) return '$' + (n / 1000).toFixed(1) + 'k';
  return '$' + (n / 1_000_000).toFixed(2) + 'M';
}

function fmtNumber(n) {
  if (n < 1000) return n.toString();
  if (n < 1_000_000) return (n / 1000).toFixed(n < 10000 ? 1 : 0) + 'k';
  if (n < 1_000_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  return (n / 1_000_000_000).toFixed(2) + 'B';
}

// ========== SELF-HOSTED COST PER 1M TOKENS ==========
// Returns one number used for both input and output (no in/out distinction on owned hw).
function selfHostedCostPerMillion(region) {
  const kwh = REGIONS[region].kwh;
  const monthlyAmort = H100_COST / H100_AMORT_MONTHS + SERVER_OVERHEAD;
  const monthlyKwh = (H100_WATTS / 1000) * HOURS_PER_MONTH;
  const monthlyElectric = monthlyKwh * kwh;
  const monthlyFixedCost = monthlyAmort + monthlyElectric;
  // Tokens/month at full utilization
  const tokensPerMonth = SUSTAINED_TPS * 3600 * HOURS_PER_MONTH * UTILIZATION;
  return (monthlyFixedCost / tokensPerMonth) * 1_000_000;
}

// ========== MONTHLY COST FOR A SPECIFIC MODEL AT A SPECIFIC WORKLOAD ==========
function monthlyCost(modelKey, requests, inputTokens, outputTokens, region) {
  const totalInputM = (requests * inputTokens) / 1_000_000;
  const totalOutputM = (requests * outputTokens) / 1_000_000;

  if (modelKey === 'self-hosted') {
    const rate = selfHostedCostPerMillion(region);
    // Self-hosted has a floor: even at zero tokens, you pay amortization+electricity
    const floor = (H100_COST / H100_AMORT_MONTHS) + SERVER_OVERHEAD +
                  (H100_WATTS / 1000) * HOURS_PER_MONTH * REGIONS[region].kwh;
    const variable = (totalInputM + totalOutputM) * rate;
    // The floor is fixed; variable is approx marginal but since the calculation
    // is already amortized over 60% utilization, simplest honest answer is:
    // monthly_cost = max(floor, totalTokens * rate) because the floor is paid
    // whether you use it or not.
    const usageBased = (totalInputM + totalOutputM) * rate;
    return Math.max(floor, usageBased);
  }

  const rate = MODEL_RATES[modelKey];
  return totalInputM * rate.in + totalOutputM * rate.out;
}

// ========== RESULTS PANEL ==========
function renderResults() {
  const { requests, input, output, region } = state;
  const totalTokens = requests * (input + output);

  const results = Object.keys(MODEL_RATES).map(key => {
    const cost = monthlyCost(key, requests, input, output, region);
    return { key, label: MODEL_RATES[key].label, color: MODEL_RATES[key].color, cost };
  });

  // Sort ascending so cheapest is first
  results.sort((a, b) => a.cost - b.cost);
  const cheapest = results[0];

  const html = results.map((r, idx) => {
    const isWinner = idx === 0;
    const bg = isWinner ? '#eff4ff' : '#fff';
    const border = isWinner ? '#2563eb' : '#e2e8f0';
    return `<div style="padding: 0.55rem 0.7rem; background: ${bg}; border: 1.5px solid ${border}; border-radius: 4px; margin-bottom: 0.4rem; display: flex; justify-content: space-between; align-items: center;">
      <span style="display: flex; align-items: center;">
        <span style="display: inline-block; width: 10px; height: 10px; background: ${r.color}; border-radius: 2px; margin-right: 0.5rem;"></span>
        <span style="font-size: 0.82rem; color: #0a1628;${isWinner ? 'font-weight:600;' : ''}">${r.label}</span>
      </span>
      <span style="font-family: 'JetBrains Mono', monospace; font-size: 0.82rem; color: #0c2461; ${isWinner ? 'font-weight:700;' : ''}">${fmtMoney(r.cost)}</span>
    </div>`;
  }).join('');

  $('cc-results').innerHTML = html;

  // Winner banner
  const second = results[1];
  const savingsPct = second && second.cost > 0
    ? Math.round((1 - cheapest.cost / second.cost) * 100)
    : 0;
  const totalTokensM = totalTokens / 1_000_000;
  $('cc-winner').innerHTML = `
    Cheapest for ${fmtNumber(requests)} req/month \u00b7 ${fmtNumber(totalTokensM)}M tokens: <b>${cheapest.label}</b> at ${fmtMoney(cheapest.cost)}/mo
    ${savingsPct > 0 ? `\u00b7 ${savingsPct}% cheaper than next option` : ''}
  `;
}

// ========== BREAK-EVEN CHART ==========
function renderChart() {
  const svg = $('cc-chart');
  const W = 720, H = 240;
  const margin = { top: 18, right: 20, bottom: 30, left: 60 };
  const innerW = W - margin.left - margin.right;
  const innerH = H - margin.top - margin.bottom;

  // X axis: monthly tokens log scale, 1M to 50B
  const xMinLog = 6;   // 10^6 = 1M
  const xMaxLog = 10.7; // ~5*10^10 = 50B
  // Y axis: monthly cost log scale, $1 to $1M
  const yMinLog = 0;   // $1
  const yMaxLog = 6;   // $1M

  function xPos(tokens) {
    const log = Math.log10(tokens);
    return margin.left + ((log - xMinLog) / (xMaxLog - xMinLog)) * innerW;
  }
  function yPos(dollars) {
    const log = Math.log10(Math.max(0.01, dollars));
    return margin.top + (1 - (log - yMinLog) / (yMaxLog - yMinLog)) * innerH;
  }

  const { region, input, output } = state;
  const inputFrac = input / (input + output);
  // Sample 60 points across the x axis
  const points = [];
  const N = 60;
  for (let i = 0; i <= N; i++) {
    const logT = xMinLog + (xMaxLog - xMinLog) * (i / N);
    const totalTokens = Math.pow(10, logT);
    const inTokens = totalTokens * inputFrac;
    const outTokens = totalTokens * (1 - inputFrac);
    // Convert to requests for monthlyCost; use ratio with current settings
    // Simpler: directly compute cost given total in/out tokens
    points.push({ totalTokens, inTokens, outTokens });
  }

  // Compute cost per model across the curve
  const curves = {};
  for (const modelKey of Object.keys(MODEL_RATES)) {
    curves[modelKey] = points.map(pt => {
      let cost;
      if (modelKey === 'self-hosted') {
        const rate = selfHostedCostPerMillion(region);
        const variable = (pt.totalTokens / 1_000_000) * rate;
        const floor = (H100_COST / H100_AMORT_MONTHS) + SERVER_OVERHEAD +
                      (H100_WATTS / 1000) * HOURS_PER_MONTH * REGIONS[region].kwh;
        cost = Math.max(floor, variable);
      } else {
        const r = MODEL_RATES[modelKey];
        cost = (pt.inTokens * r.in + pt.outTokens * r.out) / 1_000_000;
      }
      return { x: xPos(pt.totalTokens), y: yPos(cost) };
    });
  }

  // Build SVG
  let svgInner = '';

  // Background
  svgInner += `<rect x="${margin.left}" y="${margin.top}" width="${innerW}" height="${innerH}" fill="#fafbfc" stroke="#e2e8f0"/>`;

  // Y axis grid lines and labels
  for (let i = 0; i <= 6; i++) {
    const y = yPos(Math.pow(10, i));
    svgInner += `<line x1="${margin.left}" y1="${y}" x2="${margin.left + innerW}" y2="${y}" stroke="#e2e8f0" stroke-width="0.5"/>`;
    const labels = ['$1', '$10', '$100', '$1k', '$10k', '$100k', '$1M'];
    svgInner += `<text x="${margin.left - 8}" y="${y + 3}" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="9" fill="#94a3b8">${labels[i]}</text>`;
  }

  // X axis grid lines and labels
  const xTicks = [6, 7, 8, 9, 10];
  const xLabels = ['1M', '10M', '100M', '1B', '10B'];
  xTicks.forEach((t, i) => {
    const x = xPos(Math.pow(10, t));
    svgInner += `<line x1="${x}" y1="${margin.top}" x2="${x}" y2="${margin.top + innerH}" stroke="#e2e8f0" stroke-width="0.5"/>`;
    svgInner += `<text x="${x}" y="${margin.top + innerH + 14}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="9" fill="#94a3b8">${xLabels[i]}</text>`;
  });

  // Plot curves
  for (const modelKey of Object.keys(MODEL_RATES)) {
    const pts = curves[modelKey];
    const d = pts.map((p, i) => (i === 0 ? 'M' : 'L') + ' ' + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' ');
    const isSelfHosted = modelKey === 'self-hosted';
    svgInner += `<path d="${d}" fill="none" stroke="${MODEL_RATES[modelKey].color}" stroke-width="${isSelfHosted ? 2.5 : 2}" ${isSelfHosted ? 'stroke-dasharray="0"' : ''}/>`;
  }

  // Mark current selection
  const currentTokens = state.requests * (state.input + state.output);
  if (currentTokens >= Math.pow(10, xMinLog) && currentTokens <= Math.pow(10, xMaxLog)) {
    const x = xPos(currentTokens);
    svgInner += `<line x1="${x}" y1="${margin.top}" x2="${x}" y2="${margin.top + innerH}" stroke="#0a1628" stroke-width="1.5" stroke-dasharray="3 3"/>`;
    svgInner += `<text x="${x}" y="${margin.top - 4}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="9" fill="#0a1628" font-weight="600">you are here</text>`;
  }

  svg.innerHTML = svgInner;

  // Legend
  const legendHtml = Object.keys(MODEL_RATES).map(k => {
    return `<span style="display:flex;align-items:center;">
      <span style="display:inline-block;width:14px;height:3px;background:${MODEL_RATES[k].color};margin-right:5px;border-radius:1px;"></span>
      <span style="color:#475569;">${MODEL_RATES[k].label}</span>
    </span>`;
  }).join('');
  $('cc-legend').innerHTML = legendHtml;
}

// ========== SLIDER LABEL UPDATES ==========
function updateLabels() {
  // Requests is on a log scale 3 to 7 -> 1k to 10M
  const logVal = parseFloat($('cc-requests').value);
  state.requests = Math.round(Math.pow(10, logVal));
  $('cc-requests-label').textContent = fmtNumber(state.requests);

  state.input = parseInt($('cc-input').value, 10);
  $('cc-input-label').textContent = state.input.toLocaleString();

  state.output = parseInt($('cc-output').value, 10);
  $('cc-output-label').textContent = state.output.toLocaleString();

  state.region = $('cc-region').value;
  $('cc-region-label').textContent = REGIONS[state.region].label;
}

// ========== PROFILE PICKER ==========
function applyProfile(key) {
  const p = PROFILES[key];
  if (!p) return; // custom = no change
  $('cc-input').value = p.in;
  $('cc-output').value = p.out;
  $('cc-requests').value = p.requestsLog;
  updateLabels();
}

// ========== EVENT WIRING ==========
function attachEvents() {
  $('cc-profile').addEventListener('change', (e) => {
    state.profile = e.target.value;
    applyProfile(e.target.value);
    update();
  });

  ['cc-requests', 'cc-input', 'cc-output'].forEach(id => {
    $(id).addEventListener('input', () => {
      // If user moves a slider, switch profile to "custom"
      if (state.profile !== 'custom') {
        state.profile = 'custom';
        $('cc-profile').value = 'custom';
      }
      updateLabels();
      update();
    });
  });

  $('cc-region').addEventListener('change', () => {
    updateLabels();
    update();
  });
}

// ========== MAIN UPDATE ==========
function update() {
  renderResults();
  renderChart();
}

// ========== INIT ==========
function init() {
  updateLabels();
  attachEvents();
  update();
}

init();
