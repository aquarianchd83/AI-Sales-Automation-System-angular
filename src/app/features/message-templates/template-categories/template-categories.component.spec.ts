import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';

import { TemplateCategoriesComponent } from './template-categories.component';
import { TEMPLATE_CATEGORIES, templateCategoryInfo } from '../../../core/models/message-template.model';
import { SharedModule } from '../../../shared/shared.module';

describe('TemplateCategoriesComponent', () => {
  let fixture: ComponentFixture<TemplateCategoriesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TemplateCategoriesComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
    }).compileComponents();
    fixture = TestBed.createComponent(TemplateCategoriesComponent);
    fixture.detectChanges();
  });

  it('explains every category the template form offers', () => {
    const cards = fixture.nativeElement.querySelectorAll('.category-card');
    expect(cards.length).toBe(TEMPLATE_CATEGORIES.length);

    const text: string = fixture.nativeElement.textContent;
    for (const category of TEMPLATE_CATEGORIES) {
      expect(text).toContain(category);
      expect(text).toContain(templateCategoryInfo(category)!.summary);
    }
  });

  it('shows what each category is not for, and how it counts against quota', () => {
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Not for:');
    expect(text).toContain('Quota:');
  });
});
