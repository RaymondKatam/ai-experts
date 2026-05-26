// Interactive tokenizer visualization
// Loads gpt-tokenizer (GPT-4o encoding) and renders token breakdowns
// for two side-by-side text inputs.

const statusEl = document.getElementById('tok-status');
const leftInput = document.getElementById('tok-input-left');
const rightInput = document.getElementById('tok-input-right');
const resultsEl = document.getElementById('tok-results');
const summaryEl = document.getElementById('tok-summary');
const examplesContainer = document.getElementById('tok-examples');

let encode = null;
let decode = null;

// 10 distinct colors for token pills, cycled through.
// Soft palette so the page doesn't look like a Christmas tree.
const TOKEN_COLORS = [
  '#dbeafe', '#fce7f3', '#fef3c7', '#d1fae5', '#e0e7ff',
  '#fed7aa', '#cffafe', '#f5d0fe', '#fee2e2', '#ddd6fe',
];

async function init() {
  try {
    statusEl.textContent = 'Loading gpt-tokenizer (o200k_base, ~150KB)...';
    // o200k_base is the encoding used by gpt-4o.
    const mod = await import('https://cdn.jsdelivr.net/npm/gpt-tokenizer@2.5.2/esm/encoding/o200k_base.js');
    encode = mod.encode;
    decode = mod.decode;
    statusEl.textContent = 'Ready. Type in either box to see live tokenization.';
    render();
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Failed to load tokenizer: ' + err.message;
  }
}

function tokenize(text) {
  if (!text) return [];
  const ids = encode(text);
  // Decode each id back to its string piece so we can render the actual text.
  return ids.map((id) => ({ id, piece: decode([id]) }));
}

function renderTokens(tokens) {
  if (tokens.length === 0) {
    return '<div style="color:#94a3b8;font-family:\'JetBrains Mono\',monospace;font-size:0.85rem;padding:0.5rem;">empty</div>';
  }
  const pills = tokens.map((t, i) => {
    const color = TOKEN_COLORS[i % TOKEN_COLORS.length];
    // Display the actual token text. Replace leading space with a visible glyph,
    // newlines with ↵, so whitespace is visible.
    let display = t.piece
      .replace(/^ /, '·')           // leading space → middle dot
      .replace(/\n/g, '↵')          // newline → arrow
      .replace(/\t/g, '⇥');         // tab → arrow
    // Escape HTML
    display = display.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<span style="display:inline-block;background:${color};border:1px solid rgba(0,0,0,0.05);border-radius:4px;padding:0.2rem 0.45rem;margin:0.15rem 0.15rem 0.15rem 0;font-family:'JetBrains Mono',monospace;font-size:0.82rem;color:#0a1628;white-space:pre;" title="token id: ${t.id}">${display}</span>`;
  }).join('');
  return `<div style="line-height:1.8;">${pills}</div>`;
}

function renderColumn(label, count, content, accentColor) {
  return `
    <div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
        <span style="font-family:'JetBrains Mono',monospace;font-size:0.7rem;text-transform:uppercase;letter-spacing:0.1em;color:${accentColor};font-weight:600;">${label}</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:0.85rem;color:${accentColor};font-weight:600;">${count} tokens</span>
      </div>
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:4px;padding:0.6rem;min-height:60px;">
        ${content}
      </div>
    </div>
  `;
}

function render() {
  if (!encode) return;
  const leftText = leftInput.value;
  const rightText = rightInput.value;
  const leftTokens = tokenize(leftText);
  const rightTokens = tokenize(rightText);

  resultsEl.innerHTML =
    renderColumn('Correct', leftTokens.length, renderTokens(leftTokens), '#10b981') +
    renderColumn('Misspelled', rightTokens.length, renderTokens(rightTokens), '#dc2626');

  // Summary
  if (leftText.trim() === '' && rightText.trim() === '') {
    summaryEl.style.display = 'none';
    return;
  }
  summaryEl.style.display = 'block';
  const diff = rightTokens.length - leftTokens.length;
  const pctMore = leftTokens.length > 0
    ? Math.round((rightTokens.length / leftTokens.length - 1) * 100)
    : null;
  // GPT-4o pricing approx (May 2026): $2.50 / 1M input tokens.
  // If a user sent the misspelled version 1000 times instead of the correct one:
  const dollarCostExtra = (diff * 1000 / 1_000_000) * 2.5;

  let summaryText;
  if (diff > 0) {
    const pctText = pctMore !== null ? `, ${pctMore}% more` : '';
    summaryText = `<b>Misspelled costs ${diff} extra tokens</b>${pctText}. Send this 1,000 times: roughly $${dollarCostExtra.toFixed(4)} of waste at GPT-4o input pricing.`;
  } else if (diff < 0) {
    summaryText = `Misspelled actually costs ${-diff} <i>fewer</i> tokens (rare — usually means the "correct" text contains an even rarer word).`;
  } else {
    summaryText = `Both versions tokenize to the same number of tokens (${leftTokens.length}). Try one of the examples below to see the typical case.`;
  }
  summaryEl.innerHTML = summaryText;
}

// Debounced live update
let debounceId = null;
function scheduleRender() {
  if (debounceId) clearTimeout(debounceId);
  debounceId = setTimeout(render, 100);
}

leftInput.addEventListener('input', scheduleRender);
rightInput.addEventListener('input', scheduleRender);

// Example buttons
examplesContainer.querySelectorAll('.tok-example').forEach((btn) => {
  btn.addEventListener('click', () => {
    leftInput.value = btn.dataset.left;
    rightInput.value = btn.dataset.right;
    render();
  });
  btn.addEventListener('mouseover', () => {
    btn.style.background = '#eff4ff';
    btn.style.borderColor = '#2563eb';
  });
  btn.addEventListener('mouseout', () => {
    btn.style.background = '#fff';
    btn.style.borderColor = '#cbd5e1';
  });
});

init();
