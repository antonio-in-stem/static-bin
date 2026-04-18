<script lang="ts">
  /**
   * StaticBin playground · Svelte 5 runes island.
   *
   * Derived values stay pure · each row is a liquid-glass card with a
   * kind-specific color accent · entry/exit animated via fly + flip.
   */
  import { fly, scale } from "svelte/transition";
  import { flip } from "svelte/animate";
  import { quintOut } from "svelte/easing";
  import {
    encodeBitfield,
    encodeSmallInts,
    encodeIntegers,
    encodeText,
    stream,
    toBase64Url,
    decodeStream,
  } from "../lib/staticbin";

  type Kind = "bitfield" | "smallints" | "integers" | "text";

  interface Row {
    id: number;
    kind: Kind;
    input: string;
    width: number;
  }

  interface KindMeta {
    label: string;
    hint: string;
    tint: string; // css color string
    accent: string; // rgba for tinted bg
  }

  const KIND_META: Record<Kind, KindMeta> = {
    bitfield:  { label: "Bitfield",   hint: "comma-separated true / false", tint: "#6ab3ff", accent: "rgba(41,151,255,0.14)" },
    smallints: { label: "Small ints", hint: "fixed-width positive ints",    tint: "#d4b67f", accent: "rgba(198,168,119,0.14)" },
    integers:  { label: "Integers",   hint: "Elias-gamma, any size",        tint: "#8eeaa8", accent: "rgba(50,215,75,0.12)" },
    text:      { label: "Text",       hint: "ASCII string, 8b per char",    tint: "#d4a0ff", accent: "rgba(180,120,255,0.12)" },
  };

  const initialRows: Row[] = [
    { id: 1, kind: "bitfield",  input: "true, false, true, true", width: 1 },
    { id: 2, kind: "smallints", input: "42, 7, 255, 0",            width: 8 },
    { id: 3, kind: "integers",  input: "1, 2, 3, 5, 8, 13, 21",    width: 0 },
  ];

  let rows = $state<Row[]>(initialRows.map((r) => ({ ...r })));
  let nextId = $state(rows.length + 1);
  let copied = $state(false);

  function encodeRow(row: Row): string {
    if (row.kind === "bitfield") {
      const flags = row.input
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
        .map((s) => {
          if (s === "true" || s === "1") return true;
          if (s === "false" || s === "0") return false;
          throw new Error(`unrecognised bit value "${s}"`);
        });
      return encodeBitfield(flags);
    }
    if (row.kind === "smallints") {
      return encodeSmallInts(parseInts(row.input), row.width);
    }
    if (row.kind === "integers") {
      return encodeIntegers(parseInts(row.input));
    }
    return encodeText(row.input);
  }

  function parseInts(input: string): number[] {
    return input
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const n = Number(s);
        if (!Number.isInteger(n)) throw new Error(`"${s}" is not an integer`);
        return n;
      });
  }

  const encoded = $derived.by(() => {
    try {
      const parts = rows.map(encodeRow);
      const bits = stream(parts);
      return { ok: true as const, bits, token: toBase64Url(bits), parts };
    } catch (err) {
      return { ok: false as const, error: (err as Error).message };
    }
  });

  const decoded = $derived.by(() => {
    if (!encoded.ok) return null;
    try {
      return decodeStream(encoded.token).map((s, i) => ({
        index: i + 1,
        mode:
          s.mode === "01" ? "FIXED" : s.mode === "10" ? "DYNAMIC" : "INTEGER",
        width: s.width,
        count: s.chunks.length,
        chunks: s.chunks.slice(0, 10),
        truncated: s.chunks.length > 10,
      }));
    } catch {
      return null;
    }
  });

  const sizeHint = $derived(
    encoded.ok ? { bits: encoded.bits.length, chars: encoded.token.length } : { bits: 0, chars: 0 },
  );

  function addRow(kind: Kind) {
    const defaults: Record<Kind, Omit<Row, "id" | "kind">> = {
      bitfield:  { input: "true, false, true", width: 1 },
      smallints: { input: "1, 2, 3",           width: 4 },
      integers:  { input: "1, 1, 2, 3, 5",     width: 0 },
      text:      { input: "hello",             width: 8 },
    };
    rows = [...rows, { id: nextId, kind, ...defaults[kind] }];
    nextId += 1;
  }

  function removeRow(id: number) {
    if (rows.length <= 1) return;
    rows = rows.filter((r) => r.id !== id);
  }

  function reset() {
    rows = initialRows.map((r) => ({ ...r }));
    nextId = rows.length + 1;
  }

  function bumpWidth(row: Row, delta: number) {
    const next = Math.max(1, Math.min(32, row.width + delta));
    row.width = next;
  }

  async function copyToken() {
    if (!encoded.ok) return;
    try {
      await navigator.clipboard.writeText(encoded.token);
      copied = true;
      setTimeout(() => (copied = false), 1400);
    } catch {
      /* ignore */
    }
  }
