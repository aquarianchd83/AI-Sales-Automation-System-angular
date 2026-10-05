import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';

import { TenantSettingsService } from './tenant-settings.service';

/** The tenant's own currency symbol, fetched once. Empty when it cannot be read, in which case amounts show bare. */
@Injectable({ providedIn: 'root' })
export class CurrencySymbolService {
  private readonly symbol$: Observable<string> = this.tenantSettings.getCharges().pipe(
    map((charges) => charges.currencySymbol),
    catchError(() => of('')),
    shareReplay(1)
  );

  constructor(private readonly tenantSettings: TenantSettingsService) {}

  get(): Observable<string> {
    return this.symbol$;
  }
}
