import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { BehaviorSubject } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { SharedModule } from '../../shared.module';
import { ModuleFlowsButtonComponent } from './module-flows-button.component';
import { ModuleFlowsDialogComponent, flowDocForHref } from './module-flows-dialog.component';

function authFor(roles: string[]): Partial<AuthService> {
  return {
    currentUser$: new BehaviorSubject(null),
    hasAnyRole: (wanted: string[]) => wanted.some((role) => roles.includes(role)),
  } as unknown as Partial<AuthService>;
}

function configure(roles: string[], dialogData?: unknown): void {
  TestBed.configureTestingModule({
    imports: [SharedModule, NoopAnimationsModule, HttpClientTestingModule],
    providers: [
      { provide: AuthService, useValue: authFor(roles) },
      ...(dialogData ? [{ provide: MAT_DIALOG_DATA, useValue: dialogData }] : []),
    ],
  });
}

describe('flowDocForHref', () => {
  it('maps the cross-links the flow docs actually use', () => {
    expect(flowDocForHref('../../../../docs/MODULE-FLOWS.md')).toBe('overview');
    expect(flowDocForHref('../conversations/FLOWS.md')).toBe('conversations');
    expect(flowDocForHref('../src/app/features/knowledge-base/FLOWS.md')).toBe('knowledge-base');
  });

  it('returns null for source-file links and modules with no doc', () => {
    expect(flowDocForHref('../../core/models/campaign.model.ts')).toBeNull();
    expect(flowDocForHref('../billing/FLOWS.md')).toBeNull();
  });
});

describe('ModuleFlowsButtonComponent', () => {
  function render(roles: string[]) {
    configure(roles);
    const fixture = TestBed.createComponent(ModuleFlowsButtonComponent);
    fixture.componentInstance.module = 'handoffs';
    fixture.detectChanges();
    return fixture;
  }

  it('is hidden for sales staff', () => {
    const fixture = render(['SalesManager', 'SalesAgent']);

    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });

  it('opens the dialog on its own module for an Admin', () => {
    const fixture = render(['Admin']);
    const open = spyOn(TestBed.inject(MatDialog), 'open');

    fixture.nativeElement.querySelector('button').click();

    expect(open).toHaveBeenCalledWith(
      ModuleFlowsDialogComponent,
      jasmine.objectContaining({ data: { module: 'handoffs' } })
    );
  });
});

describe('ModuleFlowsDialogComponent', () => {
  // marked and mermaid are loaded by dynamic import on first open, and mermaid draws real SVG here
  // rather than being stubbed - the point of this spec is that the lazy render path actually works.
  const originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
  beforeEach(() => (jasmine.DEFAULT_TIMEOUT_INTERVAL = 30000));
  afterEach(() => (jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout));

  async function waitFor(done: () => boolean): Promise<void> {
    for (let i = 0; i < 200 && !done(); i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  it('renders the markdown, draws the charts and turns doc links into in-dialog navigation', async () => {
    configure(['Admin'], { module: 'campaigns' });
    const fixture = TestBed.createComponent(ModuleFlowsDialogComponent);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);

    http.expectOne('assets/flows/campaigns/FLOWS.md').flush(
      [
        '# Campaigns',
        '',
        'See [handoffs](../handoffs/FLOWS.md) and [the model](../../core/models/campaign.model.ts).',
        '',
        '```mermaid',
        'flowchart TD',
        '    A["Start"] --> B{"Valid?"}',
        '```',
      ].join('\n')
    );

    await waitFor(() => !fixture.componentInstance.loading);
    fixture.detectChanges();
    const doc: HTMLElement = fixture.nativeElement.querySelector('.module-flows__doc');

    expect(fixture.componentInstance.error).toBeNull();
    expect(doc.querySelector('h1')?.textContent).toBe('Campaigns');
    expect(doc.querySelector('.flow-chart svg')).not.toBeNull();
    expect(doc.querySelector('.flow-chart--error')).toBeNull();
    // The source-file link became plain text; only the doc link stayed clickable.
    expect(doc.querySelector('code')?.textContent).toBe('the model');

    (doc.querySelector('a[data-flow-doc="handoffs"]') as HTMLElement).click();

    expect(fixture.componentInstance.active).toBe('handoffs');
    http.expectOne('assets/flows/handoffs/FLOWS.md');
  });

  it('reports a doc it cannot load instead of showing an empty dialog', async () => {
    configure(['Admin'], { module: 'leads' });
    const fixture = TestBed.createComponent(ModuleFlowsDialogComponent);
    fixture.detectChanges();

    TestBed.inject(HttpTestingController)
      .expectOne('assets/flows/leads/FLOWS.md')
      .error(new ProgressEvent('404'));

    await waitFor(() => !fixture.componentInstance.loading);

    expect(fixture.componentInstance.error).toBe('Could not load this flow document.');
  });
});
