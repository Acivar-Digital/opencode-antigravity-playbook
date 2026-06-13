const TITLE_KEYWORDS = [
  "write a 5-10 word title",
  "Please write a 5-10 word title",
  "Respond with the title",
  "Generate a title for",
  "Create a brief title",
  "title for the conversation",
  "conversation title",
];

const SUMMARY_KEYWORDS = [
  "Summarize this coding conversation",
  "Summarize the conversation",
  "Concise summary",
  "in under 50 characters",
  "compress the context",
  "Provide a concise summary",
  "condense the previous messages",
  "shorten the conversation history",
  "extract key points from",
];

const SUGGESTION_KEYWORDS = [
  "prompt suggestion generator",
  "suggest next prompts",
  "what should I ask next",
  "generate follow-up questions",
  "recommend next steps",
  "possible next actions",
];

const SYSTEM_KEYWORDS = [
  "Warmup",
  "<system-reminder>",
  "This is a system message",
];

const PROBE_KEYWORDS = [
  "check current directory",
  "list available tools",
  "verify environment",
  "test connection",
];

export function detectBackgroundTask(lastUserMessage: string): string | null {
  if (!lastUserMessage || lastUserMessage.length > 300) {
    return null;
  }

  const preview = lastUserMessage.substring(0, 300);

  // If the prompt contains a keyword, but it's a long question (e.g. user asking about the keyword),
  // we use a heuristic: if the prompt is much longer than the keyword itself, it might be a user question.
  const isMatch = (keywords: string[]) => keywords.some(kw => {
    if (!preview.includes(kw)) return false;
    // If the prompt is significantly longer than the keyword (e.g. by 20 chars), it's likely a user question
    if (preview.length > kw.length + 20) return false;
    return true;
  });

  if (
    isMatch(SYSTEM_KEYWORDS) ||
    isMatch(TITLE_KEYWORDS) ||
    isMatch(SUMMARY_KEYWORDS) ||
    isMatch(SUGGESTION_KEYWORDS) ||
    isMatch(PROBE_KEYWORDS)
  ) {
    return 'gemini-2.5-flash';
  }

  return null;
}
