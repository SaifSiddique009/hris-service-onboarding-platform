import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";

interface Tab {
  value: string;
  label: string;
  count?: number;
  hot?: boolean;
}

interface Props {
  tabs: Tab[];
  value: string;
  onChange: (value: string) => void;
  label: string;
}

export function Tabs({ tabs, value, onChange, label }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState({ left: false, right: false });

  function measure() {
    const el = ref.current;
    if (el)
      setMore({
        left: el.scrollLeft > 1,
        right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
      });
  }

  useEffect(() => {
    const el = ref.current;
    const active = el?.querySelector<HTMLElement>("[aria-selected=true]");
    if (el && active)
      el.scrollLeft =
        active.offsetLeft - (el.clientWidth - active.offsetWidth) / 2;
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [value, tabs.length]);

  const fade =
    "pointer-events-none absolute inset-y-0 w-10 from-page to-transparent";
  return (
    <div className="relative">
      {more.left && (
        <span aria-hidden className={cn(fade, "left-0 bg-linear-to-r")} />
      )}
      {more.right && (
        <span aria-hidden className={cn(fade, "right-0 bg-linear-to-l")} />
      )}
      <div
        ref={ref}
        onScroll={measure}
        role="tablist"
        aria-label={label}
        className="relative flex gap-7 overflow-x-auto border-b border-control [scrollbar-width:none]"
      >
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={tab.value === value}
            onClick={() => onChange(tab.value)}
            className="-mb-px inline-flex min-h-11 items-center gap-2 whitespace-nowrap border-b-2 border-transparent text-sm font-medium text-muted hover:text-ink aria-selected:border-ink aria-selected:font-semibold aria-selected:text-ink"
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  "rounded-xs px-1.5 text-xs tabular-nums",
                  tab.hot && tab.count > 0
                    ? "bg-danger-soft font-semibold text-danger"
                    : "text-muted",
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
