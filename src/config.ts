import * as fs from 'fs-extra';
import * as path from 'path';
import { Profile, ProfileStore } from './types';

export class LocalProfileStore implements ProfileStore {
  profilesDir: string;

  constructor(profilesDir?: string) {
    if (profilesDir) {
      this.profilesDir = profilesDir;
    } else {
      // Default to profiles directory next to this module
      this.profilesDir = path.join(__dirname, '..', 'profiles');
    }
  }

  listProfiles(): Profile[] {
    const profiles: Profile[] = [];

    if (!fs.existsSync(this.profilesDir)) {
      return profiles;
    }

    const files = fs.readdirSync(this.profilesDir).sort();

    for (const filename of files) {
      if (!filename.endsWith('.json') || filename.endsWith('.example.json')) {
        continue;
      }

      const filepath = path.join(this.profilesDir, filename);
      try {
        const data = fs.readJSONSync(filepath);
        profiles.push({
          name: data.name || path.basename(filename, '.json'),
          provider: data.provider || path.basename(filename, '.json'),
          env: data.env || {}
        });
      } catch (e) {
        console.warn(`Warning: Skipping invalid profile ${filename}: ${e}`);
      }
    }

    return profiles;
  }

  getProfile(name: string): Profile | null {
    const profiles = this.listProfiles();
    for (const profile of profiles) {
      if (profile.name.toLowerCase() === name.toLowerCase()) {
        return profile;
      }
      if (profile.provider.toLowerCase() === name.toLowerCase()) {
        return profile;
      }
    }
    return null;
  }

  saveProfile(profile: Profile): void {
    const filepath = path.join(this.profilesDir, `${profile.provider}.json`);
    fs.writeJSONSync(filepath, profile, { spaces: 2 });
  }

  deleteProfile(name: string): boolean {
    const profile = this.getProfile(name);
    if (!profile) {
      return false;
    }

    const filepath = path.join(this.profilesDir, `${profile.provider}.json`);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
    return true;
  }

  toExportCommands(profile: Profile): string {
    const commands: string[] = [];
    for (const [key, value] of Object.entries(profile.env)) {
      const escapedValue = value.replace(/"/g, '\\"');
      commands.push(`export ${key}="${escapedValue}"`);
    }
    return commands.join('\n');
  }
}
