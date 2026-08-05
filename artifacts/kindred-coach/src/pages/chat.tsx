import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetActiveChat,
  getGetActiveChatQueryKey,
  getGetCurrentAuthUserQueryKey,
  sendChatMessage,
  appendChatMessage,
  archiveActiveChat,
  updateProfile,
  type ChatMessage,
  type AuthUser,
} from "@workspace/api-client-react";
import { useGetCurrentAuthUser } from "@workspace/api-client-react";
import { Send, Archive, Loader2, Mic, Square } from "lucide-react";
import { useLocation } from "wouter";
import { SpeakButton } from "@/components/speak-button";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";

const TEXTAREA_MAX_HEIGHT_PX = 160;

interface OnboardingStep {
  key: "preferredName" | "birthday" | "struggles" | "strengths" | "interests";
  prompt: (user: AuthUser | null) => string;
  placeholder: string;
  inputType?: "date" | "text";
}

const ONBOARDING: OnboardingStep[] = [
  {
    key: "preferredName",
    prompt: (u) =>
      `Hi${u?.firstName ? " " + u.firstName : ""} — I'm Kindred, your daily wellness companion. I'd love to get to know you a little. What should I call you?`,
    placeholder: "Your preferred name",
  },
  {
    key: "birthday",
    prompt: () => "Lovely to meet you. When's your birthday? (You can skip if you'd rather not say.)",
    placeholder: "YYYY-MM-DD",
    inputType: "date",
  },
  {
    key: "struggles",
    prompt: () =>
      "Thank you for sharing. What feels heavy for you right now — anything you're working through that I should know about?",
    placeholder: "What's been on your mind...",
  },
  {
    key: "strengths",
    prompt: () =>
      "That takes courage to name. On the flip side — what do you feel are some of your real strengths?",
    placeholder: "What you're proud of...",
  },
  {
    key: "interests",
    prompt: () =>
      "Beautiful. Last one — what lights you up? Hobbies, interests, the things that bring you joy.",
    placeholder: "What you love...",
  },
];

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  // Only offer "read aloud" on Kindred's real, persisted replies — skip the
  // virtual onboarding bubble (negative id) which has no server message yet.
  const canSpeak = !isUser && message.id > 0 && message.content.trim().length > 0;
  return (
    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-muted text-foreground rounded-bl-sm"
        }`}
      >
        {message.content.split("\n").map((line, i) => (
          <p key={i} className={i > 0 ? "mt-1" : ""}>{line}</p>
        ))}
      </div>
      {canSpeak && (
        <div className="mt-1 pl-1">
          <SpeakButton text={message.content} />
        </div>
      )}
    </div>
  );
}

export default function Chat() {
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const { data: user, refetch: refetchUser } = useGetCurrentAuthUser({ query: { queryKey: getGetCurrentAuthUserQueryKey() } });
  const authUser = user?.user ?? null;
  const { data: conv, isLoading } = useGetActiveChat({ query: { queryKey: getGetActiveChatQueryKey() } });

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // MediaRecorder-based dictation (works on mobile browsers where the Web
  // Speech API is unavailable). Transcribed text is appended to the draft.
  const {
    status: voiceStatus,
    error: voiceError,
    setError: setVoiceError,
    supported: voiceSupported,
    stop: stopDictation,
    toggle: toggleDictation,
  } = useVoiceRecorder((text) =>
    setDraft((prev) => {
      const joiner = prev && !prev.endsWith(" ") ? " " : "";
      return prev + joiner + text;
    }),
  );
  const listening = voiceStatus === "recording";

  const onboarded = !!authUser?.onboardedAt;
  const storedMessages: ChatMessage[] = conv?.messages ?? [];
  // When the user hasn't completed onboarding and no messages have been stored
  // yet, render the first onboarding prompt as a static client-side bubble.
  // This avoids having GET /chat/active perform DB writes (which would be a
  // CSRF risk under SameSite=Lax). The server only creates the conversation
  // record on the first POST (send/append), which SameSite=Lax blocks from
  // cross-site origins.
  const virtualFirstMessage: ChatMessage[] =
    !onboarded && authUser && storedMessages.length === 0
      ? [
          {
            id: -1,
            conversationId: -1,
            role: "assistant",
            content: ONBOARDING[0].prompt(authUser),
            createdAt: new Date().toISOString(),
          } as ChatMessage,
        ]
      : [];
  const messages: ChatMessage[] = virtualFirstMessage.length > 0 ? virtualFirstMessage : storedMessages;

  // Determine onboarding step from current profile state.
  const currentStep: OnboardingStep | null = useMemo(() => {
    if (onboarded || !authUser) return null;
    for (const step of ONBOARDING) {
      if (!authUser[step.key]) return step;
    }
    return null;
  }, [onboarded, authUser]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, sending]);

  // Auto-grow the textarea as the user types, capped at TEXTAREA_MAX_HEIGHT_PX
  // so it never crowds the chat. Run after every draft change.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, TEXTAREA_MAX_HEIGHT_PX)}px`;
  }, [draft, currentStep]);

  async function handleSend() {
    const text = draft.trim();
    if (!text || sending) return;
    if (listening) stopDictation();
    setDraft("");
    setSending(true);
    setSendError(null);
    try {
      if (currentStep) {
        // Onboarding: persist profile first, then write the user message + next prompt.
        // Ordering profile update before the message append means a network failure
        // can't leave the chat showing an answer that wasn't saved.
        const value = text;
        await updateProfile({ [currentStep.key]: value });
        await appendChatMessage({ role: "user", content: text });
        // Determine next step from the updated profile
        const updatedUser: AuthUser = { ...(authUser as AuthUser), [currentStep.key]: value };
        const nextStep = ONBOARDING.find((s) => !updatedUser[s.key]);
        if (nextStep) {
          await appendChatMessage({ role: "assistant", content: nextStep.prompt(updatedUser) });
        } else {
          // Onboarding complete
          await updateProfile({ onboardedAt: new Date().toISOString() });
          const name = (updatedUser.preferredName ?? "friend").trim();
          await appendChatMessage({
            role: "assistant",
            content: `Thank you, ${name}. I've got a feel for you now. Whenever you want to talk — about your day, how you're feeling, or anything at all — I'm here. What's on your mind right now?`,
          });
        }
        await refetchUser();
        await qc.invalidateQueries({ queryKey: getGetActiveChatQueryKey() });
      } else {
        try {
          await sendChatMessage({ content: text });
        } catch (err: unknown) {
          // Server didn't persist the user message? It did — /chat/send
          // saves the user turn before calling Gemini, so refetch so the
          // user's message still shows, then surface a transient banner
          // so they can retry without losing what they typed.
          setSendError(
            "Kindred couldn't put a reply together. Try sending that again in a moment.",
          );
          setDraft(text);
          await qc.invalidateQueries({ queryKey: getGetActiveChatQueryKey() });
          return;
        }
        await qc.invalidateQueries({ queryKey: getGetActiveChatQueryKey() });
      }
    } finally {
      setSending(false);
    }
  }

  async function handleArchive() {
    if (archiving) return;
    setArchiving(true);
    try {
      await archiveActiveChat();
      await qc.invalidateQueries({ queryKey: getGetActiveChatQueryKey() });
      setLocation("/archive");
    } finally {
      setArchiving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-4rem)] animate-in fade-in duration-500">
      <header className="flex items-center justify-between pb-4">
        <div>
          <h1 className="text-2xl font-serif text-foreground tracking-tight">
            {onboarded ? "Chat with Kindred" : "Welcome"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {onboarded ? "Your daily wellness companion" : "A few questions to get acquainted"}
          </p>
        </div>
        {onboarded && messages.length > 0 && (
          <button
            onClick={handleArchive}
            disabled={archiving}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            data-testid="archive-chat"
          >
            {archiving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
            Archive chat
          </button>
        )}
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pr-1">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-2.5 flex gap-1">
              <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" />
            </div>
          </div>
        )}
      </div>

      <div className="pt-4">
        {sendError && (
          <div
            className="mb-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive flex items-center justify-between gap-3"
            data-testid="chat-send-error"
          >
            <span>{sendError}</span>
            <button
              onClick={() => setSendError(null)}
              className="text-destructive/70 hover:text-destructive font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
              aria-label="Dismiss"
            >
              Dismiss
            </button>
          </div>
        )}
        {voiceError && (
          <div
            className="mb-2 rounded-md border border-amber-300/50 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3"
            data-testid="chat-voice-error"
          >
            <span>{voiceError}</span>
            <button
              onClick={() => setVoiceError(null)}
              className="font-medium opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              aria-label="Dismiss"
            >
              Dismiss
            </button>
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2 items-end"
        >
          {currentStep?.inputType === "date" ? (
            <input
              type="date"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={currentStep?.placeholder}
              aria-label="Date of birth input"
              disabled={sending}
              className="flex-1 rounded-full px-4 py-2.5 text-sm bg-muted border-0 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
              data-testid="chat-input"
            />
          ) : (
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                // Enter sends; Shift+Enter inserts a newline. Match common chat UX.
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={
                listening
                  ? "Listening… speak now."
                  : currentStep?.placeholder ?? "Share what's on your mind..."
              }
              aria-label="Message input"
              disabled={sending}
              rows={1}
              className="flex-1 rounded-2xl px-4 py-2.5 text-sm bg-muted border-0 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50 resize-none leading-relaxed overflow-y-auto"
              style={{ maxHeight: TEXTAREA_MAX_HEIGHT_PX }}
              data-testid="chat-input"
            />
          )}
          {voiceSupported && currentStep?.inputType !== "date" && (
            <button
              type="button"
              onClick={toggleDictation}
              disabled={sending || voiceStatus === "transcribing"}
              aria-label={listening ? "Stop voice input" : "Start voice input"}
              title={listening ? "Stop voice input" : "Start voice input"}
              className={`flex items-center justify-center w-11 h-11 rounded-full transition-colors shrink-0 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                listening
                  ? "bg-destructive text-destructive-foreground animate-pulse"
                  : "bg-muted text-foreground hover:bg-muted/70"
              }`}
              data-testid="chat-mic"
            >
              {voiceStatus === "transcribing" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : listening ? (
                <Square className="w-3.5 h-3.5 fill-current" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>
          )}
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            aria-label={sending ? "Sending message" : "Send message"}
            className="flex items-center justify-center w-11 h-11 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            data-testid="chat-send"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}
