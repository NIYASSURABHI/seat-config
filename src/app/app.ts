import { Component, OnInit } from '@angular/core';
import {
  FormGroup,
  FormBuilder,
  Validators,
  ReactiveFormsModule,
  FormControl,
} from '@angular/forms';
import { CommonModule, NgIf, NgFor } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ManifestService } from './services/manifest.service';

enum Step {
  Info = 0,
  SeatType = 1,
  BlastRider = 2, // Rider selection + gallery
  Options = 3,
  Review = 4,
  Success = 5,
}

type Family = 'blastrider' | 'crewrider';
type Rider = 'driver' | 'crew' | 'light_weight';
type Color = 'black' | 'green' | 'tan';
type Feature = 'headrest' | 'whiplash_bar' | 'armrest' | 'footrest' | 'bms';
type RequestKind = 'ga' | 'quote';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, NgIf, NgFor, HttpClientModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  // expose enums
  Step = Step;

  // navigation state
  step: Step = Step.Info;
  triedInfo = false;
  triedSeatType = false;

  // typed reactive form
  form: FormGroup<{
    fullName: FormControl<string>;
    organisation: FormControl<string>;
    email: FormControl<string>;
    phone: FormControl<string>;
    address: FormControl<string>;
    hearAbout: FormControl<string>;
    contactMethod: FormControl<string>;
    tellMore: FormControl<string>;
    quantity: FormControl<number>;
    seatType: FormControl<string>;
    riderType: FormControl<string>;
    consent: FormControl<boolean>;
  }>;
  hearAboutOptions: string[] = ['Website', 'Social', 'Referral', 'Event', 'Other'];
  contactMethodOptions: string[] = ['Email', 'Phone', 'WhatsApp'];

  // seat families shown on step 2
  seatTypes = ['BlastRider', 'CrewRider'] as const;

  // rider choices per family
  riderByFamily: Record<Family, string[]> = {
    blastrider: ['Driver', 'Crew'],
    crewrider: ['Driver', 'Light Weight'],
  };

  colors: Color = 'black' as Color; // current color
  colorChoices: Color[] = ['black', 'green', 'tan'];

  // features (Options step). BMS has no images.
  private readonly allFeatures: Feature[] = [
    'headrest',
    'whiplash_bar',
    'armrest',
    'footrest',
    'bms',
  ];

  // current family/rider/selection state
  family: Family = 'blastrider';
  rider: Rider | '' = '';
  pendingRider: Rider | '' = '';
  selected = new Set<Feature>();

  // gallery
  galleryUrls: string[] = [];
  requestTypes = new Set<RequestKind>();

  constructor(private fb: FormBuilder, private assets: ManifestService, private http: HttpClient) {
    this.form = this.fb.nonNullable.group({
      fullName: ['', [Validators.required, Validators.minLength(2)]],
      organisation: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', Validators.pattern(/^[+]?[\d\s-]{7,}$/)],
      address: [''], // retained for future address capture
      hearAbout: [''],
      contactMethod: [''],
      tellMore: [''],
      quantity: [1, [Validators.required, Validators.min(1)]],
      seatType: ['', Validators.required], // UI label (mapped to family)
      riderType: [''], // UI label (mapped to rider)
      consent: [false, Validators.requiredTrue],
    });
  }

  async ngOnInit() {
    await this.assets.load(); // loads /assets/manifest.json
    // wait for user to choose seat type; no default selection
  }

  // -------------------- Navigation / gating --------------------

  canProceedFromInfo(): boolean {
    return (
      this.form.controls.fullName.valid &&
      this.form.controls.organisation.valid &&
      this.form.controls.email.valid &&
      this.form.controls.phone.valid &&
      this.form.controls.quantity.valid &&
      this.form.controls.consent.valid
    );
  }

  canProceedFromSeatType(): boolean {
    return this.form.controls.seatType.valid;
  }

  next() {
    if (this.step === Step.Info) {
      this.triedInfo = true;
      if (!this.canProceedFromInfo()) return;
    }
    if (this.step === Step.SeatType) {
      this.triedSeatType = true;
      if (!this.canProceedFromSeatType()) return;
    }
    // Step 3 behavior:
    // - selecting a rider only stores a pending choice
    // - commit rider and load images only after Next
    if (this.step === Step.BlastRider) {
      const nextRider = this.pendingRider || this.rider;
      if (!nextRider) return;

      const riderChanged = this.rider !== nextRider;
      this.rider = nextRider;

      if (riderChanged) {
        this.selected.clear();
        this.colors = 'black';
      }
    }

    if (this.step < Step.Review) {
      this.step++;
      this.scrollTop();
      this.computeGallery();
    }
  }

  back() {
    if (this.step === Step.Options) {
      this.pendingRider = this.rider;
    }

    if (this.step > Step.Info) {
      this.step--;
      this.scrollTop();
      this.computeGallery();
    }
  }

  setRequestType(kind: RequestKind) {
    if (this.requestTypes.has(kind)) {
      this.requestTypes.delete(kind);
      return;
    }
    this.requestTypes.add(kind);
  }

  isRequestTypeSelected(kind: RequestKind): boolean {
    return this.requestTypes.has(kind);
  }

  restart() {
    this.step = Step.Info;
    this.triedInfo = false;
    this.triedSeatType = false;
    this.family = 'blastrider';
    this.rider = '';
    this.pendingRider = '';
    this.selected.clear();
    this.colors = 'black';
    this.galleryUrls = [];
    this.requestTypes.clear();

    this.form.reset({
      fullName: '',
      organisation: '',
      email: '',
      phone: '',
      address: '',
      hearAbout: '',
      contactMethod: '',
      tellMore: '',
      quantity: 1,
      seatType: '',
      riderType: '',
      consent: false,
    });
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.scrollTop();
  }

  async submit() {
    const payload = {
      fullName: this.form.value.fullName,
      organisation: this.form.value.organisation,
      email: this.form.value.email,
      phone: this.form.value.phone,
      hearAbout: this.form.value.hearAbout,
      contactMethod: this.form.value.contactMethod,
      tellMore: this.form.value.tellMore,
      seatType: this.form.value.seatType,
      riderType: this.form.value.riderType,
      color: this.colors,
      features: Array.from(this.selected),
      quantity: this.specQuantity(),
      requestTypes: Array.from(this.requestTypes),
    };
    try {
      await firstValueFrom(this.http.post('/api/send', payload));
      this.step = this.Step.Success;
      this.requestTypes.clear();
      this.scrollTop();
    } catch (err) {
      console.error('Email failed', err);
      alert('Email failed. Try again.');
    }
  }

  scrollTop() {
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {}
  }

  // -------------------- Mapping helpers --------------------

  private toFamily(label: string): Family {
    return label.toLowerCase().replace(/\s+/g, '_') as Family;
  }
  private toRider(label: string): Rider {
    return label.toLowerCase().replace(/\s+/g, '_') as Rider;
  }

  // -------------------- Change handlers --------------------

  onSeatTypeChange(label: string) {
    this.family = this.toFamily(label);
    this.form.patchValue({ seatType: label, riderType: '' });
    this.rider = '';
    this.pendingRider = '';
    this.selected.clear();
    this.colors = 'black' as Color;
    this.galleryUrls = [];

    // stay on this step; navigation only via Next
  }

  onRiderPick(label: string) {
    this.form.controls.riderType.setValue(label);
    this.pendingRider = this.toRider(label);
  }

  isRiderSelected(label: string): boolean {
    const selectedRider = this.pendingRider || this.rider;
    return selectedRider === this.toRider(label);
  }

  onColorPick(c: Color) {
    this.colors = c;
    this.computeGallery();
  }

  toggleFeature(f: Feature) {
    if (f === 'whiplash_bar' && this.isWhiplashDisabled()) return;

    // CrewRider → Light Weight rule:
    //   Headrest & Whiplash Bar are combined assets; selecting either selects both.
    if (this.family === 'crewrider' && this.rider === 'light_weight') {
      if (f === 'headrest' || f === 'whiplash_bar') {
        const hasHead = this.selected.has('headrest');
        const hasWhip = this.selected.has('whiplash_bar');
        if (hasHead && hasWhip) {
          this.selected.delete('headrest');
          this.selected.delete('whiplash_bar');
        } else {
          this.selected.add('headrest');
          this.selected.add('whiplash_bar');
        }
      } else {
        this.selected.has(f) ? this.selected.delete(f) : this.selected.add(f);
      }
    } else {
      this.selected.has(f) ? this.selected.delete(f) : this.selected.add(f);
    }

    // Global rule: Whiplash Bar only applicable if Headrest selected
    if (f === 'headrest' && !this.selected.has('headrest')) {
      this.selected.delete('whiplash_bar');
    }

    this.computeGallery();
  }

  riderChoicesForCurrentFamily(): string[] {
    return this.riderByFamily[this.family];
  }

  availableFeatures(): Feature[] {
    // Guard: if rider not picked yet, show nothing
    if (!this.rider) return [];

    // BlastRider - Driver
    if (this.family === 'blastrider' && this.rider === 'driver') {
      return ['bms', 'headrest', 'whiplash_bar', 'armrest'];
    }

    // BlastRider - Crew
    if (this.family === 'blastrider' && this.rider === 'crew') {
      return ['bms', 'headrest', 'whiplash_bar', 'footrest'];
    }

    // CrewRider - Driver
    if (this.family === 'crewrider' && this.rider === 'driver') {
      return ['headrest', 'whiplash_bar', 'armrest'];
    }

    // CrewRider - Light Weight
    if (this.family === 'crewrider' && this.rider === 'light_weight') {
      return ['headrest', 'whiplash_bar', 'footrest'];
    }

    return [];
  }

  seatHeading(): string {
    const seat = this.form.controls.seatType.value || '';
    const variant = this.variantLabel();
    if (!seat) return 'Review';
    return variant ? `${seat} - ${variant}` : seat;
  }

  specVariant(): string {
    return this.variantLabel() || '-';
  }

  private variantLabel(): string {
    if (!this.rider) return '';
    if (this.family === 'blastrider') {
      return this.rider === 'crew' ? 'Crew' : 'Driver/Commander';
    }
    return this.rider === 'light_weight' ? 'Crew (Light Weight)' : 'Driver/Commander';
  }

  specMountType(): string {
    if (!this.rider) return '-';
    if (this.family === 'blastrider' && this.rider === 'crew') {
      return 'Base / Vertical / Overhead Bracket';
    }
    if (this.family === 'crewrider' && this.rider === 'light_weight') {
      return 'Vertical Bracket';
    }
    return 'Base Bracket';
  }

  specSeatBelt(): string {
    if (!this.rider) return '-';
    if (this.family === 'crewrider' && this.rider === 'light_weight') return '4 point';
    return '5 point';
  }

  specFabric(): string {
    if (!this.rider) return '-';
    if (this.family === 'crewrider' && this.rider === 'light_weight') return 'Nylon 1000d';
    return 'PU Coated Nylon 1000d';
  }

  specColour(): string {
    const map: Record<Color, string> = {
      black: 'BLACK - CODE 17',
      green: 'GREEN - CODE 4M',
      tan: 'TAN - CODE 2A',
    };
    return map[this.colors] || this.colors.toUpperCase();
  }

  specQuantity(): number {
    return Number(this.form.controls.quantity.value) || 0;
  }

  specRequestLabel(): string {
    const selected = Array.from(this.requestTypes).sort();
    if (selected.length === 0) return 'Submit';
    return selected.map((r) => (r === 'ga' ? 'GA Drawing' : 'Quote')).join(' + ');
  }

  adjustQty(delta: number) {
    const current = Number(this.form.controls.quantity.value) || 0;
    const next = Math.max(1, current + delta);
    this.form.controls.quantity.setValue(next);
    this.form.controls.quantity.markAsTouched();
  }

  selectedOptionsForSpec(): string[] {
    if (this.selected.size === 0) return [];
    const sorted = Array.from(this.selected).slice().sort();
    const labels: string[] = [];

    const hasHead = sorted.includes('headrest');
    const hasWhip = sorted.includes('whiplash_bar');

    if (this.family === 'crewrider' && this.rider === 'light_weight' && (hasHead || hasWhip)) {
      labels.push('Headrest + Whiplash Bar');
    } else {
      if (hasHead) labels.push('Headrest');
      if (hasWhip) labels.push('Whiplash Bar');
    }

    if (sorted.includes('armrest')) labels.push('Armrest');
    if (sorted.includes('footrest')) labels.push('Footrest');
    if (sorted.includes('bms')) labels.push('BMS');

    return labels;
  }

  // -------------------- Gallery computation (manifest-driven) --------------------

  private computeGallery() {
    if (!this.rider) {
      this.galleryUrls = [];
      return;
    }

    const baseKey = `${this.family}/${this.rider as Rider}/${this.colors}`;
    const defaultKey = `${baseKey}/default`;
    const referenceKey = `${baseKey}/reference`;

    const loadDefaults = () => {
      const defaults = this.assets.list(defaultKey);
      this.galleryUrls = (defaults ?? []).slice(0, 3);
    };

    // Variant page: always show default images (before options)
    if (this.step === Step.BlastRider) {
      loadDefaults();
      return;
    }

    // Options page:
    // - BMS is a pure toggle and must not affect image matching.
    const selectedOptions = [...this.selected].filter((f) => f !== 'bms');

    // If nothing selected, show defaults
    if (selectedOptions.length === 0) {
      loadDefaults();
      return;
    }

    // Try exact match in reference folder
    const refFiles = this.assets.listNames(referenceKey);
    if (refFiles && refFiles.length > 0) {
      const target = this.normalizeFeatures(selectedOptions);

      const matched = refFiles
        .filter((name) => {
          const features = this.featuresFromFilename(name);
          if (features.length === 0) return false;
          return this.sameSet(target, features); // exact match only
        })
        .slice(0, 3)
        .map((f) => `/assets/seat-images/${referenceKey}/${f}`);

      // If matched exists => show it
      if (matched.length > 0) {
        this.galleryUrls = matched;
        return;
      }
    }

    // No match => fallback to default images (no "No images" state anymore)
    loadDefaults();
  }

  // Show “Whiplash Bar” option only when headrest is selected? (global rule)
  isWhiplashDisabled(): boolean {
    if (this.family === 'crewrider' && this.rider === 'light_weight') return false;
    return !this.selected.has('headrest');
  }

  // convenience for template
  get selectedArray(): string[] {
    return Array.from(this.selected);
  }

  // template helper to mirror previous `f` alias usage
  get f() {
    return this.form.controls;
  }

  private normalizeFeatures(features: Feature[]): string[] {
    return features
      .map((f) => f.trim().toLowerCase())
      .filter(Boolean)
      .sort();
  }

  private featuresFromFilename(name: string): string[] {
    const match = name.match(/\(([^)]+)\)/);
    if (!match) return [];
    const inside = match[1].toLowerCase().replace(/_/g, ' ');
    return inside
      .split(',')
      .map((p) =>
        p
          .replace(/[^a-z0-9]+/g, ' ')
          .trim()
          .replace(/\s+/g, '_')
      )
      .filter(Boolean)
      .sort();
  }

  private sameSet(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((v, idx) => v === b[idx]);
  }
}
