// Agent Gateway concept dashboard
// All data is simulated. Five subsystems share state:
//   1. Agent ticker (tokens accumulating in real time)
//   2. Quota enforcement (one agent will hit cap, get cut off)
//   3. MCP server toggles (block tool access, see attempts fail)
//   4. Cost pie (hosted vs self-hosted split, shiftable)
//   5. Audit log (every event scrolls into a structured feed)

// ====== STATE ======
const AGENTS = [
  { id: 'marketing-research', emoji: '\uD83D\uDCCA', team: 'marketing', quota: 80000, used: 0, rate: 180, status: 'active', model: 'gpt-4o', mcp: ['github', 'web-search'] },
  { id: 'github-triager',     emoji: '\uD83D\uDC1B', team: 'platform',  quota: 40000, used: 0, rate: 95,  status: 'active', model: 'claude-opus', mcp: ['github'] },
  { id: 'stripe-reconciler',  emoji: '\uD83D\uDCB3', team: 'finance',   quota: 60000, used: 0, rate: 120, status: 'active', model: 'gpt-4o', mcp: ['stripe', 'internal-docs'] },
  { id: 'docs-summarizer',    emoji: '\uD83D\uDCDD', team: 'eng',       quota: 50000, used: 0, rate: 70,  status: 'active', model: 'llama-3-70b', mcp: ['internal-docs'] },
  { id: 'sales-prospector',   emoji: '\uD83D\uDD0D', team: 'sales',     quota: 30000, used: 0, rate: 480, status: 'active', model: 'claude-opus', mcp: ['web-search', 'crm'] }, // runaway
  { id: 'support-router',     emoji: '\uD83C\uDFAB', team: 'support',   quota: 70000, used: 0, rate: 110, status: 'active', model: 'llama-3-70b', mcp: ['crm', 'internal-docs'] },
];

const MCP_SERVERS = [
  { id: 'github',         label: 'GitHub',         enabled: true },
  { id: 'stripe',         label: 'Stripe',         enabled: true },
  { id: 'internal-docs',  label: 'Internal Docs',  enabled: true },
  { id: 'web-search',     label: 'Web Search',     enabled: true },
  { id: 'crm',            label: 'CRM',            enabled: true },
];

// Cost in $ per 1M input tokens (illustrative)
const MODEL_COSTS = {
  'gpt-4o':       2.50,
  'claude-opus':  15.00,
  'llama-3-70b':  0.30,   // self-hosted approx
};

const MODEL_LABELS = {
  'gpt-4o':       'GPT-4o',
  'claude-opus':  'Claude Opus',
  'llama-3-70b':  'Llama-3 70B (self-hosted)',
};

const MODEL_COLORS = {
  'gpt-4o':       '#10b981',
  'claude-opus':  '#a855f7',
  'llama-3-70b':  '#2563eb',
};

let blocksCount = 0;
let mcpFailureCooldown = {};

// ====== HELPERS ======
function $(sel) { return document.getElementById(sel); }

function pad(n) { return n < 10 ? '0' + n : '' + n; }
function now() {
  const d = new Date();
  return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
}

function fmtTokens(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return Math.round(n).toString();
}

function fmtCost(n) {
  return '$' + n.toFixed(2);
}

// ====== AUDIT LOG ======
const MAX_LOG_ENTRIES = 50;
let logEntries = [];

function logEvent(actor, action, resource, decision) {
  const entry = {
    t: now(),
    actor,
    action,
    resource,
    decision,
  };
  logEntries.unshift(entry);
  if (logEntries.length > MAX_LOG_ENTRIES) logEntries.pop();
  renderLog();
}

function renderLog() {
  const html = logEntries.map(e => {
    const decisionColor = e.decision === 'ALLOW' ? '#34d399'
                        : e.decision === 'DENY'  ? '#f87171'
                        : e.decision === 'LIMIT' ? '#fbbf24'
                        : '#cbd5e1';
    return `<div style="padding: 0.3rem 0; border-bottom: 1px solid #1e293b;">
      <span style="color: #64748b;">${e.t}</span>
      &nbsp;<span style="color: ${decisionColor}; font-weight: 600;">${e.decision}</span>
      &nbsp;<span style="color: #a5b4fc;">${e.actor}</span>
      &nbsp;<span style="color: #94a3b8;">${e.action}</span>
      &nbsp;<span style="color: #cbd5e1;">${e.resource}</span>
    </div>`;
  }).join('');
  $('ag-log').innerHTML = html;
}

// ====== TOAST NOTIFICATIONS ======
let toastTimeout = null;
function toast(msg) {
  const el = $('ag-toast');
  el.textContent = msg;
  el.style.transform = 'translateX(0)';
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    el.style.transform = 'translateX(400px)';
  }, 3000);
}

