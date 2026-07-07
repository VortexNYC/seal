/**
 * Sanitize user-controlled text before it enters an LLM prompt.
 *
 * Strips common prompt-injection markers (ignore/forget instructions, delimiter
 * tricks, role-play prompts, etc.) while preserving the original text for
 * display and storage. Only the sanitized version is ever sent to the model.
 */
export function sanitizeUserInput(text: string): string {
  if (!text) return text;

  const injectionPatterns = [
    // Instruction-override phrases
    /ignore\s+(?:all\s+)?(?:the\s+)?(?:previous|prior|earlier|above|any\s+previous|prior)\s+(?:instructions?|commands?|prompts?|text|context|sentence|message|input)/gi,
    /disregard\s+(?:all\s+)?(?:the\s+)?(?:previous|prior|earlier|above|any\s+previous|prior)\s+(?:instructions?|commands?|prompts?|text|context|sentence|message|input)/gi,
    /forget\s+(?:all\s+)?(?:the\s+)?(?:previous|prior|earlier|above|any\s+previous|prior)\s+(?:instructions?|commands?|prompts?|text|context|sentence|message|input)/gi,
    /override\s+(?:all\s+)?(?:the\s+)?(?:previous|prior|earlier|above|any\s+previous|prior)\s+(?:instructions?|commands?|prompts?|text|context|sentence|message|input)/gi,
    /do\s+not\s+(?:follow|obey|execute)\s+(?:any\s+)?(?:previous|prior|earlier|above)\s+(?:instructions?|commands?|prompts?)/gi,
    /(?:stop|halt|cease)\s+(?:following|obeying|executing)\s+(?:any\s+)?(?:previous|prior|earlier|above)\s+(?:instructions?|commands?|prompts?)/gi,

    // System-prompt leakage requests
    /reveal\s+(?:your\s+)?(?:system\s+)?prompt/gi,
    /show\s+(?:me\s+)?(?:your\s+)?(?:system\s+)?prompt/gi,
    /print\s+(?:your\s+)?(?:system\s+)?prompt/gi,
    /what\s+(?:is|was)\s+(?:your\s+)?(?:system\s+)?prompt/gi,
    /(?:system|internal)\s+instructions?/gi,

    // Role-play / character-break prompts
    /act\s+(?:as|like)\s+(?:a\s+)?(?:different|other|new|another|hacker|malicious|bad|evil)/gi,
    /switch\s+(?:to|into)\s+(?:a\s+)?(?:different|other|new|another)\s+(?:role|character|persona)/gi,
    /you\s+are\s+now\s+(?:a\s+)?(?:different|other|new|another)/gi,
    /(?:pretend|imagine)\s+(?:you\s+are|that\s+you\s+are)/gi,

    // Delimiter tricks that try to close system context
    /\n\s*#{3,}\s*\n/g, // horizontal rules of 3+ hashes
    /\n\s*={3,}\s*\n/g, // horizontal rules of 3+ equals
    /\n\s*-{3,}\s*\n/g, // horizontal rules of 3+ dashes
    /<\s*\/(?:system|user|assistant|instruction|prompt|instructions)\s*>/gi,
    /<\s*(?:system|user|assistant|instruction|prompt|instructions)\s*>/gi,

    // Injection markers commonly used in promptfoo / red-teaming
    /!!!\s*NEW\s*INSTRUCTIONS?/gi,
    /!!!\s*IGNORE\s*PREVIOUS/gi,
    /IMPORTANT\s+NEW\s+INSTRUCTION/gi,
    /CRITICAL\s+UPDATE/gi,
  ];

  let sanitized = text;
  for (const pattern of injectionPatterns) {
    sanitized = sanitized.replace(pattern, " ");
  }

  // Collapse multiple spaces/newlines that injection removal may leave behind
  sanitized = sanitized.replace(/\s+/g, " ").trim();

  return sanitized;
}
