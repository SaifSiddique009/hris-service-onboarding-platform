import { useSyncExternalStore } from "react";
import { api, ApiError, getToken } from "../../api/client";
import type { AiAnswer } from "../../api/types";

export interface Exchange {
  id: number;
  question: string;
  answer?: AiAnswer;
  error?: string;
  // A 422 means the question itself is wrong, so asking again would fail the same way.
  retry?: boolean;
}

interface State {
  thread: Exchange[];
  pendingId: number | null;
}

const KEY = "assistant_chat";
let state: State = { thread: [], pendingId: null };
let owner = getToken();
const listeners = new Set<() => void>();

function load() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as {
      token: string | null;
      thread: Exchange[];
    } | null;
    if (saved && saved.token === owner) {
      // A question that never got its reply (page closed mid-wait) can be asked again.
      state.thread = saved.thread.map((x) =>
        x.answer || x.error
          ? x
          : { ...x, error: "This question did not finish.", retry: true },
      );
    }
  } catch {
    sessionStorage.removeItem(KEY);
  }
}
load();

function set(next: State) {
  state = next;
  try {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ token: owner, thread: state.thread }),
    );
  } catch {
    // Storage full or blocked: the chat still works in memory.
  }
  listeners.forEach((notify) => notify());
}

// A different or missing sign-in means a different person: start clean.
export function syncOwner() {
  const token = getToken();
  if (token === owner) return;
  owner = token;
  set({ thread: [], pendingId: null });
}

export const useChat = () =>
  useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => listeners.delete(notify);
    },
    () => state,
  );

const patch = (id: number, change: Partial<Exchange>) =>
  set({
    ...state,
    thread: state.thread.map((x) => (x.id === id ? { ...x, ...change } : x)),
  });

export async function ask(id: number) {
  const index = state.thread.findIndex((x) => x.id === id);
  if (index < 0 || state.pendingId !== null) return;
  const history = state.thread
    .slice(0, index)
    .filter((x) => x.answer)
    .slice(-4)
    .map((x) => ({ question: x.question, answer: x.answer!.answer }));
  patch(id, { answer: undefined, error: undefined, retry: undefined });
  set({ ...state, pendingId: id });
  try {
    const answer = await api<AiAnswer>("/ai/query", {
      method: "POST",
      body: JSON.stringify({ question: state.thread[index].question, history }),
    });
    patch(id, { answer });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong";
    patch(id, {
      error: message,
      retry: !(err instanceof ApiError && err.status === 422),
    });
  }
  set({ ...state, pendingId: null });
}

export function send(question: string) {
  if (state.pendingId !== null) return;
  const id = Date.now();
  set({ ...state, thread: [...state.thread, { id, question }] });
  void ask(id);
}

export const clearChat = () => {
  if (state.pendingId === null) set({ thread: [], pendingId: null });
};
