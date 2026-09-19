import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { BillingService } from '../../../core/services/billing.service';
import { SharedModule } from '../../shared.module';

@Component({
  template: `<app-state-select [control]="state" [country]="country"></app-state-select>`,
})
class HostComponent {
  state = new FormControl<string>('MH', { nonNullable: true });
  country: string | null = 'IN';
}

describe('StateSelectComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let getStates: jasmine.Spy;

  beforeEach(() => {
    getStates = jasmine
      .createSpy('getStates')
      .and.callFake((country: string) =>
        of(country === 'IN' ? [{ code: 'MH', name: 'Maharashtra' }, { code: 'KA', name: 'Karnataka' }] : [])
      );

    TestBed.configureTestingModule({
      declarations: [HostComponent],
      imports: [SharedModule, NoopAnimationsModule],
      providers: [{ provide: BillingService, useValue: { getStates } }],
    });

    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  const host = () => fixture.nativeElement as HTMLElement;

  it('shows a state picker for a country whose tax splits by state, keeping the chosen state', () => {
    expect(getStates).toHaveBeenCalledWith('IN');
    expect(host().querySelector('mat-form-field')).not.toBeNull();
    expect(fixture.componentInstance.state.value).toBe('MH');
  });

  it('shows nothing for a country with no states, and clears a state left over from another country', () => {
    fixture.componentInstance.country = 'GB';
    fixture.detectChanges();

    expect(getStates).toHaveBeenCalledWith('GB');
    expect(host().querySelector('mat-form-field')).toBeNull();
    expect(fixture.componentInstance.state.value).toBe('');
  });

  it('shows nothing, and asks for nothing, until a country is chosen', () => {
    getStates.calls.reset();
    fixture.componentInstance.country = null;
    fixture.detectChanges();

    expect(getStates).not.toHaveBeenCalled();
    expect(host().querySelector('mat-form-field')).toBeNull();
  });
});
