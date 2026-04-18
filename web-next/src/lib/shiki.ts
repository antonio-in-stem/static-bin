/**
 * Shiki · build-time syntax highlighting with a shared singleton.
 * Custom theme derived from the StaticBin palette. Ships zero runtime JS.
 */

import {
  createHighlighter,
  type BundledLanguage,
  type Highlighter,
  type ThemeRegistrationRaw,
} from "shiki";

const THEME: ThemeRegistrationRaw = {
  name: "staticbin-steel",
  type: "dark",
  settings: [],
  colors: {
    "editor.background": "#0f1216",
    "editor.foreground": "#e6e9ef",
    "editorLineNumber.foreground": "#434a55",
    "editorBracketMatch.background": "#1e2530",
  },
  tokenColors: [
    { scope: ["comment", "punctuation.definition.comment"], settings: { foreground: "#6b7380", fontStyle: "italic" } },
    { scope: ["keyword", "storage.type", "storage.modifier"], settings: { foreground: "#a3c0d6" } },
    { scope: ["keyword.control"], settings: { foreground: "#7aa1bf" } },
    { scope: ["string", "string.quoted"], settings: { foreground: "#d4b67f" } },
    { scope: ["constant.numeric", "constant.language"], settings: { foreground: "#c6a877" } },
    { scope: ["entity.name.function", "support.function"], settings: { foreground: "#7aa1bf" } },
    { scope: ["entity.name.class", "entity.name.type"], settings: { foreground: "#c9cfd8" } },
    { scope: ["variable", "meta.definition.variable"], settings: { foreground: "#e6e9ef" } },
    { scope: ["variable.parameter"], settings: { foreground: "#c9cfd8", fontStyle: "italic" } },
    { scope: ["punctuation"], settings: { foreground: "#9aa3b0" } },
    { scope: ["markup.bold"], settings: { fontStyle: "bold" } },
    { scope: ["markup.italic"], settings: { fontStyle: "italic" } },
  ],
};

let highlighter: Highlighter | null = null;

// Shiki exposes Fortran under its "fortran-free-form" grammar name; we
// surface a short "fortran" alias for ergonomics.
export const SUPPORTED_LANGS = [
  "python",
  "javascript",
  "typescript",
  "c",
  "fortran-free-form",
  "bash",
  "json",
  "yaml",
] as const satisfies readonly BundledLanguage[];

export type ShikiLang = (typeof SUPPORTED_LANGS)[number] | "fortran";

const LANG_ALIAS: Record<string, (typeof SUPPORTED_LANGS)[number]> = {
  fortran: "fortran-free-form",
};

function resolveLang(lang: ShikiLang): (typeof SUPPORTED_LANGS)[number] {
  return (LANG_ALIAS[lang] ?? lang) as (typeof SUPPORTED_LANGS)[number];
}

export async function getHighlighter(): Promise<Highlighter> {
  if (highlighter) return highlighter;
  highlighter = await createHighlighter({
    themes: [THEME],
    langs: [...SUPPORTED_LANGS],
  });
  return highlighter;
}

export async function highlight(code: string, lang: ShikiLang): Promise<string> {
  const h = await getHighlighter();
  return h.codeToHtml(code, {
    lang: resolveLang(lang),
    theme: "staticbin-steel",
  });
}
