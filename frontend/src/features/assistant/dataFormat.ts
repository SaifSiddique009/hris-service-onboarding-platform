import { formatDay, label } from "../../lib/format";

const isEnum = (v: string) => /^[A-Z][A-Z_]{2,}$/.test(v);
const isDay = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

export function show(value: unknown, key = ""): string {
  if (value == null) return key === "title" ? "Withheld" : "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string")
    return isDay(value)
      ? formatDay(value)
      : isEnum(value)
        ? label(value)
        : value;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export const heading = (key: string) => {
  const text = key.replaceAll("_", " ").toLowerCase();
  return text[0].toUpperCase() + text.slice(1);
};

const singular = (word: string) =>
  word.endsWith("ies")
    ? `${word.slice(0, -3)}y`
    : word.endsWith("s") && !word.endsWith("ss")
      ? word.slice(0, -1)
      : word;

// "New hires with open requests" -> "new hire with open requests" when there is one.
function noun(name: string, count: number) {
  const text = name.toLowerCase();
  if (count === 1) {
    const [head, ...rest] = text.split(" with ");
    const words = head.split(" ");
    words[words.length - 1] = singular(words[words.length - 1]);
    return [words.join(" "), ...rest].join(" with ");
  }
  return text;
}

export function summary(tool: {
  label: string;
  total: number;
  arguments: Record<string, unknown>;
}) {
  const filters = Object.entries(tool.arguments)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${heading(k)}: ${typeof v === "string" && /^[a-z_]+$/.test(v) ? label(v) : show(v)}`);
  return [
    "Checked " + tool.total + " " + noun(tool.label, tool.total),
    ...filters,
  ].join(" · ");
}