// ====== AGENTS PANEL ======
function renderAgents() {
  const activeCount = AGENTS.filter(a => a.status === 'active').length;
  $('ag-agent-count').textContent = `${activeCount} of ${AGENTS.length} active`;

  const html = AGENTS.map(a => {
    const pct = Math.min(100, (a.used / a.quota) * 100);
    const isCapped = a.status === 'capped';
    const barColor = isCapped ? '#dc2626' : pct > 80 ? '#f59e0b' : '#2563eb';
    const statusBadge = isCapped
      ? '<span style="color:#dc2626;font-weight:600;">CAPPED</span>'
      : pct > 80
        ? '<span style="color:#f59e0b;font-weight:600;">near limit</span>'
        : '<span style="color:#10b981;">active</span>';
    return `<div style="padding: 0.5rem 0; border-bottom: 1px solid #f1f5f9;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
        <span style="font-size: 0.85rem; color: #0a1628;">
          <span style="margin-right: 0.4rem;">${a.emoji}</span>
          <span style="font-family: 'JetBrains Mono', monospace; font-size: 0.8rem;">${a.id}</span>
          <span style="font-family: 'JetBrains Mono', monospace; font-size: 0.7rem; color: #94a3b8;">\u00b7 ${a.team}</span>
        </span>
        <span style="font-family: 'JetBrains Mono', monospace; font-size: 0.7rem;">
          ${statusBadge}
        </span>
      </div>
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <div style="flex: 1; background: #f1f5f9; border-radius: 4px; height: 6px; overflow: hidden;">
          <div style="background: ${barColor}; height: 100%; width: ${pct}%; transition: width 0.4s ease, background 0.3s;"></div>
        </div>
        <span style="font-family: 'JetBrains Mono', monospace; font-size: 0.7rem; color: #64748b; min-width: 110px; text-align: right;">
          ${fmtTokens(a.used)} / ${fmtTokens(a.quota)}
        </span>
      </div>
    </div>`;
  }).join('');
  $('ag-agents').innerHTML = html;
}

// ====== STATS ======
function totalTokens() {
  return AGENTS.reduce((s, a) => s + a.used, 0);
}

function projectedDailySpend() {
  // Project today's rate forward. The widget runs faster than wall clock,
  // so we just report the spent so far in $ terms, scaled.
  let total = 0;
  for (const a of AGENTS) {
    total += (a.used / 1_000_000) * MODEL_COSTS[a.model];
  }
  return total;
}

function renderStats() {
  $('ag-stat-tokens').textContent = fmtTokens(totalTokens());
  $('ag-stat-cost').textContent = fmtCost(projectedDailySpend());
  $('ag-stat-blocks').textContent = blocksCount;
}

// ====== COST PIE ======
function renderPie() {
  const byModel = {};
  for (const a of AGENTS) {
    const cost = (a.used / 1_000_000) * MODEL_COSTS[a.model];
    byModel[a.model] = (byModel[a.model] || 0) + cost;
  }
  const total = Object.values(byModel).reduce((s, v) => s + v, 0);

  const svg = $('ag-pie');
  if (total <= 0) {
    svg.innerHTML = '<circle cx="100" cy="100" r="80" fill="#f1f5f9" stroke="#e2e8f0" stroke-width="1"/><text x="100" y="105" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" fill="#94a3b8">no data yet</text>';
    $('ag-pie-legend').innerHTML = '';
    return;
  }

  let cumAngle = -Math.PI / 2;
  const cx = 100, cy = 100, r = 80;
  const paths = [];
  const sortedModels = Object.keys(byModel).sort((a, b) => byModel[b] - byModel[a]);
  for (const m of sortedModels) {
    const frac = byModel[m] / total;
    if (frac <= 0) continue;
    const startAngle = cumAngle;
    const endAngle = cumAngle + frac * Math.PI * 2;
    cumAngle = endAngle;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = frac > 0.5 ? 1 : 0;
    // Special-case full circle to avoid degenerate path
    let d;
    if (frac >= 0.999) {
      d = `M ${cx-r} ${cy} A ${r} ${r} 0 1 1 ${cx+r} ${cy} A ${r} ${r} 0 1 1 ${cx-r} ${cy} Z`;
    } else {
      d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    }
    paths.push(`<path d="${d}" fill="${MODEL_COLORS[m]}" stroke="#fff" stroke-width="1.5"/>`);
  }
  svg.innerHTML = paths.join('');

  const legendHtml = sortedModels.map(m => {
    const frac = (byModel[m] / total * 100).toFixed(1);
    return `<div style="display: flex; align-items: center; margin-bottom: 0.25rem;">
      <span style="display: inline-block; width: 10px; height: 10px; background: ${MODEL_COLORS[m]}; border-radius: 2px; margin-right: 0.45rem;"></span>
      <span style="color: #334155; flex: 1;">${MODEL_LABELS[m]}</span>
      <span style="color: #94a3b8;">${frac}%</span>
    </div>`;
  }).join('');
  $('ag-pie-legend').innerHTML = legendHtml;
}

