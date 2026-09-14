import { Component } from '@angular/core';

/**
 * Wraps every Platform Admin Console screen with a consistent header. Navigation between the 8
 * screens lives in the main app shell's sidenav (see ShellComponent.platformNavSections) — the same
 * vertical-list shape the tenant nav uses — not a tab strip here, so this component has nothing
 * left to do but render the header and let the router fill in the rest.
 */
@Component({
  selector: 'app-platform-shell',
  templateUrl: './platform-shell.component.html',
  styleUrls: ['./platform-shell.component.scss'],
})
export class PlatformShellComponent {}
