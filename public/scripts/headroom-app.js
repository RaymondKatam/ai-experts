// Context compression demo (Headroom-inspired)
// Applies four progressive compression passes with live token counts,
// plus a meaning-preserved check via /api/embed.
// Loads gpt-tokenizer via UMD bundle (same pattern as tokenizer-visual post).

const statusEl = document.getElementById('hr-status');
const inputEl = document.getElementById('hr-input');
const passesEl = document.getElementById('hr-passes');
const meaningEl = document.getElementById('hr-meaning');
const checkBtn = document.getElementById('hr-check');
const similarityResultEl = document.getElementById('hr-similarity-result');

let encode = null;
let decode = null;

// ==================== EXAMPLES ====================
const EXAMPLES = {
  python: `# Fibonacci calculator using dynamic programming
# Handles both small and large inputs efficiently
# Author: Raymond Kipngetich
# Date: 2026-06-22

import os
import sys
import json
import logging
from typing import Optional
from functools import lru_cache

logger = logging.getLogger(__name__)

def calculate_fibonacci(n: int) -> int:
    """
    Calculate the nth Fibonacci number.
    Uses iterative approach to avoid recursion depth issues.
    """
    logger.info(f"Calculating fib for n={n}")
    # Handle base cases
    if n <= 1:
        logger.debug("Returning base case")
        return n
    # Build up from bottom
    a, b = 0, 1
    for i in range(2, n + 1):
        logger.debug(f"Iteration {i}")
        a, b = b, a + b
    logger.info(f"Result: {b}")
    return b

def main():
    try:
        n = int(sys.argv[1]) if len(sys.argv) > 1 else 10
        result = calculate_fibonacci(n)
        print(f"fib({n}) = {result}")
    except ValueError as e:
        logger.error(f"Invalid input: {e}")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()`,

  react: `// UserProfile component
// Displays user information and edit controls
// Handles loading and error states

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import styled from 'styled-components';
import { toast } from 'react-toastify';

const ProfileContainer = styled.div\`
  padding: 2rem;
  max-width: 800px;
  margin: 0 auto;
\`;

export function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchUser() {
      try {
        setLoading(true);
        const response = await axios.get(\`/api/users/\${userId}\`);
        setUser(response.data);
      } catch (err) {
        setError(err.message);
        toast.error('Failed to load user');
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
  }, [userId]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!user) return null;

  return (
    <ProfileContainer>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
      <button onClick={() => navigate('/edit')}>Edit Profile</button>
    </ProfileContainer>
  );
}`,

  prose: `The most important thing to understand about lithography is that it is not really about light.

It is about a chain of physical processes so tightly coordinated that the entire modern chip industry depends on their reliable execution, fifty thousand times per second, inside vacuum chambers the size of a small bedroom. Every AI accelerator manufactured in 2026 traces back to this chain.

At one end of the chain, molten tin droplets fall through a chamber. Each droplet is roughly twenty-five micrometers across. They travel at seventy meters per second, timed to arrive at a specific point in space at a specific moment.

At the other end, a beam of extreme ultraviolet light exits and hits a wafer, patterning features seven nanometers wide onto silicon. The wavelength of the light is thirteen point five nanometers.

Between these two endpoints, a 30-kilowatt laser vaporizes each droplet into a plasma forty times hotter than the surface of the sun. The plasma emits the EUV light. Precision mirrors focus it. Everything happens in vacuum because at 13.5 nm wavelength, air absorbs the beam.

The whole process is invisible. The chamber is opaque. There are no photographs of the plasma because it emits mostly at wavelengths cameras cannot record. Everything we know about what happens inside comes from instruments measuring second-order effects.

And yet, sixty of these machines are built per year, worldwide, and out the other end come the chips that train frontier AI models.`,
};

// ==================== LOAD TOKENIZER ====================
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('script load failed: ' + src));
    document.head.appendChild(s);
  });
}

async function init() {
  try {
    statusEl.textContent = 'Loading GPT-4o tokenizer (~1.5MB)...';
    await loadScript('https://unpkg.com/gpt-tokenizer@2.8.1/dist/o200k_base.js');
    const lib = window.GPTTokenizer_o200k_base;
    if (!lib || typeof lib.encode !== 'function') {
      throw new Error('tokenizer library loaded but exports missing');
    }
    encode = lib.encode;
    decode = lib.decode;
    statusEl.textContent = 'Ready. Paste code or text above, or try an example.';
    // Kick off with the python example so the first view isn't empty
    inputEl.value = EXAMPLES.python;
    renderAll();
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Failed to load tokenizer: ' + err.message;
  }
}

