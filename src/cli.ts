#!/usr/bin/env node

import * as fs from 'fs-extra';
import * as path from 'path';

interface Profile {
	name: string;
	provider: string;
	env: { [key: string]: string };
}

interface Provider {
	id: string;
	name: string;
	description: string;
	baseUrl: string;
	defaultModel: string;
	authUrl?: string;
	authInstructions?: string;
}

const KNOWN_PROVIDERS: Provider[] = [
	{ id: 'claude', name: 'Anthropic Claude', description: 'Official Anthropic Claude API', baseUrl: 'https://api.anthropic.com', defaultModel: 'claude-sonnet-4-20250514', authUrl: 'https://console.anthropic.com/settings/keys', authInstructions: 'Get your API key from the Anthropic Console' },
	{ id: 'glm', name: 'GLM (Zhipu AI)', description: "Zhipu AI's GLM models", baseUrl: 'https://api.z.ai/api/anthropic', defaultModel: 'GLM-4.7', authUrl: 'https://www.bigmodel.cn/devcenter/apikey', authInstructions: 'Get your API key from BigModel dashboard' },
	{ id: 'minimax', name: 'MiniMax', description: 'MiniMax AI API', baseUrl: 'https://api.minimax.io/anthropic', defaultModel: 'MiniMax-M2.1', authUrl: 'https://platform.minimaxi.com/api-center', authInstructions: 'Get your JWT token from MiniMax platform' },
	{ id: 'openrouter', name: 'OpenRouter', description: 'Unified API for multiple LLM providers', baseUrl: 'https://openrouter.ai/api/v1', defaultModel: 'anthropic/claude-3.5-sonnet', authUrl: 'https://openrouter.ai/keys', authInstructions: 'Get your API key from OpenRouter' },
];

function getProfilesDir(): string { return path.join(__dirname, '..', 'profiles'); }
function loadProfiles(): Profile[] {
	const profilesDir = getProfilesDir();
	if (!fs.existsSync(profilesDir)) return [];
	const profiles: Profile[] = [];
	for (const filename of fs.readdirSync(profilesDir).sort()) {
		if (!filename.endsWith('.json') || filename.endsWith('.example.json')) continue;
		try {
			const data = fs.readJSONSync(path.join(profilesDir, filename));
			profiles.push({ name: data.name || path.basename(filename, '.json'), provider: data.provider || path.basename(filename, '.json'), env: data.env || {} });
		} catch {}
	}
	return profiles;
}
function saveProfile(profile: Profile): void { fs.writeJSONSync(path.join(getProfilesDir(), `${profile.provider}.json`), profile, { spaces: 2 }); }
function getProfile(provider: string): Profile | null {
	const profiles = loadProfiles();
	return profiles.find((p) => p.provider === provider || p.name.toLowerCase() === provider.toLowerCase()) || null;
}

