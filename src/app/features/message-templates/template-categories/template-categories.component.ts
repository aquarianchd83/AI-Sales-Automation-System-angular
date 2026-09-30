import { Component } from '@angular/core';

import {
  TEMPLATE_CATEGORIES,
  TEMPLATE_CATEGORY_INFO,
  TemplateCategoryInfo,
} from '../../../core/models/message-template.model';

/** A plain-language guide to the three WhatsApp template categories: what each is for, what it isn't, and
 * how it counts against the tenant's quota. Static - the categories are fixed by Meta. */
@Component({
  selector: 'app-template-categories',
  templateUrl: './template-categories.component.html',
  styleUrls: ['./template-categories.component.scss'],
})
export class TemplateCategoriesComponent {
  readonly categories: TemplateCategoryInfo[] = TEMPLATE_CATEGORIES.map((c) => TEMPLATE_CATEGORY_INFO[c]);
}
