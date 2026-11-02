import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';

import { ConnectionsOverview, SocialConnection, connectionsRedirectUri } from '../../../core/models/content-planner.model';
import { ContentPlannerService } from '../../../core/services/content-planner.service';
import { NotificationService } from '../../../core/services/notification.service';
import { SharedModule } from '../../../shared/shared.module';
import { CONNECTIONS_PATH, StudioConnectionsComponent } from './studio-connections.component';

const connection = (over: Partial<SocialConnection> = {}): SocialConnection => ({
  id: 'c1', platform: 'YouTube', accountName: 'Clinic Channel', status: 'Connected', lastError: null, connectedAt: '2026-10-20T10:00:00Z', lastUsedAt: null, ...over,
});

const overview = (over: Partial<ConnectionsOverview> = {}): ConnectionsOverview => ({ youTubeAvailable: true, connections: [connection()], ...over });

describe('StudioConnectionsComponent', () => {
  let fixture: ComponentFixture<StudioConnectionsComponent>;
  let api: jasmine.SpyObj<ContentPlannerService>;
  let notify: jasmine.SpyObj<NotificationService>;
  let router: Router;
  let dialogResult = true;

  const root = () => fixture.nativeElement as HTMLElement;
  const text = (testId: string) => (root().querySelector(`[data-testid="${testId}"]`)?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const present = (testId: string) => root().querySelector(`[data-testid="${testId}"]`) !== null;

  function render(data: ConnectionsOverview, query: Record<string, string> = {}, setup: () => void = () => undefined): StudioConnectionsComponent {
    api = jasmine.createSpyObj('ContentPlannerService', ['connections', 'youTubeConnectUrl', 'connectYouTube', 'disconnect']);
    api.connections.and.returnValue(of(data));
    notify = jasmine.createSpyObj('NotificationService', ['success', 'error', 'info']);
    setup();
    TestBed.configureTestingModule({
      declarations: [StudioConnectionsComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: ContentPlannerService, useValue: api },
        { provide: NotificationService, useValue: notify },
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(dialogResult) }) } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) } } },
      ],
    });
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(StudioConnectionsComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  beforeEach(() => (dialogResult = true));
  afterEach(() => fixture?.destroy());

  it('lists the connected accounts and what to know before publishing', () => {
    render(overview());

    expect(root().querySelector('[data-account="c1"]')!.textContent).toContain('Clinic Channel');
    expect(root().textContent).toContain('Instagram is not available yet.');
    expect(root().textContent).toContain('Nothing is ever published unless the script was approved');
    expect(root().querySelector<HTMLButtonElement>('[data-testid="connect"]')!.disabled).toBeFalse();
  });

  it('says so, and offers no Connect, when the platform has no Google sign-in set up', () => {
    render(overview({ youTubeAvailable: false, connections: [] }));

    expect(text('not-available')).toContain('not set up on this platform yet');
    expect(text('none')).toBe('No account is connected yet.');
    expect(root().querySelector<HTMLButtonElement>('[data-testid="connect"]')!.disabled).toBeTrue();
  });

  it('asks for the Google address with the page Google should return to, and shows why when it cannot', () => {
    const c = render(overview());
    api.youTubeConnectUrl.and.returnValue(throwError(() => new Error('not set up')));

    c.connect();

    expect(api.youTubeConnectUrl).toHaveBeenCalledWith(`${window.location.origin}/content-studio/connections`);
    expect(c.busy).toBeFalse();
    expect(connectionsRedirectUri('https://app.example')).toBe('https://app.example/content-studio/connections');
  });

  it('finishes the connection when Google sends the Admin back with a code, then clears the address and shows the list', () => {
    const c = render(overview(), { code: 'the-code', state: 'the-state' }, () => api.connectYouTube.and.returnValue(of(connection())));

    expect(api.connectYouTube).toHaveBeenCalledWith('the-code', 'the-state', `${window.location.origin}/content-studio/connections`);
    expect(notify.success).toHaveBeenCalledWith('Connected "Clinic Channel".');
    expect(router.navigate).toHaveBeenCalledWith([CONNECTIONS_PATH], { replaceUrl: true });
    expect(c.overview!.connections.length).toBe(1);
    expect(c.completing).toBeFalse();
  });

  it('drops a used-up code and still shows the page when the connection cannot be finished', () => {
    const c = render(overview(), { code: 'old', state: 'old' }, () => api.connectYouTube.and.returnValue(throwError(() => new Error('expired'))));

    expect(router.navigate).toHaveBeenCalledWith([CONNECTIONS_PATH], { replaceUrl: true });
    expect(notify.success).not.toHaveBeenCalled();
    expect(c.overview).not.toBeNull();
  });

  it('shows a cancelled sign-in plainly and connects nothing', () => {
    render(overview(), { error: 'access_denied' });

    expect(text('message')).toContain('cancelled');
    expect(api.connectYouTube).not.toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith([CONNECTIONS_PATH], { replaceUrl: true });
  });

  it('marks an account that needs connecting again and offers to do it', () => {
    render(overview({ connections: [connection({ status: 'NeedsReconnect', lastError: 'Google no longer accepts the saved sign-in.' })] }));

    expect(text('reconnect')).toContain('Needs to be connected again: Google no longer accepts the saved sign-in.');
    expect(present('reconnect-button')).toBeTrue();
  });

  it('disconnects only after the Admin confirms', () => {
    const c = render(overview());
    api.disconnect.and.returnValue(of(undefined));

    dialogResult = false;
    c.disconnect(c.overview!.connections[0]);
    expect(api.disconnect).not.toHaveBeenCalled();

    dialogResult = true;
    c.disconnect(c.overview!.connections[0]);
    fixture.detectChanges();

    expect(api.disconnect).toHaveBeenCalledWith('c1');
    expect(c.overview!.connections).toEqual([]);
    expect(notify.success).toHaveBeenCalledWith('Disconnected.');
  });
});
