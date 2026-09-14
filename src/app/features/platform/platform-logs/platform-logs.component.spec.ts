import { ActivatedRoute, Router } from '@angular/router';

import { LOG_LEVELS } from '../../../core/models/platform.model';
import { PlatformLogService } from '../../../core/services/platform-log.service';
import { PlatformTenantService } from '../../../core/services/platform-tenant.service';
import { ALL_LEVELS, PlatformLogsComponent } from './platform-logs.component';

describe('PlatformLogsComponent level selection', () => {
  let component: PlatformLogsComponent;

  /** Simulates the dropdown emitting `selected`, and returns what the control settles on. */
  function pick(selected: string[]): string[] {
    component.levelControl.setValue(selected);
    return component.levelControl.value;
  }

  beforeEach(() => {
    component = new PlatformLogsComponent(
      {} as PlatformLogService,
      {} as PlatformTenantService,
      {} as ActivatedRoute,
      {} as Router
    );
    // Only the level subscription is under test, so wire it up without the rest of ngOnInit's
    // HTTP calls: applyFilters would reload, which is not what these cases assert.
    spyOn<any>(component, 'applyFilters');
    component.levelControl.valueChanges.subscribe((selected) => {
      const levels = component.normalizeLevels(selected);
      (component as any).selectedLevels = levels;
      if (levels.join() !== selected.join()) {
        component.levelControl.setValue(levels, { emitEvent: false });
      }
    });
  });

  it('starts on All', () => {
    expect(component.levelControl.value).toEqual([ALL_LEVELS]);
  });

  it('drops All when a specific level is ticked', () => {
    expect(pick([ALL_LEVELS, 'Error'])).toEqual(['Error']);
  });

  it('keeps several specific levels, in severity order', () => {
    pick(['Error']);
    expect(pick(['Warning', 'Error'])).toEqual(['Error', 'Warning']);
  });

  it('clears the specific levels when All is ticked', () => {
    pick(['Error']);
    expect(pick(['Error', ALL_LEVELS])).toEqual([ALL_LEVELS]);
  });

  it('falls back to All when the last level is unticked', () => {
    pick(['Error']);
    expect(pick([])).toEqual([ALL_LEVELS]);
  });

  it('falls back to All when every level is ticked', () => {
    pick(['Error']);
    expect(pick([...LOG_LEVELS])).toEqual([ALL_LEVELS]);
  });
});
