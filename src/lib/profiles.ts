import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import type { Profile } from '../types.js';

// Slugify a name for use as filename.
export function slugify(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '') || 'profile';
}

export function getProfilesDir(): string {
	// Use user-level config directory for persistent storage
	// Works with bunx/npx since it's outside the project directory
	const configDir = process.env['XDG_CONFIG_HOME'] || path.join(os.homedir(), '.config');
	return path.join(configDir, 'claude-profiles');
}

function ensureProfilesDir(): void {
	const profilesDir = getProfilesDir();
	// Create directory and all parent directories if needed
	if (!fs.existsSync(profilesDir)) {
		fs.mkdirSync(profilesDir, { recursive: true });
	}
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
	ensureProfilesDir();
	const profilesDir = getProfilesDir();
	const fileKey = profile.fileKey || slugify(profile.name);
	const filename = fileKey + '.json';
	const filepath = path.join(profilesDir, filename);
	const toWrite = { ...profile };
	delete toWrite.fileKey;
	fs.writeJSONSync(filepath, toWrite, { spaces: 2 });
}