// ====== MCP TOGGLES ======
function renderMcp() {
  const html = MCP_SERVERS.map(s => {
    const bg = s.enabled ? '#eff4ff' : '#fef2f2';
    const border = s.enabled ? '#2563eb' : '#dc2626';
    const labelColor = s.enabled ? '#0c2461' : '#991b1b';
    const statusText = s.enabled ? 'allowed' : 'blocked';
    return `<button data-mcp="${s.id}" class="ag-mcp-toggle" style="background: ${bg}; border: 1.5px solid ${border}; border-radius: 4px; padding: 0.55rem 0.7rem; cursor: pointer; text-align: left; font-family: inherit;">
      <div style="font-size: 0.82rem; font-weight: 600; color: ${labelColor}; margin-bottom: 0.15rem;">${s.label}</div>
      <div style="font-family: 'JetBrains Mono', monospace; font-size: 0.7rem; color: ${labelColor}; opacity: 0.7;">${statusText}</div>
    </button>`;
  }).join('');
  $('ag-mcp').innerHTML = html;
  document.querySelectorAll('.ag-mcp-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.mcp;
      const s = MCP_SERVERS.find(x => x.id === id);
      s.enabled = !s.enabled;
      const decision = s.enabled ? 'ALLOW' : 'DENY';
      logEvent('platform-admin', s.enabled ? 'mcp.enable' : 'mcp.disable', s.label, decision);
      toast(`${s.label} is now ${s.enabled ? 'allowed' : 'blocked'}`);
      renderMcp();
    });
  });
}

// ====== TICK SIMULATION ======
let tickCount = 0;
function tick() {
  tickCount++;
  // 2 ticks/sec, ~30s simulated minute
  for (const a of AGENTS) {
    if (a.status !== 'active') continue;

    // Token consumption
    const burst = a.rate * (0.7 + Math.random() * 0.6); // some noise
    a.used += burst;

    // Quota check
    if (a.used >= a.quota) {
      a.used = a.quota;
      a.status = 'capped';
      blocksCount++;
      logEvent(a.id, 'token.quota.exceeded', `${a.quota} tokens`, 'LIMIT');
      toast(`\u26A0  Token quota enforced on ${a.id}`);
    } else if (Math.random() < 0.10) {
      // Occasionally log model calls
      logEvent(a.id, 'model.call', MODEL_LABELS[a.model] + ` (+${Math.round(burst)} tok)`, 'ALLOW');
    }

    // MCP access attempts
    if (Math.random() < 0.06 && a.mcp.length > 0) {
      const target = a.mcp[Math.floor(Math.random() * a.mcp.length)];
      const server = MCP_SERVERS.find(s => s.id === target);
      if (server && !server.enabled) {
        // Only log once per cooldown window per (agent,server)
        const key = a.id + ':' + target;
        const lastT = mcpFailureCooldown[key] || 0;
        if (tickCount - lastT > 6) {
          logEvent(a.id, 'mcp.call', server.label, 'DENY');
          mcpFailureCooldown[key] = tickCount;
          blocksCount++;
        }
      } else if (server) {
        logEvent(a.id, 'mcp.call', server.label, 'ALLOW');
      }
    }
  }
  renderAgents();
  renderStats();
  if (tickCount % 4 === 0) renderPie();
  $('ag-clock').textContent = now();
}

// ====== SHIFT WORKLOAD BUTTON ======
function shiftWorkload() {
  // Move all hosted-model agents to llama-3-70b
  let changed = 0;
  for (const a of AGENTS) {
    if (a.model !== 'llama-3-70b') {
      const oldModel = a.model;
      a.model = 'llama-3-70b';
      changed++;
      logEvent('platform-admin', 'workload.shift', `${a.id}: ${MODEL_LABELS[oldModel]} \u2192 ${MODEL_LABELS['llama-3-70b']}`, 'ALLOW');
    }
  }
  const btn = $('ag-shift-button');
  btn.disabled = true;
  btn.textContent = `Shifted \u00b7 ${changed} agents now self-hosted`;
  btn.style.background = '#10b981';
  toast(`\u2713  ${changed} agents moved to self-hosted Llama-3 70B`);
  renderPie();
  renderStats();
}

// ====== INIT ======
function init() {
  renderAgents();
  renderMcp();
  renderPie();
  renderStats();
  $('ag-clock').textContent = now();
  $('ag-shift-button').addEventListener('click', shiftWorkload);

  // Seed audit log with a couple opening events so it isn't empty at first render
  logEvent('system', 'gateway.boot', 'Agent Gateway v2.7', 'ALLOW');
  logEvent('system', 'policy.load', '5 MCP servers, 6 agents, 3 models', 'ALLOW');

  // Start the tick loop
  setInterval(tick, 500);
}

init();
