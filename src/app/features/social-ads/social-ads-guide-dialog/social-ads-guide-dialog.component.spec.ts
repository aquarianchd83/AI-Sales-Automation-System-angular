import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { SharedModule } from '../../../shared/shared.module';
import { NotificationService } from '../../../core/services/notification.service';
import { SocialAdsGuideDialogComponent, SocialAdsGuideDialogData } from './social-ads-guide-dialog.component';

describe('SocialAdsGuideDialogComponent', () => {
  let fixture: ComponentFixture<SocialAdsGuideDialogComponent>;
  let component: SocialAdsGuideDialogComponent;
  const notify = jasmine.createSpyObj<NotificationService>('NotificationService', ['success', 'error']);

  function create(startOnSetup: boolean): void {
    const data: SocialAdsGuideDialogData = { redirectUri: 'https://app.example.com/social-ads', startOnSetup };
    TestBed.configureTestingModule({
      declarations: [SocialAdsGuideDialogComponent],
      imports: [SharedModule, NoopAnimationsModule],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: NotificationService, useValue: notify },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    fixture = TestBed.createComponent(SocialAdsGuideDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('shows the tenant connect steps first, with the common fixes', () => {
    create(false);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Before you start');
    expect(text).toContain('Please reconnect Facebook');
  });

  it('can open on the Meta app setup tab, which lists the exact redirect address and the ads_read permission', () => {
    create(true);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Valid OAuth Redirect URIs');
    expect(text).toContain('https://app.example.com/social-ads');
    expect(text).toContain('ads_read');
  });

  it('copies the redirect address to the clipboard', async () => {
    create(true);
    const write = jasmine.createSpy('writeText').and.resolveTo();
    spyOnProperty(navigator, 'clipboard', 'get').and.returnValue({ writeText: write } as unknown as Clipboard);

    component.copyRedirectUri();
    await fixture.whenStable();

    expect(write).toHaveBeenCalledWith('https://app.example.com/social-ads');
    expect(notify.success).toHaveBeenCalled();
  });
});
