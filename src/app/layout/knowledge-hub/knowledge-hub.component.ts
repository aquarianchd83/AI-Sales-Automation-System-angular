import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { STUDIO_CONTENT_ROLES } from '../../core/models/content-studio.model';
import { AppRole } from '../../core/models/user.model';
import { AuthService } from '../../core/services/auth.service';
import { PlatformFeature } from '../../core/models/wallet.model';
import { ContentStudioService } from '../../core/services/content-studio.service';
import { EntitlementsStore } from '../../core/services/entitlements.store';

interface HubItem {
  label: string;
  icon: string;
  route: string;
  roles: string[];
  /** Hidden until the platform switches the AI Content Studio on for this tenant. */
  needsStudio?: boolean;
  /** Hidden for a tenant whose plan does not include this feature. */
  feature: PlatformFeature;
}

/**
 * Everything the AI knows about the business behind one sidenav entry: the list of screens on the left,
 * the chosen one on the right. The screens keep their own routes (/product-knowledge/..., /content-studio/...)
 * and render in the outlet; this only supplies the list beside them.
 */
@Component({
  selector: 'app-knowledge-hub',
  templateUrl: './knowledge-hub.component.html',
  styleUrls: ['./knowledge-hub.component.scss'],
})
export class KnowledgeHubComponent implements OnInit {
  readonly items: HubItem[] = [
    { label: 'Product Sources', icon: 'auto_stories', route: '/product-knowledge/sources', roles: [AppRole.Admin], feature: 'ProductKnowledge' },
    { label: 'Product Answers', icon: 'rate_review', route: '/product-knowledge/answers', roles: [AppRole.Admin], feature: 'ProductKnowledge' },
    { label: 'Business Questionnaire', icon: 'quiz', route: '/content-studio/questionnaire', roles: STUDIO_CONTENT_ROLES, needsStudio: true, feature: 'ContentStudio' },
    { label: 'Business Facts', icon: 'fact_check', route: '/content-studio/facts', roles: STUDIO_CONTENT_ROLES, needsStudio: true, feature: 'ContentStudio' },
    { label: 'What the Studio Knows', icon: 'speed', route: '/content-studio/readiness', roles: STUDIO_CONTENT_ROLES, needsStudio: true, feature: 'ContentStudio' },
    { label: 'Published Knowledge', icon: 'inventory', route: '/product-knowledge/versions', roles: [AppRole.Admin], feature: 'ProductKnowledge' },
    { label: 'Test Chat', icon: 'chat', route: '/product-knowledge/test-chat', roles: [AppRole.Admin], feature: 'ProductKnowledge' },
  ];

  studioEnabled = false;

  constructor(
    private readonly auth: AuthService,
    private readonly entitlements: EntitlementsStore,
    private readonly router: Router,
    private readonly studio: ContentStudioService,
  ) {}

  ngOnInit(): void {
    this.studio.getStatus().subscribe({
      next: (status) => (this.studioEnabled = status.enabled),
      error: () => undefined,
    });
  }

  /** The Studio's charge history shares the /content-studio module but is not a knowledge screen, so it renders without the list. */
  get showList(): boolean {
    return this.router.url.split(/[?#]/)[0] !== '/content-studio';
  }

  visibleItems(): HubItem[] {
    return this.items.filter((i) => this.auth.hasAnyRole(i.roles) && (!i.needsStudio || this.studioEnabled) && this.entitlements.has(i.feature));
  }
}
