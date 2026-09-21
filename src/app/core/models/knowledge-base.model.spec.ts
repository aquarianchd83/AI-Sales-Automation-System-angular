import { KnowledgeBaseArticleStatus, canPublishArticle } from './knowledge-base.model';

/** Mirrors KnowledgeBaseService.PublishAsync: callable on Draft (first publish) or an
 * already-Published article (pick up an edit) — Archived is the only status nothing can
 * currently un-archive back into rotation. */
describe('canPublishArticle', () => {
  it('is true for Draft and Published', () => {
    expect(canPublishArticle(KnowledgeBaseArticleStatus.Draft)).toBeTrue();
    expect(canPublishArticle(KnowledgeBaseArticleStatus.Published)).toBeTrue();
  });

  it('is false for Archived', () => {
    expect(canPublishArticle(KnowledgeBaseArticleStatus.Archived)).toBeFalse();
    // Deprecated is terminal for the same reason: re-publishing from the list would quietly put a
    // retired policy back in the AI's mouth.
    expect(canPublishArticle(KnowledgeBaseArticleStatus.Deprecated)).toBeFalse();
  });
});