// ==================== TOKEN COUNTER ====================
function countTokens(text) {
  if (!encode || !text) return 0;
  return encode(text).length;
}

// ==================== COMPRESSION PASSES ====================

// Pass 1: whitespace & comments
function pass1(text, mode) {
  let out = text;

  // Remove trailing whitespace on each line
  out = out.replace(/[ \t]+$/gm, '');

  // Collapse multiple blank lines into one
  out = out.replace(/\n\s*\n\s*\n+/g, '\n\n');

  if (mode !== 'prose') {
    // Remove # comments (Python, shell) — but not shebang
    out = out.replace(/^(?!#!)\s*#.*$/gm, '');
    // Remove // comments (JS, C, C++)
    out = out.replace(/^\s*\/\/.*$/gm, '');
    // Remove inline // comments (but preserve URLs)
    out = out.replace(/([^:])\s+\/\/[^\n]*$/gm, '$1');
    // Remove /* ... */ block comments
    out = out.replace(/\/\*[\s\S]*?\*\//g, '');
    // Clean up now-empty lines
    out = out.replace(/^[ \t]*\n/gm, '');
  }

  return out.trim();
}

// Pass 2: boilerplate elimination
function pass2(text, mode) {
  let out = text;
  if (mode === 'prose') return out;

  // Collapse consecutive import lines: keep first, mark the rest
  // Detect import/require/from/using blocks (3+ lines)
  const lines = out.split('\n');
  const result = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // Detect start of an import block
    if (/^(import|from|require|using|include)\s/.test(line.trim())) {
      const importBlock = [];
      let j = i;
      while (j < lines.length && (/^(import|from|require|using|include)\s/.test(lines[j].trim()) || lines[j].trim() === '')) {
        if (lines[j].trim()) importBlock.push(lines[j]);
        j++;
      }
      if (importBlock.length >= 3) {
        // Collapse into a summary
        result.push('# [' + importBlock.length + ' imports]');
      } else {
        result.push(...importBlock);
      }
      i = j;
      continue;
    }
    // Remove common verbose logging patterns
    if (/^\s*(logger\.(debug|info|warn|error)|log\.(debug|info|warn|error)|console\.(log|debug|info))\s*\(/.test(line)) {
      // Skip these logging lines entirely
      i++;
      continue;
    }
    result.push(line);
    i++;
  }
  out = result.join('\n');

  // Collapse repetitive try/except patterns:
  // Replace multiple identical error-handling blocks with a single occurrence
  out = out.replace(/(except\s+\w+\s+as\s+\w+:\s*[\r\n]+[^\n]+[\r\n]+\s*sys\.exit\(\d+\))\s*[\r\n]+\s*except\s+\w+\s+as\s+\w+:\s*[\r\n]+[^\n]+[\r\n]+\s*sys\.exit\(\d+\)/g, '$1  # [+ 1 similar]');

  // Collapse styled-components / template literal blocks that span many lines
  // (heuristic: replace multi-line backtick blocks assigned to a variable with placeholder)
  out = out.replace(/=\s*styled\.(\w+)`[^`]{80,}`/g, '= styled.$1`[...]`');

  // Clean up now-empty lines
  out = out.replace(/^[ \t]*\n/gm, '');

  return out.trim();
}

// Pass 3: semantic chunking with keyword-frequency heuristic
function pass3(text, mode) {
  // Split into chunks by function boundaries or paragraph breaks
  const chunks = splitIntoChunks(text, mode);
  if (chunks.length <= 2) return text; // Nothing to select from

  // Extract high-frequency content words as pseudo-relevance signal
  const wordFreq = {};
  const words = text.toLowerCase().match(/[a-z_][a-z0-9_]{3,}/g) || [];
  const STOP = new Set(['this', 'that', 'with', 'from', 'have', 'been', 'were', 'they', 'their', 'them', 'what', 'when', 'where', 'which', 'would', 'could', 'should', 'about', 'into', 'onto', 'return', 'import', 'export', 'const', 'function', 'class', 'def', 'true', 'false', 'null', 'none', 'self', 'this']);
  for (const w of words) {
    if (STOP.has(w)) continue;
    wordFreq[w] = (wordFreq[w] || 0) + 1;
  }
  // Take top 15 words as "topics"
  const topics = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(x => x[0]);

  // Score each chunk by topic keyword hits (density-normalized)
  const scored = chunks.map(c => {
    const text = c.toLowerCase();
    let hits = 0;
    for (const t of topics) {
      const matches = text.match(new RegExp('\\b' + t + '\\b', 'g'));
      hits += matches ? matches.length : 0;
    }
    const tokenCount = countTokens(c) || 1;
    return { chunk: c, score: hits / Math.sqrt(tokenCount) };
  });

  // Keep top 60% of chunks by score
  scored.sort((a, b) => b.score - a.score);
  const keepCount = Math.max(1, Math.ceil(scored.length * 0.6));
  const kept = new Set(scored.slice(0, keepCount).map(x => x.chunk));
  const result = chunks.filter(c => kept.has(c));
  return result.join(mode === 'prose' ? '\n\n' : '\n\n');
}

function splitIntoChunks(text, mode) {
  if (mode === 'prose') {
    return text.split(/\n\s*\n+/).filter(x => x.trim());
  }
  // For code: split by function/class definitions
  const chunks = [];
  const lines = text.split('\n');
  let current = [];
  for (const line of lines) {
    if (/^(def |class |function |export function |const \w+ = |async function |export const )/.test(line) && current.length > 0) {
      chunks.push(current.join('\n'));
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) chunks.push(current.join('\n'));
  return chunks.filter(c => c.trim());
}

// Pass 4: reference substitution
function pass4(text, mode) {
  // Find repeated substrings of length 15+ that occur 2+ times
  const substrings = findRepeatedSubstrings(text, 15, 2);
  if (substrings.length === 0) return text;

  let out = text;
  const references = [];
  let refIndex = 1;
  for (const s of substrings) {
    // Escape for regex use
    const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const marker = `<REF_${refIndex}>`;
    const beforeCount = countTokens(out);
    const testOut = out.replace(new RegExp(escaped, 'g'), marker);
    // Only substitute if it actually saves tokens net of the reference table entry
    const afterCount = countTokens(testOut) + countTokens(`${marker} = ${s}`);
    if (afterCount < beforeCount) {
      out = testOut;
      references.push(`${marker} = ${s.replace(/\n/g, '\\n').slice(0, 60)}${s.length > 60 ? '...' : ''}`);
      refIndex++;
      if (refIndex > 5) break; // Cap at 5 references for readability
    }
  }
  if (references.length === 0) return text;
  const header = '# Reference table:\n# ' + references.join('\n# ') + '\n\n';
  return header + out;
}

function findRepeatedSubstrings(text, minLen, minOccur) {
  const candidates = new Map();
  const window = 30;
  for (let i = 0; i <= text.length - window; i++) {
    const s = text.substring(i, i + window).trim();
    if (s.length < minLen) continue;
    if (/^\s*$/.test(s)) continue;
    candidates.set(s, (candidates.get(s) || 0) + 1);
  }
  const found = [];
  for (const [s, count] of candidates) {
    if (count >= minOccur) found.push(s);
  }
  // Sort by potential savings (occurrences \u00d7 length)
  found.sort((a, b) => (b.length * (candidates.get(b) - 1)) - (a.length * (candidates.get(a) - 1)));
  return found.slice(0, 5);
}

// ==================== RENDER ====================
function detectMode(text) {
  if (/^(import\s|from\s|def\s|class\s)/m.test(text)) return 'python';
  if (/^(import\s|export\s|const\s|function\s|let\s|var\s)/m.test(text)) return 'react';
  return 'prose';
}

let originalText = '';
let compressedText = '';

function renderAll() {
  if (!encode) return;
  originalText = inputEl.value;
  if (!originalText.trim()) {
    passesEl.innerHTML = '<div style="color: #94a3b8; font-family: \'JetBrains Mono\', monospace; font-size: 0.85rem; padding: 1rem; text-align: center;">Paste something above to see compression in action.</div>';
    meaningEl.style.display = 'none';
    return;
  }
  const mode = detectMode(originalText);
  const originalCount = countTokens(originalText);

  const passes = [
    { name: 'Original',                           text: originalText,       real: true },
    { name: 'Pass 1: whitespace & comments',      text: null,               real: true },
    { name: 'Pass 2: boilerplate elimination',    text: null,               real: true },
    { name: 'Pass 3: semantic chunking',          text: null,               real: false },
    { name: 'Pass 4: reference substitution',     text: null,               real: false },
  ];

  passes[1].text = pass1(passes[0].text, mode);
  passes[2].text = pass2(passes[1].text, mode);
  passes[3].text = pass3(passes[2].text, mode);
  passes[4].text = pass4(passes[3].text, mode);

  compressedText = passes[4].text;

  const html = passes.map((p, i) => {
    const count = countTokens(p.text);
    const savedPct = i === 0 ? 0 : Math.round((1 - count / originalCount) * 100);
    const diff = i === 0 ? 0 : (i > 0 ? countTokens(passes[i-1].text) - count : 0);
    const isOriginal = i === 0;
    const barPct = i === 0 ? 100 : (count / originalCount * 100);
    const barColor = isOriginal ? '#94a3b8' : savedPct >= 30 ? '#10b981' : savedPct >= 15 ? '#2563eb' : '#f59e0b';
    const savedBadge = isOriginal
      ? ''
      : `<span style="font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: ${barColor}; font-weight: 600; margin-left: 0.5rem;">\u2212${savedPct}%</span>`;
    const realBadge = p.real === false
      ? '<span style="font-family: \'JetBrains Mono\', monospace; font-size: 0.6rem; color: #a855f7; margin-left: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">illustrative</span>'
      : '';
    // Diff badge if this pass alone removed a chunk
    const stepBadge = isOriginal ? '' : (diff > 0 ? `<span style="font-family: 'JetBrains Mono', monospace; font-size: 0.7rem; color: #64748b; margin-left: 0.5rem;">this pass: \u2212${diff} tok</span>` : '');
    return `<div style="margin-bottom: 0.85rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.3rem;">
        <span>
          <span style="font-family: 'JetBrains Mono', monospace; font-size: 0.78rem; color: #0c2461; font-weight: 600;">${p.name}</span>
          ${realBadge}
        </span>
        <span>
          <span style="font-family: 'JetBrains Mono', monospace; font-size: 0.78rem; color: #0a1628; font-weight: 600;">${count} tok</span>
          ${savedBadge}
          ${stepBadge}
        </span>
      </div>
      <div style="background: #f1f5f9; border-radius: 3px; height: 10px; overflow: hidden;">
        <div style="background: ${barColor}; height: 100%; width: ${barPct}%; transition: width 0.4s ease;"></div>
      </div>
    </div>`;
  }).join('');

  passesEl.innerHTML = html;
  meaningEl.style.display = 'block';
  // Reset similarity result when input changes
  similarityResultEl.innerHTML = 'Press "Run cosine similarity" to check if the original and compressed versions still mean the same thing.';
  similarityResultEl.style.color = '#64748b';
}

// ==================== MEANING-PRESERVED CHECK ====================
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

async function runSimilarityCheck() {
  if (!originalText || !compressedText) return;
  checkBtn.disabled = true;
  const originalBtnLabel = checkBtn.textContent;
  checkBtn.textContent = 'Embedding...';
  similarityResultEl.innerHTML = 'Sending both versions to /api/embed...';
  similarityResultEl.style.color = '#64748b';
  try {
    // Cap each input to 1000 chars (embed endpoint limit)
    const truncOrig = originalText.slice(0, 1000);
    const truncComp = compressedText.slice(0, 1000);
    const vectors = await embedTexts([truncOrig, truncComp]);
    const sim = cosineSim(vectors[0], vectors[1]);
    let verdict, color;
    if (sim >= 0.9) {
      verdict = '<b>Semantically nearly identical.</b> Safe to use the compressed version.';
      color = '#10b981';
    } else if (sim >= 0.75) {
      verdict = '<b>Significant compression, core meaning retained.</b> Usually acceptable, verify task-specifically.';
      color = '#2563eb';
    } else {
      verdict = '<b>Too aggressive.</b> Meaning has drifted. Compressed version cannot substitute for the original.';
      color = '#dc2626';
    }
    similarityResultEl.innerHTML = `<span style="color: ${color}; font-weight: 600;">Cosine similarity: ${sim.toFixed(3)}</span> \u00b7 ${verdict}`;
    similarityResultEl.style.color = '#334155';
  } catch (err) {
    similarityResultEl.innerHTML = 'Check failed: ' + err.message + '. The /api/embed endpoint may only work in production.';
    similarityResultEl.style.color = '#dc2626';
  }
  checkBtn.disabled = false;
  checkBtn.textContent = originalBtnLabel;
}

// ==================== EVENTS ====================
let debounceId = null;
inputEl.addEventListener('input', () => {
  if (debounceId) clearTimeout(debounceId);
  debounceId = setTimeout(renderAll, 250);
});

document.querySelectorAll('.hr-example').forEach(btn => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.example;
    if (EXAMPLES[key]) {
      inputEl.value = EXAMPLES[key];
      renderAll();
    }
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

checkBtn.addEventListener('click', runSimilarityCheck);

init();