// Colors
const C = { reset: '\x1b[0m', bold: '\x1b[1m', cyan: '\x1b[36m', green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', gray: '\x1b[90m', white: '\x1b[37m', bgCyan: '\x1b[46m', black: '\x1b[30m' };

const menuItems = [
	{ label: 'Switch Profile', key: 'switch' },
	{ label: 'Configure', key: 'configure' },
	{ label: 'List Profiles', key: 'list' },
	{ label: 'Export', key: 'export' },
	{ label: 'Current', key: 'current' },
];

// Buffer for input when in line mode
let inputBuffer = '';
let inputCallback: ((s: string) => void) | null = null;

// Set up stdin handler once
function setupStdin() {
	const readline = require('readline');
	readline.emitKeypressEvents(process.stdin);

	process.stdin.on('keypress', (char: string, key: { ctrl: boolean; name: string }) => {
		if (inputCallback) {
			// Escape key - check both name and char (escape sends \x1b)
			if (key.name === 'escape' || char === '\x1b') {
				const cb = inputCallback;
				inputCallback = null;
				process.stdin.setRawMode(false);
				cb('');  // Resolve with empty string on escape
				inputBuffer = '';
			} else if (key.name === 'return') {
				const cb = inputCallback;
				inputCallback = null;
				process.stdin.setRawMode(false);
				cb(inputBuffer);
				inputBuffer = '';
			} else if (key.name === 'backspace' || key.name === 'delete') {
				inputBuffer = inputBuffer.slice(0, -1);
			} else if (char && char.length === 1) {
				inputBuffer += char;
			}
		}
	});
}

function prompt(text: string): Promise<string> {
	return new Promise((resolve) => {
		process.stdin.setRawMode(true);
		inputBuffer = '';
		inputCallback = resolve;
		process.stdout.write(text);
	});
}

function eraseScreen() { process.stdout.write('\x1b[2J\x1b[3J\x1b[H'); }

async function switchProfile() {
	const profiles = loadProfiles();
	if (profiles.length === 0) {
		eraseScreen();
		console.log(`\n${C.yellow}No profiles configured. Go to Configure to add one.${C.reset}\n`);
		return;
	}

	let selected = 0;
	const draw = () => {
		eraseScreen();
		console.log(`\n  ${C.bold}${C.cyan}Select Profile${C.reset}\n`);
		for (let i = 0; i < profiles.length; i++) {
			const p = profiles[i];
			const marker = i === selected ? `${C.bgCyan}${C.black} >${C.reset}` : '  ';
			const name = i === selected ? `${C.bgCyan}${C.black}${p.name}${C.reset}` : p.name;
			console.log(`${marker} ${name} ${C.gray}(${p.provider})${C.reset}`);
		}
		console.log(`\n  ${C.gray}Press Enter to switch, Esc to go back${C.reset}`);
	};

	draw();
	process.stdin.setRawMode(true);

	while (true) {
		const key = await new Promise<{ char: string; key: { ctrl: boolean; name: string } }>((resolve) => {
			const handler = (char: string, key: { ctrl: boolean; name: string }) => {
				process.stdin.removeListener('keypress', handler);
				resolve({ char, key });
			};
			process.stdin.on('keypress', handler);
		});

		if (key.key.ctrl && key.char === 'c') { process.stdin.setRawMode(false); process.exit(0); }
		if (key.key.name === 'up' || key.char === 'k') { selected = (selected - 1 + profiles.length) % profiles.length; draw(); }
		else if (key.key.name === 'down' || key.char === 'j') { selected = (selected + 1) % profiles.length; draw(); }
		else if (key.key.name === 'return') {
			const profile = profiles[selected];
			eraseScreen();
			console.log(`\n${C.green}Switching to ${profile.name}...${C.reset}\n`);
			console.log(`Run this command to use in your shell:`);
			console.log(`  ${C.cyan}source <(claude-profile export ${profile.name})${C.reset}\n`);
			process.stdin.setRawMode(false);
			return;
		}
		else if (key.key.name === 'escape') { process.stdin.setRawMode(false); return; }
	}
}

async function configure() {
	let selected = 0;
	const draw = () => {
		eraseScreen();
		console.log(`\n  ${C.bold}${C.cyan}Configure Provider${C.reset}\n`);
		for (let i = 0; i < KNOWN_PROVIDERS.length; i++) {
			const p = KNOWN_PROVIDERS[i];
			const hasToken = !!getProfile(p.id)?.env['ANTHROPIC_AUTH_TOKEN'];
			const status = hasToken ? `${C.green}[OK]${C.reset}` : `${C.gray}[--]${C.reset}`;
			const name = i === selected ? `${C.bgCyan}${C.black}${p.name}${C.reset}` : p.name;
			console.log(`  ${name}  ${status}`);
		}
		const provider = KNOWN_PROVIDERS[selected];
		console.log(`\n  ${C.bold}${provider.name}${C.reset}`);
		console.log(`  ${C.gray}${provider.description}${C.reset}`);
		console.log(`  URL: ${provider.baseUrl}`);
		console.log(`  Model: ${provider.defaultModel}\n`);
		if (provider.authUrl) { console.log(`  ${C.cyan}->${C.reset} ${provider.authInstructions}`); console.log(`  ${C.cyan}->${C.reset} ${provider.authUrl}`); }
		console.log(`\n  ${C.gray}Press Enter to configure, Esc to go back${C.reset}`);
	};

	draw();
	process.stdin.setRawMode(true);

	while (true) {
		const key = await new Promise<{ char: string; key: { ctrl: boolean; name: string } }>((resolve) => {
			const handler = (char: string, key: { ctrl: boolean; name: string }) => {
				process.stdin.removeListener('keypress', handler);
				resolve({ char, key });
			};
			process.stdin.on('keypress', handler);
		});

		if (key.key.ctrl && key.char === 'c') { process.stdin.setRawMode(false); process.exit(0); }
		if (key.key.name === 'up' || key.char === 'k') { selected = (selected - 1 + KNOWN_PROVIDERS.length) % KNOWN_PROVIDERS.length; draw(); }
		else if (key.key.name === 'down' || key.char === 'j') { selected = (selected + 1) % KNOWN_PROVIDERS.length; draw(); }
		else if (key.key.name === 'return') {
			process.stdin.setRawMode(false);
			await configureProvider(KNOWN_PROVIDERS[selected]);
			draw();
			process.stdin.setRawMode(true);
		}
		else if (key.key.name === 'escape') { process.stdin.setRawMode(false); return; }
	}
}

async function configureProvider(provider: Provider) {
	eraseScreen();
	console.log(`\n  ${C.bold}${C.cyan}Configure ${provider.name}${C.reset}\n`);
	console.log(`  ${C.gray}${provider.description}${C.reset}\n`);

	// Step 1: Base URL
	let baseUrl = provider.baseUrl;
	console.log(`  ${C.bold}Step 1:${C.reset} API Base URL`);
	console.log(`  ${C.gray}Default: ${provider.baseUrl}${C.reset}`);
	const urlInput = await prompt(`  ${C.cyan}> ${C.reset}(Enter to use default)`);
	if (urlInput.trim()) {
		baseUrl = urlInput.trim();
	}
	console.log(`  ${C.green}✓${C.reset} Base URL: ${baseUrl}\n`);

	// Step 2: Auth Method
	console.log(`  ${C.bold}Step 2:${C.reset} Authentication Method`);
	console.log(`  ${C.cyan}1)${C.reset} API Key / Token (direct input)`);
	console.log(`  ${C.cyan}2)${C.reset} OAuth / Auth Flow (opens browser)`);
	const authMethodInput = await prompt(`  ${C.cyan}> ${C.reset}Choose [1-2]`);

	let authToken = '';
	if (authMethodInput.trim() === '2' && provider.authUrl) {
		// OAuth flow
		console.log(`\n  ${C.cyan}Opening browser for authentication...${C.reset}`);
		console.log(`  ${C.gray}${provider.authInstructions}${C.reset}`);
		console.log(`  ${C.gray}${provider.authUrl}${C.reset}\n`);

		// Open browser
		const { execSync } = require('child_process');
		try {
			execSync(`open "${provider.authUrl}"`, { stdio: 'ignore' });
		} catch {
			console.log(`  ${C.yellow}Could not open browser automatically.${C.reset}`);
			console.log(`  ${C.cyan}Please open this URL manually:${C.reset}`);
			console.log(`  ${provider.authUrl}\n`);
		}

		console.log(`  ${C.bold}After completing authentication:${C.reset}`);
		console.log(`  ${C.gray}Copy your API token/auth token and paste it below${C.reset}\n`);
		authToken = await prompt(`  ${C.cyan}> ${C.reset}Paste your API token`);
	} else {
		// API key (default or user typed 1)
		console.log(`\n  ${C.cyan}Enter your API key/token${C.reset}`);
		if (provider.authInstructions) {
			console.log(`  ${C.gray}${provider.authInstructions}${C.reset}`);
			console.log(`  ${C.cyan}${provider.authUrl}${C.reset}\n`);
		}
		authToken = await prompt(`  ${C.cyan}> ${C.reset}`);
	}

	if (!authToken.trim()) {
		console.log(`\n  ${C.yellow}No token entered. Configuration cancelled.${C.reset}\n`);
		await new Promise(r => setTimeout(r, 1500));
		return;
	}

	// Step 3: Model Name
	console.log(`\n  ${C.bold}Step 3:${C.reset} Model Name`);
	console.log(`  ${C.gray}Default: ${provider.defaultModel}${C.reset}`);
	const modelInput = await prompt(`  ${C.cyan}> ${C.reset}(Enter to use default)`);
	const model = modelInput.trim() || provider.defaultModel;
	console.log(`  ${C.green}✓${C.reset} Model: ${model}\n`);

	// Step 4: Optional timeout
	console.log(`  ${C.bold}Step 4:${C.reset} Request Timeout (optional)`);
	console.log(`  ${C.gray}Default: 3000000ms (50 minutes)${C.reset}`);
	const timeoutInput = await prompt(`  ${C.cyan}> ${C.reset}(Press Enter to use default)`);
	const timeout = timeoutInput.trim() || '3000000';
	console.log(`  ${C.green}✓${C.reset} Timeout: ${timeout}ms\n`);

	// Save profile
	const existingProfile = getProfile(provider.id);
	const profile: Profile = existingProfile || { name: provider.name, provider: provider.id, env: {} };
	profile.env['ANTHROPIC_AUTH_TOKEN'] = authToken.trim();
	profile.env['ANTHROPIC_BASE_URL'] = baseUrl;
	profile.env['ANTHROPIC_MODEL'] = model;
	profile.env['API_TIMEOUT_MS'] = timeout;
	profile.env['CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC'] = '1';

	saveProfile(profile);

	console.log(`  ${C.green}✓${C.reset} ${provider.name} configured successfully!\n`);
	console.log(`  ${C.gray}Profile saved to: profiles/${provider.id}.json${C.reset}\n`);

	await new Promise(r => setTimeout(r, 1500));
}

async function listProfiles() {
	eraseScreen();
	const profiles = loadProfiles();
	console.log(`\n  ${C.bold}${C.cyan}All Profiles${C.reset}\n`);

	if (profiles.length === 0) {
		console.log(`  ${C.yellow}No profiles configured.${C.reset}\n`);
	} else {
		for (const p of profiles) {
			const hasToken = !!p.env['ANTHROPIC_AUTH_TOKEN'];
			console.log(`  ${hasToken ? C.green + '✓' + C.reset : C.red + '✗' + C.reset} ${C.bold}${p.name}${C.reset} ${C.gray}(${p.provider})${C.reset}`);
			console.log(`      ${C.gray}Model:${C.reset} ${p.env['ANTHROPIC_MODEL'] || '-'}`);
			console.log(`      ${C.gray}URL:${C.reset} ${p.env['ANTHROPIC_BASE_URL'] || '-'}`);
		}
	}
	console.log(`\n  ${C.gray}Press any key to go back...${C.reset}`);

	return new Promise<void>((resolve) => {
		process.stdin.setRawMode(true);
		const handler = () => {
			process.stdin.removeListener('keypress', handler);
			process.stdin.setRawMode(false);
			resolve();
		};
		process.stdin.once('keypress', handler);
	});
}

async function showCurrent() {
	eraseScreen();
	const currentToken = process.env['ANTHROPIC_AUTH_TOKEN'] || '';
	const currentUrl = process.env['ANTHROPIC_BASE_URL'] || '';
	const currentModel = process.env['ANTHROPIC_MODEL'] || '';

	let matched: Profile | null = null;
	for (const p of loadProfiles()) {
		if (p.env['ANTHROPIC_AUTH_TOKEN'] === currentToken && p.env['ANTHROPIC_BASE_URL'] === currentUrl) { matched = p; break; }
	}

	console.log(`\n  ${C.bold}${C.cyan}Current Status${C.reset}\n`);
	if (matched) console.log(`  ${C.green}✓${C.reset} ${C.bold}${matched.name}${C.reset} ${C.gray}(${matched.provider})${C.reset}`);
	else console.log(`  ${C.gray}○${C.reset} Unknown profile`);
	console.log(`\n  ANTHROPIC_BASE_URL: ${currentUrl || '-'}`);
	console.log(`  ANTHROPIC_MODEL: ${currentModel || '-'}`);
	console.log(`  ANTHROPIC_AUTH_TOKEN: ${currentToken ? C.green + '[Set]' + C.reset : C.red + '[Not set]' + C.reset}`);
	console.log(`\n  ${C.gray}Press any key to go back...${C.reset}`);

	return new Promise<void>((resolve) => {
		process.stdin.setRawMode(true);
		const handler = () => {
			process.stdin.removeListener('keypress', handler);
			process.stdin.setRawMode(false);
			resolve();
		};
		process.stdin.once('keypress', handler);
	});
}

async function showExport() {
	eraseScreen();
	const profiles = loadProfiles();
	console.log(`\n  ${C.bold}${C.cyan}Export Profile${C.reset}\n`);

	if (profiles.length === 0) {
		console.log(`  ${C.yellow}No profiles to export.${C.reset}\n`);
	} else {
		console.log(`  Available profiles:`);
		for (const p of profiles) console.log(`    - ${p.name}`);
		console.log(`\n  ${C.gray}Run: source <(claude-profile export <name>)${C.reset}`);
	}
	console.log(`\n  ${C.gray}Press any key to go back...${C.reset}`);

	return new Promise<void>((resolve) => {
		process.stdin.setRawMode(true);
		const handler = () => {
			process.stdin.removeListener('keypress', handler);
			process.stdin.setRawMode(false);
			resolve();
		};
		process.stdin.once('keypress', handler);
	});
}

async function main() {
	const args = process.argv.slice(2);

	if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
		console.log(`\n${C.bold}${C.white}Claude Profile Manager${C.reset}\n\n${C.cyan}Interactive TUI:${C.reset}\n  claude-profile           Start interactive mode\n\n${C.cyan}Commands:${C.reset}\n  claude-profile list      List all profiles\n  claude-profile current   Show current profile info\n  claude-profile export    Export profile env vars\n\n${C.cyan}Navigation (TUI):${C.reset}\n  Up/Down or j/k          Navigate\n  Enter                   Select\n  Esc or q                Go back\n  Ctrl+C                  Quit\n`);
		return;
	}

	const command = args[0];

	if (command === 'list') {
		const profiles = loadProfiles();
		console.log(`\n${C.bold}All Profiles${C.reset}\n`);
		if (profiles.length === 0) console.log(`${C.yellow}No profiles configured.${C.reset}\n`);
		else for (const p of profiles) {
			const hasToken = !!p.env['ANTHROPIC_AUTH_TOKEN'];
			console.log(`${hasToken ? C.green + '✓' + C.reset : C.red + '✗' + C.reset} ${C.bold}${p.name}${C.reset} (${p.provider})`);
			console.log(`    ${C.gray}Model:${C.reset} ${p.env['ANTHROPIC_MODEL'] || '-'}`);
			console.log(`    ${C.gray}URL:${C.reset} ${p.env['ANTHROPIC_BASE_URL'] || '-'}`);
		}
		console.log('');
		return;
	}

	if (command === 'current') {
		const currentToken = process.env['ANTHROPIC_AUTH_TOKEN'] || '';
		const currentUrl = process.env['ANTHROPIC_BASE_URL'] || '';
		const currentModel = process.env['ANTHROPIC_MODEL'] || '';
		let matched: Profile | null = null;
		for (const p of loadProfiles()) {
			if (p.env['ANTHROPIC_AUTH_TOKEN'] === currentToken && p.env['ANTHROPIC_BASE_URL'] === currentUrl) { matched = p; break; }
		}
		console.log(`\n${C.bold}Current Status${C.reset}\n`);
		if (matched) console.log(`${C.green}✓${C.reset} ${C.bold}${matched.name}${C.reset} (${matched.provider})`);
		else console.log(`${C.gray}○${C.reset} Unknown profile`);
		console.log(`\nANTHROPIC_BASE_URL: ${currentUrl || '-'}`);
		console.log(`ANTHROPIC_MODEL: ${currentModel || '-'}`);
		console.log(`ANTHROPIC_AUTH_TOKEN: ${currentToken ? '[Set]' : '[Not set]'}\n`);
		return;
	}

	if (command === 'export') {
		const profileName = args[1];
		if (!profileName) { console.log(`\n${C.yellow}Usage: claude-profile export <profile-name>${C.reset}\n`); return; }
		const profile = getProfile(profileName);
		if (!profile) { console.log(`\n${C.red}Profile not found: ${profileName}${C.reset}\n`); return; }
		console.log(`\n# Export ${profile.name} profile`);
		console.log(`export ANTHROPIC_AUTH_TOKEN='${profile.env['ANTHROPIC_AUTH_TOKEN'] || ''}'`);
		console.log(`export ANTHROPIC_BASE_URL='${profile.env['ANTHROPIC_BASE_URL'] || ''}'`);
		console.log(`export ANTHROPIC_MODEL='${profile.env['ANTHROPIC_MODEL'] || ''}'\n`);
		return;
	}

	// Interactive mode
	if (!process.stdin.isTTY) {
		console.log(`\n${C.bold}${C.white}Claude Profile Manager${C.reset}\n\n${C.yellow}Interactive mode requires a terminal.${C.reset}\n\nUse: claude-profile list | current | export <name>\n`);
		return;
	}

	setupStdin();
	let selected = 0;

	const draw = () => {
		eraseScreen();
		const profiles = loadProfiles();
		console.log(`\n${C.bold}${C.cyan}Claude Profile${C.reset}`);
		console.log(`${C.gray}Manager${C.reset}\n`);
		for (let i = 0; i < menuItems.length; i++) {
			const item = menuItems[i];
			if (i === selected) console.log(`${C.bgCyan}${C.black}${C.bold} > ${item.label}${C.reset}`);
			else console.log(`  ${C.gray}${item.label}${C.reset}`);
		}
		console.log(`\n${C.gray}↑↓ Navigate${C.reset}`);
		console.log(`${C.gray}Enter Select${C.reset}`);
		console.log(`${C.gray}Esc Back${C.reset}`);
		console.log(`\n${C.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.reset}`);
		console.log(`\n${C.bold}${C.white}Welcome to Claude Profile Manager${C.reset}\n`);
		console.log(`Manage your Claude Code provider profiles with ease.\n`);
		console.log(`${C.cyan}Quick Start:${C.reset}`);
		console.log(`  • Press ↑/↓ to navigate the menu`);
		console.log(`  • Press Enter to select a section`);
		console.log(`  • Configure your providers to get started\n`);
		console.log(`${profiles.length} profiles configured\n`);
		console.log(`${C.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.reset}`);
	};

	draw();
	process.stdin.setRawMode(true);

	while (true) {
		const key = await new Promise<{ char: string; key: { ctrl: boolean; name: string } }>((resolve) => {
			const handler = (char: string, key: { ctrl: boolean; name: string }) => {
				process.stdin.removeListener('keypress', handler);
				resolve({ char, key });
			};
			process.stdin.on('keypress', handler);
		});

		if (key.key.ctrl && key.char === 'c') { process.stdin.setRawMode(false); process.exit(0); }
		if (key.key.name === 'escape' || key.char === 'q') { process.stdin.setRawMode(false); return; }
		if (key.key.name === 'up' || key.char === 'k') { selected = (selected - 1 + menuItems.length) % menuItems.length; draw(); }
		else if (key.key.name === 'down' || key.char === 'j') { selected = (selected + 1) % menuItems.length; draw(); }
		else if (key.key.name === 'return' || key.char === ' ') {
			const view = menuItems[selected].key;
			process.stdin.setRawMode(false);

			switch (view) {
				case 'switch': await switchProfile(); break;
				case 'configure': await configure(); break;
				case 'list': await listProfiles(); break;
				case 'current': await showCurrent(); break;
				case 'export': await showExport(); break;
			}
			draw();
			process.stdin.setRawMode(true);
		}
	}
}

main().catch(console.error);
