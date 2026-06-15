/**
 * Safe parsing of LLM JSON output. Models often wrap JSON in ```json fences or
 * add stray prose, so strip those before parsing. Returns null on failure —
 * callers decide on a fallback rather than crashing the handler.
 */
export function parseLlmJson<T>(raw: string): T | null {
  if (!raw) return null;

  let text = raw.trim();

  // Strip ```json ... ``` or ``` ... ``` fences.
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence?.[1]) text = fence[1].trim();

  // Fall back to the first {...} block if there is surrounding prose.
  if (!text.startsWith("{") && !text.startsWith("[")) {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end > start) text = text.slice(start, end + 1);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
