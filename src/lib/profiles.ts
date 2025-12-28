import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Profile } from '../types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Slugify a name for use as filename.
export function slugify(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '') || 'profile';
}

export function getProfilesDir(): string {
	return path.join(__dirname, '..', '..', 'profiles');
}

export function loadProfiles(): Profile[] {
	const profilesDir = getProfilesDir();
	if (!fs.existsSync(profilesDir)) return [];

	const files = fs.readdirSync(profilesDir).sort();
	const profiles: Profile[] = [];

	for (const filename of files) {
		if (!filename.endsWith('.json') || filename.endsWith('.example.json')) continue;
		const filepath = path.join(profilesDir, filename);
		try {
			const data = fs.readJSONSync(filepath);
			profiles.push({
				name: data.name || path.basename(filename, '.json'),
				provider: data.provider || path.basename(filename, '.json'),
				env: data.env || {},
				fileKey: path.basename(filename, '.json'),
			});
		} catch { }
	}
	return profiles;
}

export function removeProviderProfiles(providerId: string): void {
	const profilesDir = getProfilesDir();
	if (!fs.existsSync(profilesDir)) return;
	for (const filename of fs.readdirSync(profilesDir)) {
		if (!filename.endsWith('.json') || filename.endsWith('.example.json')) continue;
		const filepath = path.join(profilesDir, filename);
		try {
			const data = fs.readJSONSync(filepath);
			if (data.provider === providerId) {
				fs.removeSync(filepath);
			}
		} catch {}
	}
}

export function saveProfile(profile: Profile): void {
	const profilesDir = getProfilesDir();
	fs.ensureDirSync(profilesDir);
	const fileKey = profile.fileKey || slugify(profile.name);
	const filename = fileKey + '.json';
	const filepath = path.join(profilesDir, filename);
	const toWrite = { ...profile };
	delete toWrite.fileKey;
	fs.writeJSONSync(filepath, toWrite, { spaces: 2 });
}
