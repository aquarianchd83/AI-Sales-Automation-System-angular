/** What the server decided for one AI turn: Answered (from the published knowledge), Clarifying (nothing covers it, so one question), HandedOver (a person would take over). */
export type TestChatOutcome = 'Answered' | 'Clarifying' | 'HandedOver';

export interface TestChatTurn {
  role: 'customer' | 'assistant';
  text: string;
  /** For an assistant turn, the outcome the server returned for it. */
  kind?: TestChatOutcome;
}

/** An approved answer of the published version the AI was given, and how close it was to the question. */
export interface TestChatSource {
  itemId: string;
  versionNumber: number;
  question: string;
  excerpt: string;
  relevance: number;
  isMaterialClaim: boolean;
  /** The AI used it in its reply. */
  cited: boolean;
}

export interface TestChatReply {
  /** What the customer would be sent; null when a person would take over instead. */
  reply: string | null;
  outcome: TestChatOutcome;
  /** One sentence for the tester on what happened. */
  why: string;
  sources: TestChatSource[];
  /** When a draft was written but would not be sent: what it said and why it was stopped. */
  draftBlocked: string | null;
  detectedIntent: string;
  /** Set when the platform AI is not fully set up (a Simulated provider): carry on, but contact the product owner, who has already been alerted. */
  platformNotice?: string | null;
}
