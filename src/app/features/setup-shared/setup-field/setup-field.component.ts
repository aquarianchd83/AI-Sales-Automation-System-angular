import { HttpEventType } from '@angular/common/http';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormControl } from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material/core';

import { SetupAnswer, SetupField } from '../../../core/models/application-setup.model';
import { answerTokens } from '../../../core/utils/setup-rules';
import { MediaAsset } from '../../../core/models/media.model';
import { MediaService } from '../../../core/services/media.service';

/** Shows a field as invalid exactly when the wizard says so - not on Angular's own touched/dirty rules. */
class ForcedErrorMatcher implements ErrorStateMatcher {
  constructor(private readonly hasError: () => boolean) {}

  isErrorState(): boolean {
    return this.hasError();
  }
}

/**
 * Renders ONE question of a plan's setup, whatever its type. The wizard never knows about particular fields -
 * it hands each one here, and a new plan or question just works. Value in, value out, plus the error to show.
 */
@Component({
  selector: 'app-setup-field',
  templateUrl: './setup-field.component.html',
  styleUrls: ['./setup-field.component.scss'],
})
export class SetupFieldComponent implements OnChanges {
  @Input() field!: SetupField;
  @Input() value: SetupAnswer | undefined = null;
  @Input() error: string | null = null;
  @Input() currencySymbol = '';
  @Input() disabled = false;
  @Output() valueChange = new EventEmitter<SetupAnswer>();

  readonly matcher = new ForcedErrorMatcher(() => !!this.error);

  /**
   * Backs every Material input/select. Not for validation - the wizard owns that - but because Material only
   * re-evaluates a field's error state on each change-detection pass when the field has a control; without one
   * the custom matcher above is never consulted and no message would ever show.
   */
  readonly control = new FormControl<string | null>(null);

  /** What this component last sent up, so a value that merely echoes it back is not written over what the user is typing. */
  private lastEmitted: SetupAnswer | undefined;

  /** For a FileUpload: the library entry behind the stored id, once loaded. */
  asset: MediaAsset | null = null;
  uploading = false;
  uploadProgress = 0;
  uploadError: string | null = null;

  constructor(private readonly media: MediaService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value'] && JSON.stringify(this.value ?? null) !== JSON.stringify(this.lastEmitted ?? null)) {
      this.control.setValue(this.text || null, { emitEvent: false });
    }
    if (changes['disabled']) {
      if (this.disabled) {
        this.control.disable({ emitEvent: false });
      } else {
        this.control.enable({ emitEvent: false });
      }
    }
    if (this.field?.fieldType === 'FileUpload' && changes['value']) {
      this.loadAsset();
    }
  }

  /** Every answer that leaves this component goes through here. */
  emit(value: SetupAnswer): void {
    this.lastEmitted = value;
    this.valueChange.emit(value);
  }

  get id(): string {
    return `setup-${this.field.fieldKey}`;
  }

  get text(): string {
    return this.value === null || this.value === undefined || Array.isArray(this.value) ? '' : String(this.value);
  }

  get checked(): boolean {
    return this.value === true || String(this.value).toLowerCase() === 'true';
  }

  get inputType(): string {
    switch (this.field.fieldType) {
      case 'Number':
      case 'Decimal':
      case 'Currency':
        return 'number';
      case 'Email':
        return 'email';
      case 'Url':
        return 'url';
      case 'Phone':
        return 'tel';
      case 'Date':
        return 'date';
      default:
        return 'text';
    }
  }

  get step(): string | null {
    switch (this.field.fieldType) {
      case 'Number':
        return '1';
      case 'Decimal':
      case 'Currency':
        return 'any';
      default:
        return null;
    }
  }

  get maxLength(): number | null {
    const fromRules = this.field.validation?.maxLength;
    if (fromRules != null) {
      return fromRules;
    }
    return this.field.fieldType === 'Text' ? 255 : this.field.fieldType === 'MultilineText' ? 4000 : null;
  }

  get placeholder(): string {
    switch (this.field.fieldType) {
      case 'Email':
        return 'name@example.com';
      case 'Url':
        return 'https://';
      case 'Phone':
        return '+91 98765 43210';
      default:
        return '';
    }
  }

  isPicked(optionValue: string): boolean {
    return answerTokens(this.value).some((t) => t.toLowerCase() === optionValue.toLowerCase());
  }

  /** Text-like and numeric inputs. An emptied input is "no answer", never an empty string. */
  onInput(raw: string): void {
    if (raw === '') {
      this.emit(null);
      return;
    }
    const numeric = ['Number', 'Decimal', 'Currency'].includes(this.field.fieldType);
    this.emit(numeric && !Number.isNaN(Number(raw)) ? Number(raw) : raw);
  }

  onPick(optionValue: string, selected: boolean): void {
    const current = answerTokens(this.value).filter((t) => t.toLowerCase() !== optionValue.toLowerCase());
    this.emit(selected ? [...current, optionValue] : current);
  }

  // ---- File upload -----------------------------------------------------------------------------------------------

  onFileChosen(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }

    this.uploadError = null;
    this.uploading = true;
    this.uploadProgress = 0;
    this.media.upload(file).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          this.uploadProgress = Math.round((100 * event.loaded) / event.total);
        } else if (event.type === HttpEventType.Response && event.body) {
          this.asset = event.body;
          this.uploading = false;
          this.emit(event.body.id);
        }
      },
      error: () => {
        this.uploading = false;
        this.uploadError = 'The upload failed. Check the file type and size and try again.';
      },
    });
  }

  removeFile(): void {
    this.asset = null;
    this.emit(null);
  }

  private loadAsset(): void {
    const id = this.text;
    if (!id) {
      this.asset = null;
      return;
    }
    if (this.asset?.id === id) {
      return;
    }
    this.media.getById(id).subscribe({
      next: (asset) => (this.asset = asset),
      error: () => (this.asset = null),
    });
  }
}
