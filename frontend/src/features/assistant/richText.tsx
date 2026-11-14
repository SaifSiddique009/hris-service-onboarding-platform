import type { ReactNode } from "react";

const bold = (text: string): ReactNode[] =>
  text
    .split(/\*\*(.+?)\*\*/g)
    .map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part));

const listItem = /^(?:[-*]|\d+\.)\s+(.*)$/;

// Plain lines, "- " / "* " / "1. " lists and **bold**, built as elements so nothing is injected as HTML.
export function RichText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let lines: string[] = [];
  let items: string[] = [];
  let ordered = false;
  const flush = () => {
    if (lines.length) {
      blocks.push(
        <p key={blocks.length}>
          {lines.map((line, i) => (
            <span key={i}>
              {i > 0 && <br />}
              {bold(line)}
            </span>
          ))}
        </p>,
      );
    }
    if (items.length) {
      const Tag = ordered ? "ol" : "ul";
      blocks.push(
        <Tag
          key={blocks.length}
          className={`${ordered ? "list-decimal" : "list-disc"} space-y-1 pl-5`}
        >
          {items.map((item, i) => (
            <li key={i}>{bold(item)}</li>
          ))}
        </Tag>,
      );
    }
    lines = [];
    items = [];
  };
  for (const line of text.trim().split("\n")) {
    const match = line.trim().match(listItem);
    if (match) {
      const isOrdered = /^\d/.test(line.trim());
      if (lines.length || (items.length && isOrdered !== ordered)) flush();
      ordered = isOrdered;
      items.push(match[1]);
    } else {
      if (items.length) flush();
      lines.push(line);
    }
  }
  flush();
  return <div className="space-y-3 break-words">{blocks}</div>;
}
