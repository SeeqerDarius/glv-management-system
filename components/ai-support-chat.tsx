"use client";

import { useState } from "react";
import {
  BotIcon,
  Loader2Icon,
  MessageCircleIcon,
  SendIcon,
  UserIcon,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type SupportMessage = {
  role: "user" | "assistant";
  content: string;
};

type AiSupportChatProps = {
  userName: string;
  roleLabel: string;
};

const starterPrompts = [
  "How do I record a payment?",
  "Why is a product in procurement?",
  "Help me find a customer account",
];

export function AiSupportChat({ userName, roleLabel }: AiSupportChatProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<SupportMessage[]>([
    {
      role: "assistant",
      content:
        "Hi. I can help with GLV workflows, navigation, permissions, payments, products, procurement, reports, and settings.",
    },
  ]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSend = input.trim().length > 0 && !pending;

  async function submitMessage(messageText: string) {
    const cleanMessage = messageText.trim();
    if (!cleanMessage || pending) return;

    const nextMessages: SupportMessage[] = [
      ...messages,
      { role: "user", content: cleanMessage },
    ];

    setMessages(nextMessages);
    setInput("");
    setError(null);
    setPending(true);
    setOpen(true);

    try {
      const response = await fetch("/api/support/assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: nextMessages.slice(-10),
        }),
      });

      const data = (await response.json()) as {
        reply?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "Unable to contact AI Support.");
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: data.reply || "I could not prepare a response.",
        },
      ]);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to contact AI Support.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6">
      {open ? (
        <section className="mb-3 flex h-[min(38rem,calc(100vh-7rem))] w-[calc(100vw-2rem)] max-w-md flex-col overflow-hidden rounded-lg border bg-white shadow-2xl ring-1 ring-gray-950/5">
          <div className="flex items-center justify-between gap-3 border-b bg-green-950 px-4 py-3 text-white">
            <div className="flex min-w-0 items-center gap-3">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-lime-400 text-green-950">
                <BotIcon className="size-5" />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold">
                  GLV AI Support
                </h2>
                <p className="truncate text-xs text-lime-100">
                  {userName} · {roleLabel}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-white/75 hover:bg-white/10 hover:text-white"
              aria-label="Close AI Support"
              title="Close"
            >
              <XIcon className="size-4" />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex gap-2 ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {message.role === "assistant" ? (
                  <span className="mt-1 inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-700">
                    <BotIcon className="size-4" />
                  </span>
                ) : null}
                <div
                  className={`max-w-[82%] rounded-lg px-3 py-2 text-sm leading-6 ${
                    message.role === "user"
                      ? "bg-green-900 text-white"
                      : "bg-gray-50 text-gray-800"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
                {message.role === "user" ? (
                  <span className="mt-1 inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-lime-100 text-green-800">
                    <UserIcon className="size-4" />
                  </span>
                ) : null}
              </div>
            ))}

            {pending ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2Icon className="size-4 animate-spin" />
                AI Support is thinking...
              </div>
            ) : null}
          </div>

          {messages.length === 1 ? (
            <div className="border-t bg-gray-50 p-3">
              <div className="flex flex-wrap gap-2">
                {starterPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => void submitMessage(prompt)}
                    disabled={pending}
                    className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 transition hover:border-green-700 hover:text-green-900 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="border-t border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {error}
            </div>
          ) : null}

          <form
            className="flex items-end gap-2 border-t p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void submitMessage(input);
            }}
          >
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask GLV Support..."
              className="min-h-11 flex-1 resize-none rounded border bg-white p-2 text-sm outline-none focus:border-green-700 focus:ring-2 focus:ring-green-700/20"
            />
            <Button type="submit" size="icon" disabled={!canSend}>
              {pending ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <SendIcon className="size-4" />
              )}
              <span className="sr-only">Send</span>
            </Button>
          </form>
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="group/support ml-auto flex size-14 items-center justify-center rounded-full bg-green-950 text-lime-300 shadow-xl ring-1 ring-green-900/20 transition hover:-translate-y-0.5 hover:bg-green-900 focus:outline-none focus:ring-4 focus:ring-lime-300/40"
        aria-label="Open AI Support"
        title="AI Support"
      >
        <MessageCircleIcon className="size-6 transition-transform group-hover/support:scale-110" />
      </button>
    </div>
  );
}
