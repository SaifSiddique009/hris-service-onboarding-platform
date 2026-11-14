import { ChevronRight, Copy, Plus, Send } from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type { ToolUse } from "../../api/types";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Textarea } from "../../components/Fields";
import { PageHeader } from "../../components/PageHeader";
import { Table, Td, Th } from "../../components/Table";
import { useOnce } from "../../lib/once";
import { toast } from "../../lib/toast";
import {
  ask,
  clearChat,
  send,
  syncOwner,
  useChat,
  type Exchange,
} from "./chatStore";
import { heading, show, summary } from "./dataFormat";
import { RichText } from "./richText";

const MAX = 500;
const examples = [
  "How many IT Equipment requests are unresolved in Cyprus?",
  "Which new hires have overdue onboarding tasks?",
  "How is onboarding going in Malaysia?",
  "Which new hires are still waiting on IT equipment?",
  "How many people are on probation, by department?",
];

function Mark() {
  return (
    <span className="flex items-center gap-2">
      <span
        aria-hidden
        className="grid size-6 place-items-center rounded-xs bg-ink font-serif text-[14px] text-paper"
      >
        p.
      </span>
      <span className="text-[13px] font-semibold">Assistant</span>
    </span>
  );
}

function DataRead({ tool }: { tool: ToolUse }) {
  const [open, setOpen] = useState(false);
  const columns = Object.keys(tool.rows[0] ?? {});
  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="-ml-2.5 h-auto max-w-full py-1 text-left whitespace-normal! text-muted"
      >
        <ChevronRight
          aria-hidden
          size={14}
          strokeWidth={1.8}
          className={`shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
        />
        {summary(tool)}
      </Button>
      {open && (
        <Card variant="boxed" className="mt-1 animate-rise">
          {tool.truncated && (
            <p className="mb-3 rounded-sm bg-amber-soft px-3 py-2 text-[13px] text-amber">
              Showing the first {tool.row_count} of {tool.total}.
            </p>
          )}
          {columns.length === 0 ? (
            <p className="text-[13px] text-muted">No rows matched.</p>
          ) : (
            <div className="max-h-72 overflow-auto">
              <Table>
                <thead>
                  <tr>
                    {columns.map((c) => (
                      <Th
                        key={c}
                        className="whitespace-nowrap normal-case tracking-normal"
                      >
                        {heading(c)}
                      </Th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tool.rows.map((row, i) => (
                    <tr key={i}>
                      {columns.map((c) => (
                        <Td key={c} className="py-2 text-[13px]">
                          {show(row[c], c)}
                        </Td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function Reply({ item, pending }: { item: Exchange; pending: boolean }) {
  const once = useOnce();
  return (
    <div className="flex max-w-[44rem] flex-col gap-2">
      <Mark />
      {pending ? (
        <p role="status" className="flex items-center gap-2 text-sm text-muted">
          <span
            aria-hidden
            className="size-2 animate-pulse rounded-full bg-accent"
          />
          Looking at the data…
        </p>
      ) : item.error ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger"
        >
          <p className="min-w-0 break-words">{item.error}</p>
          {item.retry && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => once(() => void ask(item.id))}
            >
              Try again
            </Button>
          )}
        </div>
      ) : (
        item.answer && (
          <>
            <div className="text-[14.5px] leading-[1.55]">
              <RichText text={item.answer.answer} />
            </div>
            {item.answer.tools_used.map((t, i) => (
              <DataRead key={i} tool={t} />
            ))}
            <div>
              <Button
                variant="ghost"
                size="sm"
                className="-ml-2.5 text-muted"
                onClick={() =>
                  navigator.clipboard.writeText(item.answer!.answer).then(
                    () => toast("Copied"),
                    () => toast("Could not copy"),
                  )
                }
              >
                <Copy aria-hidden size={14} strokeWidth={1.8} />
                Copy
              </Button>
            </div>
          </>
        )
      )}
    </div>
  );
}

export function AssistantPage() {
  const { thread, pendingId } = useChat();
  const [text, setText] = useState("");
  const once = useOnce();
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(syncOwner, []);

  useLayoutEffect(() => {
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    end.current?.scrollIntoView({
      behavior: calm ? "auto" : "smooth",
      block: "end",
    });
  }, [thread.length, pendingId]);

  useLayoutEffect(() => {
    const el = box.current?.querySelector("textarea");
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight + 2, 160)}px`;
    el.style.overflowY = el.scrollHeight > 158 ? "auto" : "hidden";
  }, [text]);

  const over = text.length > MAX;
  const blocked = !text.trim() || over || pendingId !== null;

  function submit(question: string) {
    const q = question.trim();
    if (!q || q.length > MAX || pendingId !== null) return;
    once(() => {
      send(q);
      setText("");
    });
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit(text);
    }
  }

  return (
    <div className="mx-auto flex -mb-18 h-[calc(100dvh-var(--header-h)-4.5rem)] min-h-[28rem] max-w-3xl flex-col max-md:-mb-20 max-md:h-[calc(100dvh-var(--header-h)-2.5rem)]">
      <PageHeader
        eyebrow="Assistant"
        title="Ask about your people data"
        actions={
          <Button
            variant="secondary"
            disabled={thread.length === 0 || pendingId !== null}
            onClick={clearChat}
          >
            <Plus aria-hidden size={16} strokeWidth={1.8} />
            New chat
          </Button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto border-t border-ink pt-6">
        {thread.length === 0 ? (
          <div className="max-w-[40rem]">
            <h2 className="font-serif text-[28px] leading-[1.2]">
              Ask about people, requests and onboarding
            </h2>
            <ul className="mt-5 flex flex-wrap gap-2">
              {examples.map((q) => (
                <li key={q} className="max-w-full">
                  <button
                    type="button"
                    onClick={() => submit(q)}
                    className="min-h-8 max-w-full rounded-sm border border-control px-3 py-1.5 text-left text-[13px] text-n-600 transition-colors hover:border-ink hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus max-md:min-h-11"
                  >
                    {q}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <ol className="flex flex-col gap-8 pb-2">
            {thread.map((item) => (
              <li key={item.id} className="flex flex-col gap-5">
                <p className="max-w-[85%] self-end whitespace-pre-wrap break-words rounded-md bg-ink px-4 py-2.5 text-[14.5px] leading-[1.5] text-paper">
                  {item.question}
                </p>
                <Reply item={item} pending={item.id === pendingId} />
              </li>
            ))}
          </ol>
        )}
        <div ref={end} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(text);
        }}
        className="flex flex-col gap-2 border-t border-line bg-page pt-3"
      >
        <div className="flex items-end gap-2">
          <div ref={box} className="min-w-0 flex-1">
            <Textarea
              aria-label="Your question"
              aria-invalid={over || undefined}
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask a question"
              className="min-h-10! block resize-none! py-[9px]! leading-5! max-md:min-h-11!"
            />
          </div>
          <Button type="submit" disabled={blocked}>
            <Send aria-hidden size={16} strokeWidth={1.8} />
            Send
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-3 text-[13px]">
          <span
            role={over ? "alert" : undefined}
            className={over ? "font-medium text-danger" : "text-muted"}
          >
            {over
              ? "Shorten your question to 500 characters"
              : "Enter to send, Shift+Enter for a new line"}
          </span>
          <span
            className={`tabular-nums ${over ? "font-medium text-danger" : "text-muted"}`}
          >
            {text.length} / {MAX}
          </span>
        </div>
        <p className="text-[12.5px] text-muted">
          Answers come from live platform data through a fixed set of read-only
          queries. Check the rows shown with each answer.
        </p>
      </form>
    </div>
  );
}
