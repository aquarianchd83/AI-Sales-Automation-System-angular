import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { finalize } from 'rxjs/operators';

import { SettingCategory, SettingItem } from '../../../core/models/settings.model';
import { NotificationService } from '../../../core/services/notification.service';
import { SettingsService } from '../../../core/services/settings.service';

const PREFIX = 'ContentStudio:Cinematic:';

interface Section {
  title: string;
  hint: string;
  keys: string[];
}

/** Where each story studio setting is shown. Anything the API adds later that is not listed lands in "Other" instead of being hidden. */
const SECTIONS: Section[] = [
  {
    title: 'Video clips (Veo)',
    hint: 'Veo makes the scene clips through the Gemini API. Without a key only the free test clips and Google Flow import work. Create the key in Google AI Studio and enable billing on that project.',
    keys: ['GeminiApiKey', 'VeoModel', 'VeoUsdPerSecond'],
  },
  {
    title: 'Pictures and voice (OpenAI)',
    hint: 'One OpenAI key serves character pictures and voice-overs. Each has its own switch: leave them on Simulator to keep using free placeholders and test tones.',
    keys: ['OpenAiApiKey', 'CharacterImageProvider', 'ImageModel', 'ImageUsdEstimate', 'SpeechProvider', 'SpeechModel', 'SpeechUsdPerLine'],
  },
  {
    title: 'Putting the video together (ffmpeg)',
    hint: 'ffmpeg joins the clips and draws the subtitles. Leave the paths empty when ffmpeg is on the server PATH. Hindi subtitles need a Devanagari font such as Noto Sans Devanagari on the server.',
    keys: ['FfmpegPath', 'FfprobePath', 'SubtitleFontsDirectory', 'SubtitleFontName'],
  },
  {
    title: 'Limits',
    hint: 'How often a failed scene may be retried without asking. Paid regeneration beyond this always needs the user to confirm.',
    keys: ['MaxAutomaticRetries'],
  },
];

interface Group {
  title: string;
  hint: string;
  items: SettingItem[];
}

/**
 * The platform operator's screen for the cinematic story studio: provider keys, which provider makes pictures and speech, the ffmpeg and
 * subtitle font settings. Only the keys under ContentStudio:Cinematic are shown; the tenant-facing studio switches stay where they were.
 * A secret never comes back from the server, so a blank box keeps what is stored.
 */
@Component({
  selector: 'app-platform-story-settings',
  templateUrl: './platform-story-settings.component.html',
  styleUrls: ['./platform-story-settings.component.scss'],
})
export class PlatformStorySettingsComponent implements OnInit {
  groups: Group[] = [];
  form: FormGroup = this.fb.group({});
  loading = true;
  loadFailed = false;
  saving = false;

  constructor(
    private readonly settings: SettingsService,
    private readonly notifications: NotificationService,
    private readonly fb: FormBuilder,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.loadFailed = false;
    this.settings
      .getCategory('ContentStudio')
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (category) => this.show(category),
        error: () => (this.loadFailed = true),
      });
  }

  private show(category: SettingCategory): void {
    const mine = category.items.filter((i) => i.key.startsWith(PREFIX));
    const byName = new Map(mine.map((i) => [i.key.slice(PREFIX.length), i]));
    const used = new Set<string>();

    const groups: Group[] = SECTIONS.map((s) => ({
      title: s.title,
      hint: s.hint,
      items: s.keys.map((k) => byName.get(k)).filter((i): i is SettingItem => !!i),
    })).filter((g) => g.items.length);
    groups.forEach((g) => g.items.forEach((i) => used.add(i.key)));

    const rest = mine.filter((i) => !used.has(i.key));
    if (rest.length) {
      groups.push({ title: 'Other', hint: '', items: rest });
    }

    this.groups = groups;
    this.form = this.fb.group(Object.fromEntries(mine.map((i) => [i.key, i.isSecret ? '' : i.value ?? ''])));
  }

  label(item: SettingItem): string {
    return item.key.slice(PREFIX.length).replace(/([a-z])([A-Z])/g, '$1 $2');
  }

  secretHint(item: SettingItem): string {
    return item.hasValue ? item.valueHint || 'Currently set - leave blank to keep' : 'Not set';
  }

  save(): void {
    if (this.saving || this.form.pristine) {
      return;
    }
    const values: Record<string, string | null> = {};
    for (const group of this.groups) {
      for (const item of group.items) {
        const control = this.form.get(item.key);
        if (!control?.dirty) {
          continue;
        }
        const value = String(control.value ?? '').trim();
        // A blank secret means "keep what is stored", so it is never sent.
        if (item.isSecret && !value) {
          continue;
        }
        values[item.key] = value;
      }
    }
    if (!Object.keys(values).length) {
      return;
    }

    this.saving = true;
    this.settings
      .update('ContentStudio', values)
      .pipe(finalize(() => (this.saving = false)))
      .subscribe(() => {
        this.notifications.success('Story studio settings saved. They apply from the next request.');
        this.load();
      });
  }
}
