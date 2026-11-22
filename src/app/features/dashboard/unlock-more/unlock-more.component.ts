import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import { PlatformFeature } from '../../../core/models/wallet.model';

/** One card in "Unlock more": a feature the plan lacks, and where its preview is. */
export interface UnlockCard {
  feature: PlatformFeature;
  icon: string;
  title: string;
  benefit: string;
  route: string;
}

/** The one personalised line, backed by the tenant's own numbers, and the preview it points to. */
export interface UnlockSuggestion {
  text: string;
  route: string;
}

/** The dashboard's "Unlock more" row: a card per feature the plan lacks, each opening that feature's preview, and at most one personalised line. */
@Component({
  selector: 'app-unlock-more',
  templateUrl: './unlock-more.component.html',
  styleUrls: ['./unlock-more.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UnlockMoreComponent {
  @Input() cards: UnlockCard[] = [];
  @Input() suggestion: UnlockSuggestion | null = null;
}
