import { Component, ElementRef, Inject, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Subscription } from 'rxjs';

export type FlowDocKey = 'overview' | 'campaigns' | 'conversations' | 'handoffs' | 'leads' | 'knowledge-base';

export interface FlowDoc {
  key: FlowDocKey;
  label: string;
  path: string;
}

/**
 * The flowchart docs, served straight from the repo's own markdown: angular.json copies
 * docs/MODULE-FLOWS.md and every src/app/features/<module>/FLOWS.md into assets/flows at build
 * time, so this view can never drift from the files developers edit.
 */
export const FLOW_DOCS: FlowDoc[] = [
  { key: 'overview', label: 'Overview', path: 'assets/flows/MODULE-FLOWS.md' },
  { key: 'campaigns', label: 'Campaigns', path: 'assets/flows/campaigns/FLOWS.md' },
  { key: 'conversations', label: 'Conversations', path: 'assets/flows/conversations/FLOWS.md' },
  { key: 'handoffs', label: 'Handoffs', path: 'assets/flows/handoffs/FLOWS.md' },
  { key: 'leads', label: 'Leads', path: 'assets/flows/leads/FLOWS.md' },
  { key: 'knowledge-base', label: 'Knowledge base', path: 'assets/flows/knowledge-base/FLOWS.md' },
];

/**
 * Maps a markdown link to the flow doc it points at, so cross-links between the docs switch the
 * dialog instead of navigating to a repo path the app doesn't serve. Null for anything else.
 */
export function flowDocForHref(href: string): FlowDocKey | null {
  if (/(^|\/)MODULE-FLOWS\.md$/.test(href)) {
    return 'overview';
  }
  const match = /([a-z-]+)\/FLOWS\.md$/.exec(href);
  const key = match?.[1];
  return key && FLOW_DOCS.some((d) => d.key === key) ? (key as FlowDocKey) : null;
}

export interface ModuleFlowsDialogData {
  module: FlowDocKey;
}

let chartSequence = 0;

@Component({
  selector: 'app-module-flows-dialog',
  templateUrl: './module-flows-dialog.component.html',
  styleUrls: ['./module-flows-dialog.component.scss'],
  // The rendered markdown is inserted outside Angular's templates, so emulated encapsulation
  // would never reach it. Every rule is scoped under .module-flows instead.
  encapsulation: ViewEncapsulation.None,
})
export class ModuleFlowsDialogComponent implements OnInit, OnDestroy {
  readonly docs = FLOW_DOCS;
  active: FlowDocKey;
  loading = true;
  error: string | null = null;

  @ViewChild('content', { static: true }) private readonly contentRef!: ElementRef<HTMLElement>;

  /** Bumped on every doc switch so a slow render of the previous doc can't overwrite the new one. */
  private renderSeq = 0;
  private loadSub?: Subscription;

  constructor(
    @Inject(MAT_DIALOG_DATA) data: ModuleFlowsDialogData,
    private readonly http: HttpClient
  ) {
    this.active = data.module;
  }

  ngOnInit(): void {
    this.show(this.active);
  }

  ngOnDestroy(): void {
    this.renderSeq++;
    this.loadSub?.unsubscribe();
  }

  show(key: FlowDocKey): void {
    const doc = FLOW_DOCS.find((d) => d.key === key) ?? FLOW_DOCS[0];
    const seq = ++this.renderSeq;
    this.active = doc.key;
    this.loading = true;
    this.error = null;

    this.loadSub?.unsubscribe();
    this.loadSub = this.http.get(doc.path, { responseType: 'text' }).subscribe({
      next: (markdown) => {
        this.render(markdown, seq).catch(() => this.fail(seq));
      },
      error: () => this.fail(seq),
    });
  }

  onContentClick(event: MouseEvent): void {
    const link = (event.target as HTMLElement).closest('a[data-flow-doc]');
    if (link) {
      event.preventDefault();
      this.show(link.getAttribute('data-flow-doc') as FlowDocKey);
    }
  }

  private async render(markdown: string, seq: number): Promise<void> {
    // Loaded on first open only - mermaid is large and nothing else in the app needs it.
    const [{ marked }, { default: mermaid }] = await Promise.all([import('marked'), import('mermaid')]);
    if (seq !== this.renderSeq) {
      return;
    }

    const host = this.contentRef.nativeElement;
    // Set directly rather than through [innerHTML]: Angular's sanitizer strips the <style> element
    // Mermaid puts inside every SVG. The markdown is first-party, bundled at build time, never user input.
    host.innerHTML = await marked.parse(markdown);
    this.rewriteLinks(host);

    // useMaxWidth false on every diagram type used here. Left at its default, Mermaid emits
    // width="100%" and scales the SVG down to whatever it is sitting in - these charts are up to
    // 2100px wide, so in a 1000px dialog every label shrank to an unreadable smear and the chart
    // read as blank. Explicit pixel dimensions keep the text at its intended size and let
    // .flow-chart's overflow-x scroll a wide chart instead.
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'neutral',
      flowchart: { useMaxWidth: false },
      sequence: { useMaxWidth: false },
      state: { useMaxWidth: false },
    });
    for (const code of Array.from(host.querySelectorAll('pre > code.language-mermaid'))) {
      const chart = document.createElement('div');
      chart.className = 'flow-chart';
      try {
        const { svg } = await mermaid.render(`module-flow-${++chartSequence}`, code.textContent ?? '');
        if (seq !== this.renderSeq) {
          return;
        }
        chart.innerHTML = svg;
      } catch {
        chart.classList.add('flow-chart--error');
        chart.textContent = 'This chart could not be drawn.';
      }
      code.parentElement?.replaceWith(chart);
    }

    host.closest('.mat-mdc-dialog-content')?.scrollTo(0, 0);
    this.loading = false;
  }

  /** Cross-links to other flow docs switch the dialog; links to source files become plain code text. */
  private rewriteLinks(host: HTMLElement): void {
    for (const link of Array.from(host.querySelectorAll('a'))) {
      const target = flowDocForHref(link.getAttribute('href') ?? '');
      if (target) {
        link.setAttribute('href', '#');
        link.setAttribute('data-flow-doc', target);
      } else {
        const code = document.createElement('code');
        code.textContent = link.textContent;
        link.replaceWith(code);
      }
    }
  }

  private fail(seq: number): void {
    if (seq === this.renderSeq) {
      this.loading = false;
      this.error = 'Could not load this flow document.';
    }
  }
}