</script>

<div class="pg liquid-glass">
  <header class="pg-stats">
    <div class="pg-stat">
      <span class="pg-stat-k">token length</span>
      <span class="pg-stat-v">{sizeHint.chars}<small>ch</small></span>
    </div>
    <div class="pg-stat-sep" aria-hidden="true"></div>
    <div class="pg-stat">
      <span class="pg-stat-k">bits on the wire</span>
      <span class="pg-stat-v">{sizeHint.bits}<small>b</small></span>
    </div>
    <div class="pg-stat-sep" aria-hidden="true"></div>
    <div class="pg-stat">
      <span class="pg-stat-k">sections</span>
      <span class="pg-stat-v">{rows.length}</span>
    </div>
    <button class="pg-btn-icon" type="button" onclick={reset} aria-label="Reset">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>
      Reset
    </button>
  </header>

  <div class="pg-rows">
    {#each rows as row (row.id)}
      {@const meta = KIND_META[row.kind]}
      <div
        class="pg-row"
        style={`--tint: ${meta.tint}; --tint-bg: ${meta.accent};`}
        animate:flip={{ duration: 380, easing: quintOut }}
        in:fly={{ y: 14, duration: 380, easing: quintOut }}
        out:scale={{ duration: 240, easing: quintOut, start: 0.94 }}
      >
        <div class="pg-row-kind">
          <div class="pg-kind-badge" aria-hidden="true">
            <span class="pg-kind-swatch"></span>
            <span class="pg-kind-label">{meta.label}</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>
          </div>
          <select bind:value={row.kind} aria-label="section kind">
            <option value="bitfield">Bitfield</option>
            <option value="smallints">Small ints</option>
            <option value="integers">Integers</option>
            <option value="text">Text</option>
          </select>
        </div>

        <div class="pg-row-main">
          <input
            class="pg-row-input"
            type="text"
            bind:value={row.input}
            spellcheck="false"
            autocomplete="off"
            aria-label={`${meta.label} values`}
          />
          <span class="pg-row-hint">{meta.hint}</span>
        </div>

        {#if row.kind === "smallints"}
          <div class="pg-row-width">
            <span class="pg-row-width-label">width</span>
            <button class="pg-step" type="button" onclick={() => bumpWidth(row, -1)} aria-label="Decrease width">−</button>
            <input type="number" min="1" max="32" bind:value={row.width} />
            <button class="pg-step" type="button" onclick={() => bumpWidth(row, 1)} aria-label="Increase width">+</button>
            <span class="pg-row-width-suffix">bits</span>
          </div>
        {/if}

        <button
          class="pg-row-remove"
          type="button"
          aria-label="Remove section"
          onclick={() => removeRow(row.id)}
          disabled={rows.length <= 1}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14"/></svg>
        </button>
      </div>
    {/each}
  </div>

  <div class="pg-add">
    <span class="pg-add-label">append</span>
    {#each Object.entries(KIND_META) as [kind, meta]}
      <button
        type="button"
        class="pg-chip"
        style={`--tint: ${meta.tint};`}
        onclick={() => addRow(kind as Kind)}
      >
        <span class="pg-chip-swatch" aria-hidden="true"></span>
        {meta.label}
      </button>
    {/each}
  </div>

  <div class="pg-output">
    {#if !encoded.ok}
      <div class="pg-error" role="alert">
        <strong>That input won't encode.</strong>
        <span>{encoded.error}</span>
      </div>
    {:else}
      <button type="button" class="pg-token" onclick={copyToken} aria-label="Copy token to clipboard">
        <div class="pg-token-head">
          <span class="pg-label">base64url</span>
          <span class="pg-token-copy">
            {#if copied}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l6 6L20 6"/></svg>
              copied
            {:else}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/></svg>
              click to copy
            {/if}
          </span>
        </div>
        <code class="pg-token-val">{encoded.token}</code>
      </button>

      <details class="pg-bits">
        <summary>
          <span class="pg-label">bitstream</span>
          <span class="pg-bits-count">{encoded.bits.length} bits</span>
        </summary>
        <code class="pg-bits-val">{encoded.bits}</code>
      </details>

      {#if decoded}
        <div class="pg-decoded">
          <div class="pg-label pg-decoded-label">round-trip decode</div>
          <ul class="pg-decoded-list">
            {#each decoded as s}
              <li>
                <span class="pg-d-idx">#{s.index}</span>
                <span class="pg-d-mode">{s.mode}{s.width != null ? ` · w=${s.width}` : ""}</span>
                <span class="pg-d-chunks">[{s.chunks.join(", ")}{s.truncated ? ", …" : ""}]</span>
                <span class="pg-d-count">{s.count} chunks</span>
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .pg {
    padding: clamp(1.25rem, 2.5vw, 2rem);
  }

  /* ── stats row ─────────────────────────────────────── */
  .pg-stats {
    display: flex;
    align-items: center;
    gap: clamp(1rem, 2.5vw, 2rem);
    padding-bottom: 1.5rem;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
  }
  .pg-stat { display: flex; flex-direction: column; gap: 0.2rem; }
  .pg-stat-k {
    font-size: 11.5px;
    font-weight: 500;
    color: var(--color-ink-400);
    letter-spacing: -0.005em;
  }
  .pg-stat-v {
    font-family: var(--font-display);
    font-size: 2.2rem;
    line-height: 1;
    color: var(--color-ink-50);
    font-style: italic;
    font-weight: 500;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
  }
  .pg-stat-v small {
    font-family: var(--font-sans);
    font-size: 12px;
    color: var(--color-ink-400);
    margin-left: 4px;
    font-weight: 400;
    font-style: normal;
    letter-spacing: -0.005em;
  }
  .pg-stat-sep {
    width: 1px;
    height: 28px;
    background: rgba(255,255,255,0.08);
  }

  .pg-btn-icon {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: transparent;
    border: 1px solid rgba(255,255,255,0.08);
    color: var(--color-ink-100);
    border-radius: 999px;
    padding: 0.5rem 0.9rem;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 220ms var(--ease-out-quint);
    letter-spacing: -0.005em;
  }
  .pg-btn-icon:hover {
    background: rgba(255,255,255,0.05);
    border-color: rgba(255,255,255,0.18);
    transform: translateY(-1px);
  }

  /* ── row cards ─────────────────────────────────────── */
  .pg-rows {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
    margin-bottom: 1.25rem;
  }

  .pg-row {
    display: grid;
    grid-template-columns: 180px 1fr auto auto;
    gap: 0.85rem;
    align-items: center;
    padding: 0.85rem 0.9rem 0.85rem 1rem;
    background:
      linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.01)),
      var(--tint-bg, rgba(255,255,255,0.01));
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 14px;
    position: relative;
    transition: border-color 280ms, transform 280ms var(--ease-out-quint), box-shadow 280ms;
  }
  .pg-row::before {
    content: "";
    position: absolute;
    left: 0; top: 16%; bottom: 16%;
    width: 3px;
    border-radius: 999px;
    background: var(--tint);
    opacity: 0.55;
    transition: opacity 240ms;
  }
  .pg-row:focus-within {
    border-color: color-mix(in oklab, var(--tint) 55%, transparent);
    box-shadow: 0 0 0 4px color-mix(in oklab, var(--tint) 12%, transparent);
  }
  .pg-row:focus-within::before { opacity: 1; }

  /* kind dropdown · native select styled as badge */
  .pg-row-kind {
    position: relative;
    display: block;
  }
  .pg-kind-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    padding: 0.45rem 0.8rem;
    border-radius: 999px;
    background: rgba(255,255,255,0.045);
    border: 1px solid rgba(255,255,255,0.08);
    font-size: 13px;
    font-weight: 500;
    color: var(--color-ink-50);
    cursor: pointer;
    transition: background 200ms, border-color 200ms;
    width: 100%;
    min-width: 0;
  }
  .pg-kind-badge:hover {
    background: rgba(255,255,255,0.07);
    border-color: rgba(255,255,255,0.16);
  }
  .pg-kind-swatch {
    width: 10px;
    height: 10px;
    border-radius: 999px;
    background: var(--tint);
    box-shadow: 0 0 10px color-mix(in oklab, var(--tint) 60%, transparent);
    flex-shrink: 0;
  }
  .pg-kind-label {
    letter-spacing: -0.005em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .pg-kind-badge svg {
    margin-left: auto;
    color: var(--color-ink-400);
    flex-shrink: 0;
  }
  .pg-row-kind select {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
    font: inherit;
    width: 100%;
    color-scheme: dark;
  }
  .pg-row-kind select:focus-visible + .pg-kind-badge {
    outline: 2px solid var(--tint);
    outline-offset: 2px;
  }
  /* Native popup styling · keeps the OS-dark menu uniform */
  .pg-row-kind select option {
    background-color: #18181b;
    color: #f5f5f7;
    padding: 8px 10px;
  }

  /* input + hint */
  .pg-row-main {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    min-width: 0;
  }
  .pg-row-input {
    background: rgba(0,0,0,0.25);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 9px;
    padding: 0.6rem 0.8rem;
    color: var(--color-ink-50);
    font-size: 13.5px;
    font-family: var(--font-mono);
    width: 100%;
    transition: border-color 150ms, background 150ms;
    letter-spacing: -0.002em;
  }
  .pg-row-input::placeholder { color: var(--color-ink-500); }
  .pg-row-input:focus {
    outline: none;
    border-color: var(--tint);
    background: rgba(0,0,0,0.35);
  }
  .pg-row-hint {
    font-size: 11.25px;
    color: var(--color-ink-400);
    padding-inline: 0.15rem;
    letter-spacing: -0.005em;
  }

  /* width stepper */
  .pg-row-width {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.3rem 0.55rem;
    background: rgba(0,0,0,0.25);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 999px;
  }
  .pg-row-width-label {
    font-size: 11px;
    color: var(--color-ink-400);
    margin-right: 0.15rem;
    letter-spacing: -0.005em;
  }
  .pg-row-width-suffix {
    font-size: 11px;
    color: var(--color-ink-400);
    margin-left: 0.1rem;
    letter-spacing: -0.005em;
  }
  .pg-row-width input {
    width: 36px;
    text-align: center;
    background: transparent;
    border: 0;
    color: var(--color-ink-50);
    font-family: var(--font-mono);
    font-size: 13px;
    padding: 0.2rem 0;
    -moz-appearance: textfield;
  }
  .pg-row-width input::-webkit-outer-spin-button,
  .pg-row-width input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .pg-row-width input:focus { outline: none; }
  .pg-step {
    width: 22px;
    height: 22px;
    border-radius: 999px;
    border: 1px solid rgba(255,255,255,0.08);
    background: transparent;
    color: var(--color-ink-100);
    font-size: 14px;
    line-height: 1;
    cursor: pointer;
    transition: all 160ms;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .pg-step:hover { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.18); }

  /* remove button */
  .pg-row-remove {
    width: 34px;
    height: 34px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 999px;
    color: var(--color-ink-400);
    cursor: pointer;
    transition: all 200ms;
  }
  .pg-row-remove:hover:not(:disabled) {
    color: var(--color-ink-50);
    background: rgba(255,255,255,0.05);
    border-color: rgba(255,255,255,0.1);
  }
  .pg-row-remove:disabled { opacity: 0.3; cursor: not-allowed; }

  /* ── add row chips ─────────────────────────────────── */
  .pg-add {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
    padding: 1.1rem 0;
    margin-bottom: 0.25rem;
    border-top: 1px solid rgba(255,255,255,0.05);
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }
  .pg-add-label {
    font-size: 11.5px;
    color: var(--color-ink-400);
    margin-right: 0.45rem;
    letter-spacing: -0.005em;
  }
  .pg-chip {
    background: rgba(255,255,255,0.025);
    border: 1px solid rgba(255,255,255,0.08);
    color: var(--color-ink-100);
    border-radius: 999px;
    padding: 0.45rem 0.9rem 0.45rem 0.7rem;
    font-size: 12.5px;
    font-weight: 500;
    cursor: pointer;
    transition: all 220ms var(--ease-out-quint);
    letter-spacing: -0.005em;
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
  }
  .pg-chip:hover {
    border-color: color-mix(in oklab, var(--tint) 50%, transparent);
    background: color-mix(in oklab, var(--tint) 12%, transparent);
    color: var(--color-ink-50);
    transform: translateY(-1px);
  }
  .pg-chip-swatch {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: var(--tint);
    box-shadow: 0 0 8px color-mix(in oklab, var(--tint) 60%, transparent);
  }

  /* ── outputs ───────────────────────────────────────── */
  .pg-output {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-top: 1.25rem;
  }

  .pg-label {
    font-size: 11.5px;
    color: var(--color-ink-400);
    font-weight: 500;
    letter-spacing: -0.005em;
  }

  .pg-token {
    width: 100%;
    text-align: left;
    background:
      linear-gradient(180deg, rgba(41,151,255,0.08), rgba(41,151,255,0.02));
    border: 1px solid rgba(41,151,255,0.22);
    border-radius: 16px;
    padding: 1.1rem 1.4rem;
    cursor: copy;
    transition: border-color 220ms, background 220ms, transform 220ms var(--ease-out-quint);
    font: inherit;
    color: inherit;
  }
  .pg-token:hover {
    border-color: rgba(41,151,255,0.45);
    background:
      linear-gradient(180deg, rgba(41,151,255,0.1), rgba(41,151,255,0.03));
  }
  .pg-token:active { transform: scale(0.995); }
  .pg-token:focus-visible {
    outline: 2px solid var(--color-signal-500);
    outline-offset: 2px;
  }
  .pg-token-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }
  .pg-token-copy {
    font-size: 11.5px;
    color: var(--color-signal-300);
    letter-spacing: -0.005em;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }
  .pg-token-val {
    display: block;
    font-family: var(--font-mono);
    font-size: 17px;
    color: var(--color-signal-100);
    word-break: break-all;
    line-height: 1.5;
    user-select: all;
  }

  .pg-bits {
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 12px;
    overflow: hidden;
  }
  .pg-bits summary {
    padding: 0.85rem 1.2rem;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    list-style: none;
  }
  .pg-bits summary::-webkit-details-marker { display: none; }
  .pg-bits summary::after {
    content: "";
    width: 8px;
    height: 8px;
    border-right: 1.5px solid var(--color-ink-400);
    border-bottom: 1.5px solid var(--color-ink-400);
    transform: rotate(45deg);
    transition: transform 220ms;
  }
  .pg-bits[open] summary::after { transform: rotate(225deg); }
  .pg-bits-count { font-size: 11.5px; color: var(--color-ink-400); }
  .pg-bits-val {
    display: block;
    padding: 0.5rem 1.2rem 1.1rem;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-ink-200);
    word-break: break-all;
    line-height: 1.65;
    user-select: all;
  }

  .pg-decoded {
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 12px;
    padding: 1.1rem 1.3rem;
  }
  .pg-decoded-label { margin-bottom: 0.6rem; display: block; }
  .pg-decoded-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .pg-decoded-list li {
    display: grid;
    grid-template-columns: 30px 140px 1fr 80px;
    gap: 0.85rem;
    align-items: center;
    padding: 0.45rem 0;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    font-size: 12.5px;
  }
  .pg-decoded-list li:last-child { border-bottom: none; }
  .pg-d-idx { color: var(--color-ink-400); font-family: var(--font-mono); font-size: 11px; }
  .pg-d-mode { color: var(--color-signal-300); font-family: var(--font-mono); font-size: 11.5px; }
  .pg-d-chunks {
    color: var(--color-ink-100);
    font-family: var(--font-mono);
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pg-d-count { color: var(--color-ink-400); font-size: 11px; text-align: right; }

  .pg-error {
    background: rgba(255, 95, 95, 0.06);
    border: 1px solid rgba(255, 95, 95, 0.2);
    color: #f5b7b7;
    border-radius: 12px;
    padding: 1rem 1.3rem;
    display: flex;
    gap: 0.75rem;
    align-items: baseline;
    flex-wrap: wrap;
    font-size: 14px;
  }
  .pg-error strong { color: #ffc9c9; font-weight: 500; }

  /* ── mobile ────────────────────────────────────────── */
  @media (max-width: 720px) {
    .pg-stats { gap: 1rem 1.25rem; }
    .pg-stat-sep { display: none; }
    .pg-stat-v { font-size: 1.6rem; }
    .pg-btn-icon {
      margin-left: 0;
      flex-basis: 100%;
      justify-content: center;
      margin-top: 0.25rem;
    }
    .pg-row {
      grid-template-columns: 1fr auto;
      gap: 0.55rem;
      padding: 0.75rem 0.75rem 0.75rem 0.9rem;
    }
    .pg-row-kind { grid-column: 1 / 2; }
    .pg-row-remove { grid-column: 2 / 3; }
    .pg-row-main { grid-column: 1 / -1; }
    .pg-row-width { grid-column: 1 / -1; align-self: start; }
    .pg-decoded-list li {
      grid-template-columns: auto 1fr;
      gap: 0.4rem 0.6rem;
    }
    .pg-d-chunks { grid-column: 1 / -1; }
    .pg-d-count { grid-column: 1 / -1; text-align: left; }
  }
</style>
