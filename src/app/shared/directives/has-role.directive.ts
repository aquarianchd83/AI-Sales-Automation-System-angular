import {
  Directive,
  Input,
  OnDestroy,
  OnInit,
  TemplateRef,
  ViewContainerRef,
} from '@angular/core';
import { Subscription } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';

/**
 * Structural directive that renders its content only for the given roles.
 *
 *   <a *appHasRole="['SuperAdmin', 'Admin']" routerLink="/users">Users</a>
 *
 * Presentation only — hiding a link is not access control. The route guards and,
 * authoritatively, the API decide what a user may actually do.
 */
@Directive({ selector: '[appHasRole]' })
export class HasRoleDirective implements OnInit, OnDestroy {
  private roles: string[] = [];
  private rendered = false;
  private subscription?: Subscription;

  @Input() set appHasRole(value: string[] | string) {
    this.roles = Array.isArray(value) ? value : [value];
    this.update();
  }

  constructor(
    private readonly templateRef: TemplateRef<unknown>,
    private readonly viewContainer: ViewContainerRef,
    private readonly auth: AuthService
  ) {}

  ngOnInit(): void {
    this.subscription = this.auth.currentUser$.subscribe(() => this.update());
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  private update(): void {
    const allowed = this.auth.hasAnyRole(this.roles);
    if (allowed && !this.rendered) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.rendered = true;
    } else if (!allowed && this.rendered) {
      this.viewContainer.clear();
      this.rendered = false;
    }
  }
}
