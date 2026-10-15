import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { TenantJobsDialogComponent, TenantJobsDialogData } from './tenant-jobs-dialog.component';

describe('TenantJobsDialogComponent', () => {
  const data: TenantJobsDialogData = {
    title: 'Lead discovery jobs',
    description: 'The scheduled jobs behind lead discovery.',
    jobTypes: ['lead-discovery', 'lead-follow-ups'],
  };

  function render() {
    const close = jasmine.createSpy('close');
    TestBed.configureTestingModule({
      declarations: [TenantJobsDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    const fixture = TestBed.createComponent(TenantJobsDialogComponent);
    fixture.detectChanges();
    return { fixture, close, root: fixture.nativeElement as HTMLElement };
  }

  it('shows the given title and description, and lists the job list for just those job types', () => {
    const { root } = render();

    expect(root.textContent).toContain('Lead discovery jobs');
    expect(root.textContent).toContain('The scheduled jobs behind lead discovery.');
    expect(root.querySelector('app-tenant-job-list')).not.toBeNull();
  });

  it('lets the content grow instead of scrolling', () => {
    expect(render().root.querySelector('mat-dialog-content.jobs-content')).not.toBeNull();
  });

  it('closes', () => {
    const { fixture, close } = render();
    fixture.componentInstance.close();
    expect(close).toHaveBeenCalled();
  });
});
