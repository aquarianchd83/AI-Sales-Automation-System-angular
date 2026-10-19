import { AiProviderStatus } from './platform.model';

/** What a provider's status means, in a few words. */
export const AI_STATUS_TEXT: Record<AiProviderStatus, string> = {
  Off: 'Switched off',
  NotConfigured: 'No key saved',
  NotVerified: 'Not verified yet',
  Verified: 'Verified',
  Failed: 'Check failed',
};

/** The product-knowledge tasks, by the name a platform admin would use. */
export const AI_TASK_TEXT: Record<string, string> = {
  DocumentAnalysis: 'Document and PDF analysis',
  ProductInfoExtraction: 'Product information extraction',
  KnowledgeConsolidation: 'Knowledge consolidation',
  GroundedQuestionAnswering: 'Question answering from sources',
  CustomQuestionAnswering: 'Tenant-created questions',
  QuestionnaireGeneration: 'Questionnaire generation',
  BenefitAnalysis: 'Benefits and customer value',
  MissingInformationDetection: 'Missing-information detection',
  ConflictIdentification: 'Conflict identification',
  SuggestedAnswerGeneration: 'Suggested answers',
  KnowledgeDraft: 'Draft knowledge file',
  ScannedDocumentReading: 'Reading scanned pages (needs an image-capable model)',
  ConnectionCheck: 'Connection check',
  Benchmark: 'Accuracy test',
};

/** ChatGPT, Claude, Gemini - the names the screens use for OpenAI, Anthropic, Google. */
export function aiProviderName(provider: string): string {
  switch (provider) {
    case 'OpenAI':
      return 'ChatGPT';
    case 'Anthropic':
      return 'Claude';
    case 'Google':
      return 'Gemini';
    default:
      return provider;
  }
}
