import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export type Manifest = Record<string, string[]>;

@Injectable({ providedIn: 'root' })
export class ManifestService {
  private manifest: Manifest | null = null;

  constructor(private http: HttpClient) {}

  async load(): Promise<void> {
    if (this.manifest) return;
    this.manifest = await firstValueFrom(
      this.http.get<Manifest>('/assets/manifest.json', { responseType: 'json' as const })
    );
  }

  list(key: string): string[] {
    if (!this.manifest) return [];
    const files = this.manifest[key] ?? [];
    return files.map((f) => `/assets/seat-images/${key}/${f}`);
  }

  listNames(key: string): string[] {
    if (!this.manifest) return [];
    return this.manifest[key] ?? [];
  }
}
