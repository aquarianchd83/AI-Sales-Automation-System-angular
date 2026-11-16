import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { BehaviorSubject, of } from 'rxjs';

import { PlatformUserSearchService } from '../../../core/services/platform-user-search.service';
import { SharedModule } from '../../../shared/shared.module';
import { PlatformUserSearchComponent } from './platform-user-search.component';

describe('PlatformUserSearchComponent', () => {
  let fixture: ComponentFixture<PlatformUserSearchComponent>;
  let service: jasmine.SpyObj<PlatformUserSearchService>;
  let params$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  function create(query: Record<string, string>): void {
    params$ = new BehaviorSubject(convertToParamMap(query));
    TestBed.configureTestingModule({
      declarations: [PlatformUserSearchComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: PlatformUserSearchService, useValue: service },
        { provide: ActivatedRoute, useValue: { queryParamMap: params$.asObservable() } },
      ],
    });
    fixture = TestBed.createComponent(PlatformUserSearchComponent);
    fixture.detectChanges();
  }

  beforeEach(() => {
    service = jasmine.createSpyObj('PlatformUserSearchService', ['search']);
    service.search.and.returnValue(of([]));
  });

  it('lists the tenant users straight away when arriving from the user-count link', () => {
    create({ tenantId: 't1', tenantName: 'Bansal Corp' });

    expect(service.search).toHaveBeenCalledWith('', 't1');
    expect(fixture.nativeElement.textContent).toContain('Users of Bansal Corp');
  });

  it('does not query anything when there is no search term and no tenant', () => {
    create({});

    expect(service.search).toHaveBeenCalledWith('', null);
    expect(fixture.nativeElement.textContent).not.toContain('Users of');
  });
});
