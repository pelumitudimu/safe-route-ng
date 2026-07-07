import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { RotateCcw, ShieldQuestion } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { LiveIndicator } from "@/components/LiveIndicator";
import { useLiveIncidents } from "@/hooks/use-live-incidents";
import { supabase } from "@/integrations/supabase/client";
import {
  getAssistantMessages,
  clearAssistantMessages,
} from "@/lib/assistant.functions";
import guardian from "@/assets/assistant-guardian.png";

export const Route = createFileRoute("/_authenticated/assistant")({
  loader: () => getAssistantMessages(),
  component: AssistantPage,
  errorComponent: () => (
    <AppLayout title="Fayol">
      <p className="text-sm text-muted-foreground">
        Could not load Fayol. Please refresh and try again.
      </p>
    </AppLayout>
  ),
  notFoundComponent: () => (
    <AppLayout title="Fayol">
      <p className="text-sm text-muted-foreground">Not found.</p>
    </AppLayout>
  ),
});

const SUGGESTIONS = [
  "Is Lekki safe right now?",
  "Any recent kidnappings in Kaduna?",
  "What should I do during an armed robbery?",
  "How do I use the SOS button?",
];

const transport = new DefaultChatTransport({
  api: "/api/chat",
  headers: async (): Promise<Record<string, string>> => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  },
});

function AssistantPage() {
  const initial = Route.useLoaderData() as unknown as UIMessage[];
  const router = useRouter();
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { data: liveIncidents } = useLiveIncidents(500);
  const recentCount = (liveIncidents ?? []).filter(
    (i) => Date.now() - new Date(i.created_at).getTime() < 24 * 60 * 60 * 1000,
  ).length;

  const { messages, sendMessage, status } = useChat({
    id: "assistant",
    messages: initial,
    transport,
    onError: (err) => toast.error(err.message || "Something went wrong."),
  });

  const isBusy = status === "submitted" || status === "streaming";

  const focusInput = () => textareaRef.current?.focus();
  useEffect(() => {
    focusInput();
  }, []);
  useEffect(() => {
    if (status === "ready") focusInput();
  }, [status]);

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isBusy) return;
    sendMessage({ text: trimmed });
    setInput("");
    requestAnimationFrame(focusInput);
  };

  const handleSubmit = (message: PromptInputMessage) => submit(message.text);

  const handleClear = async () => {
    try {
      await clearAssistantMessages();
      await router.invalidate();
      window.location.reload();
    } catch {
      toast.error("Could not clear the conversation.");
    }
  };

  return (
    <AppLayout
      title="Fayol"
      action={
        <div className="flex items-center gap-1.5">
          <LiveIndicator />
          {messages.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={handleClear}>
              <RotateCcw className="h-4 w-4" /> Clear
            </Button>
          ) : null}
        </div>
      }
      fullBleed
    >
      <div className="mx-auto flex h-[calc(100vh-4rem)] w-full max-w-3xl flex-col">
        <Conversation className="flex-1">
          <ConversationContent>
            {messages.length === 0 ? (
              <ConversationEmptyState
                className="h-full"
                icon={
                  <img
                    src={guardian}
                    alt="Fayol safety assistant"
                    width={72}
                    height={72}
                    loading="lazy"
                    className="h-18 w-18"
                  />
                }
                title="Hi, I'm Fayol — how can I help you stay safe?"
                description="Ask about safety in any Nigerian area — I check live incident reports — or get emergency guidance and app help."
              >
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => submit(s)}
                      className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </ConversationEmptyState>
            ) : (
              messages.map((message) => (
                <Message key={message.id} from={message.role}>
                  <MessageContent>
                    {message.parts.map((part, i) => {
                      if (part.type === "text") {
                        return (
                          <MessageResponse key={i}>{part.text}</MessageResponse>
                        );
                      }
                      if (part.type.startsWith("tool-")) {
                        const toolPart = part as {
                          type: `tool-${string}`;
                          state:
                            | "input-streaming"
                            | "input-available"
                            | "output-available"
                            | "output-error";
                          input?: unknown;
                          output?: unknown;
                          errorText?: string;
                        };
                        return (
                          <Tool key={i} defaultOpen={false}>
                            <ToolHeader
                              type={toolPart.type}
                              state={toolPart.state}
                            />
                            <ToolContent>
                              <ToolInput input={toolPart.input} />
                              <ToolOutput
                                output={
                                  toolPart.output ? (
                                    <IncidentToolResult
                                      data={toolPart.output}
                                    />
                                  ) : undefined
                                }
                                errorText={toolPart.errorText}
                              />
                            </ToolContent>
                          </Tool>
                        );
                      }
                      return null;
                    })}
                  </MessageContent>
                </Message>
              ))
            )}
            {status === "submitted" && (
              <Message from="assistant">
                <MessageContent>
                  <Shimmer>Checking the latest reports…</Shimmer>
                </MessageContent>
              </Message>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="px-4 pb-4">
          <PromptInput onSubmit={handleSubmit}>
            <PromptInputTextarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about safety anywhere in Nigeria…"
              autoFocus
            />
            <PromptInputFooter className="justify-end">
              <PromptInputSubmit
                status={status}
                disabled={!input.trim() && !isBusy}
              />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </AppLayout>
  );
}

function IncidentToolResult({ data }: { data: unknown }) {
  const parsed = data as {
    count?: number;
    incidents?: Array<{
      title?: string;
      category?: string;
      severity?: string;
      status?: string;
      address?: string;
      created_at?: string;
    }>;
    error?: string;
  };

  if (parsed?.error) {
    return <p className="text-sm text-destructive">{parsed.error}</p>;
  }
  const incidents = parsed?.incidents ?? [];
  if (incidents.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No matching reports found.</p>
    );
  }
  return (
    <ul className="space-y-2 text-sm">
      {incidents.map((inc, i) => (
        <li key={i} className="rounded-md border border-border p-2">
          <p className="font-medium">{inc.title}</p>
          <p className="text-xs text-muted-foreground">
            {[inc.category, inc.severity, inc.address]
              .filter(Boolean)
              .join(" • ")}
          </p>
        </li>
      ))}
    </ul>
  );
}
