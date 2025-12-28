#!/usr/bin/env node

import * as fs from 'fs-extra';
import * as path from 'path';

interface Profile {
	name: string;
	provider: string;
	env: { [key: string]: string };
	fileKey?: string;
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
	{ id: 'glm', name: 'GLM (Zhipu AI)', description: "Zhipu AI's GLM models", baseUrl: 'https://api.z.ai/api/anthropic', defaultModel: 'GLM-4.7', authUrl: 'https://www.bigmodel.cn/devcenter/apikey', authInstructions: 'Get your API key or Coding Plan token from BigModel dashboard' },
	{ id: 'minimax', name: 'MiniMax', description: 'MiniMax AI API', baseUrl: 'https://api.minimax.io/anthropic', defaultModel: 'MiniMax-M2.1', authUrl: 'https://platform.minimax.io/user-center/payment/coding-plan', authInstructions: 'Get your API key or Coding Plan token from MiniMax' },
	{ id: 'openrouter', name: 'OpenRouter', description: 'Unified API for multiple LLM providers', baseUrl: 'https://openrouter.ai/api/v1', defaultModel: 'anthropic/claude-3.5-sonnet', authUrl: 'https://openrouter.ai/keys', authInstructions: 'Get your API key from OpenRouter' },
];

function getProfilesDir(): string { return path.join(__dirname, '..', 'profiles'); }
function toProfileFileKey(name: string): string {
	const slug = name
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return slug || 'profile';
}
function loadProfiles(): Profile[] {
	const profilesDir = getProfilesDir();
	if (!fs.existsSync(profilesDir)) return [];
	const profiles: Profile[] = [];
	for (const filename of fs.readdirSync(profilesDir).sort()) {
		if (!filename.endsWith('.json') || filename.endsWith('.example.json')) continue;
		try {
			const data = fs.readJSONSync(path.join(profilesDir, filename));
			profiles.push({ name: data.name || path.basename(filename, '.json'), provider: data.provider || path.basename(filename, '.json'), env: data.env || {} });
			profiles[profiles.length - 1].fileKey = path.basename(filename, '.json');
		} catch {}
	}
	return profiles;
}
function saveProfile(profile: Profile): void {
	const fileKey = profile.fileKey || toProfileFileKey(profile.name);
	fs.writeJSONSync(path.join(getProfilesDir(), `${fileKey}.json`), { ...profile, fileKey: undefined }, { spaces: 2 });
}
function getProfile(provider: string): Profile | null {
	const profiles = loadProfiles();
	return profiles.find((p) => p.provider === provider || p.name.toLowerCase() === provider.toLowerCase()) || null;
}
function getProfileByName(name: string): Profile | null {
	const profiles = loadProfiles();
	return profiles.find((p) => p.name.toLowerCase() === name.toLowerCase()) || null;
}
function getProfileByFileKey(fileKey: string): Profile | null {
	const profiles = loadProfiles();
	return profiles.find((p) => p.fileKey === fileKey) || null;
}

// Colors
const C = { reset: '\x1b[0m', bold: '\x1b[1m', cyan: '\x1b[36m', green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', gray: '\x1b[90m', white: '\x1b[37m', bgCyan: '\x1b[46m', black: '\x1b[30m' };
const CURSOR_HIDE = '\x1b[?25l';
const CURSOR_SHOW = '\x1b[?25h';

const HEADER_LINES = [
	'   ██████╗ ██████╗     ██╗  ██╗███████╗██╗     ██████╗ ███████╗██████╗ ',
	'  ██╔════╝██╔════╝     ██║  ██║██╔════╝██║     ██╔══██╗██╔════╝██╔══██╗',
	'  ██║     ██║          ███████║█████╗  ██║     ██████╔╝█████╗  ██████╔╝',
	'  ██║     ██║          ██╔══██║██╔══╝  ██║     ██╔═══╝ ██╔══╝  ██╔══██╗',
	'  ╚██████╗╚██████╗     ██║  ██║███████╗███████╗██║     ███████╗██║  ██║',
	'   ╚═════╝ ╚═════╝     ╚═╝  ╚═╝╚══════╝╚══════╝╚═╝     ╚══════╝╚═╝  ╚═╝',
];
const NAV_LINE = `${C.cyan}↑↓ j/k${C.reset} ${C.gray}Navigate${C.reset}  ${C.green}Enter${C.reset} ${C.gray}Select${C.reset}  ${C.yellow}Esc/q${C.reset} ${C.gray}Back${C.reset}`;

function drawHeader(subtitleLine?: string): void {
	console.log(`\n\n`);
	for (const line of HEADER_LINES) {
		console.log(`${C.cyan}${line}${C.reset}`);
	}
	if (subtitleLine) console.log(`${subtitleLine}\n`);
	else console.log('');
}

function drawNavLine(extraHint?: string): void {
	if (extraHint) console.log(`${NAV_LINE}  ${extraHint}`);
	else console.log(NAV_LINE);
	console.log(`${C.gray}────────────────────────────────────────────────────────${C.reset}\n`);
}

function hideCursor(): void { process.stdout.write(CURSOR_HIDE); }
function showCursor(): void { process.stdout.write(CURSOR_SHOW); }

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

// Handle Ctrl+C properly
process.on('SIGINT', () => {
	process.stdin.setRawMode(false);
	process.stdout.write('\n');
	showCursor();
	process.exit(0);
});

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
				process.stdout.write('\b \b');
			} else if (char && char.length === 1) {
				inputBuffer += char;
				process.stdout.write(char);
			}
		}
	});
}

function prompt(text: string): Promise<string> {
	return new Promise((resolve) => {
		process.stdin.setRawMode(true);
		showCursor();
		inputBuffer = '';
		inputCallback = (value: string) => {
			hideCursor();
			resolve(value);
		};
		process.stdout.write(text);
	});
}

function eraseScreen() { process.stdout.write('\x1b[2J\x1b[3J\x1b[H'); }

// Detect terminal type on macOS
function getTerminalType(): 'iterm' | 'apple-terminal' | 'unknown' {
	const termProgram = process.env['TERM_PROGRAM'];
	if (termProgram === 'iTerm.app') return 'iterm';
	if (termProgram === 'Apple_Terminal') return 'apple-terminal';
	return 'unknown';
}

// Get the path to this script
function getScriptPath(): string {
	return path.resolve(__dirname, '..', 'bin', 'cli.js');
}

// Run profile in a new terminal
function runProfileInTerminal(profile: Profile): void {
	const { execSync } = require('child_process');
	const termType = getTerminalType();
	const claudePath = process.env['CLAUDE_PATH'] || 'claude';

	// Build env prefix for the command
	const envVars = Object.entries(profile.env)
		.map(([k, v]) => `${k}='${v}'`)
		.join(' ');
	const cmd = `env ${envVars} ${claudePath}`;

	let appleCmd: string;
	if (termType === 'iterm') {
		appleCmd = `osascript -e '
			tell application "iTerm2"
				create window with profile "Default"
				tell current session of current window
					write text "${cmd}"
				end tell
			end tell
		'`;
	} else {
		appleCmd = `osascript -e '
			tell app "Terminal"
				do script "${cmd}"
				activate
			end tell
		'`;
	}

	try {
		execSync(appleCmd, { stdio: 'ignore' });
	} catch (e) {
		console.log(`\n${C.red}Failed to open terminal.${C.reset}`);
		console.log(`Run manually:\n  ${cmd}\n`);
	}
}

// Run profile in current terminal (replaces this process with claude)
function runProfileInCurrentTerminal(profile: Profile): void {
	const { execSync } = require('child_process');
	const claudePath = process.env['CLAUDE_PATH'] || 'claude';

	// Build env with profile settings
	const env = { ...process.env, ...profile.env };

	// Restore terminal settings
	process.stdin.setRawMode(false);
	process.stdin.resume();
	showCursor();

	try {
		// Run claude in the current shell with profile env vars
		execSync(`exec "${claudePath}"`, {
			stdio: 'inherit',
			env,
			shell: process.env.SHELL || '/bin/zsh'
		});
	} catch (e) {
		// Claude exited normally or with an error
	}
	process.exit(0);
}

async function switchProfile() {
	const profiles = loadProfiles();
	if (profiles.length === 0) {
		eraseScreen();
		hideCursor();
		drawHeader(`    ${C.bold}Switch Profile${C.reset}`);
		console.log(`\n${C.yellow}No profiles configured. Go to Configure to add one.${C.reset}\n`);
		return;
	}

	let selected = 0;
	let runMode: 'new' | 'current' = 'current';

	const draw = () => {
		eraseScreen();
		hideCursor();
		const modeLabel = runMode === 'current' ? `${C.green}Current${C.reset}` : `${C.gray}New${C.reset}`;
		drawHeader(`    ${C.bold}Switch Profile - ${modeLabel} Terminal${C.reset}`);
		for (let i = 0; i < profiles.length; i++) {
			const p = profiles[i];
			if (i === selected) {
				console.log(`  ${C.cyan}▶${C.reset} ${C.bold}${p.name}${C.reset} ${C.gray}(${p.provider})${C.reset}`);
			} else {
				console.log(`  ${p.name} ${C.gray}(${p.provider})${C.reset}`);
			}
		}
		drawNavLine(`${C.gray}c Terminal${C.reset}`);
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
		else if (key.char === 'c' || key.char === 'C') {
			runMode = runMode === 'new' ? 'current' : 'new';
			draw();
		}
		else if (key.key.name === 'return') {
			const profile = profiles[selected];
			process.stdin.setRawMode(false);
			eraseScreen();
			if (runMode === 'current') {
				console.log(`\n${C.green}Running ${profile.name} in current terminal...${C.reset}\n`);
				runProfileInCurrentTerminal(profile);
			} else {
				console.log(`\n${C.green}Opening ${profile.name} in new terminal...${C.reset}\n`);
				runProfileInTerminal(profile);
			}
			return;
		}
		else if (key.key.name === 'escape') {
			process.stdin.setRawMode(false);
			process.stdin.removeAllListeners('keypress');
			return;
		}
	}
}

async function configure() {
	let selected = 0;
	const totalItems = KNOWN_PROVIDERS.length + 1;
	const draw = () => {
		eraseScreen();
		hideCursor();
		drawHeader(`    ${C.bold}Configure Provider${C.reset}`);
		for (let i = 0; i < totalItems; i++) {
			if (i === 0) {
				const label = `${C.green}+${C.reset} Add New Profile`;
				if (i === selected) console.log(`  ${C.cyan}▶${C.reset} ${C.bold}${label}${C.reset}`);
				else console.log(`  ${label}`);
				continue;
			}
			const p = KNOWN_PROVIDERS[i - 1];
			const hasToken = !!getProfile(p.id)?.env['ANTHROPIC_AUTH_TOKEN'];
			const status = hasToken ? `${C.green}[OK]${C.reset}` : `${C.gray}[--]${C.reset}`;
			if (i === selected) {
				console.log(`  ${C.cyan}▶${C.reset} ${C.bold}${p.name}${C.reset}  ${status}`);
			} else {
				console.log(`  ${p.name}  ${status}`);
			}
		}
		if (selected === 0) {
			console.log(`\n  ${C.bold}Add New Profile${C.reset}`);
			console.log(`  ${C.gray}Create a new profile from a provider or custom settings.${C.reset}\n`);
		} else {
			const provider = KNOWN_PROVIDERS[selected - 1];
			console.log(`\n  ${C.bold}${provider.name}${C.reset}`);
			console.log(`  ${C.gray}${provider.description}${C.reset}`);
			console.log(`  ${C.gray}Base: ${provider.baseUrl}${C.reset}`);
			console.log(`  ${C.gray}Model: ${provider.defaultModel}${C.reset}\n`);
		}
		drawNavLine();
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
		if (key.key.name === 'up' || key.char === 'k') { selected = (selected - 1 + totalItems) % totalItems; draw(); }
		else if (key.key.name === 'down' || key.char === 'j') { selected = (selected + 1) % totalItems; draw(); }
		else if (key.key.name === 'return') {
			process.stdin.setRawMode(false);
			if (selected === 0) await addNewProfileFlow();
			else await configureProvider(KNOWN_PROVIDERS[selected - 1], 'edit');
			draw();
			process.stdin.setRawMode(true);
		}
		else if (key.key.name === 'escape') { process.stdin.setRawMode(false); return; }
	}
}

async function configureProvider(provider: Provider, mode: 'add' | 'edit') {
	eraseScreen();
	hideCursor();
	const title = mode === 'add' ? `Add Profile - ${provider.name}` : `Configure ${provider.name}`;
	drawHeader(`    ${C.bold}${title}${C.reset}`);
	console.log(`  ${C.gray}${provider.description}${C.reset}\n`);

	// Step 0: Profile name
	let profileName = provider.name;
	let profileFileKey: string | undefined;
	while (true) {
		console.log(`  ${C.bold}Profile Name${C.reset}`);
		console.log(`  ${C.gray}Default: ${provider.name}${C.reset}`);
		const nameInput = await prompt(`  ${C.cyan}> ${C.reset}(Enter to use default)`);
		const desiredName = nameInput.trim() || provider.name;
		const existingByName = getProfileByName(desiredName);
		const desiredFileKey = toProfileFileKey(desiredName);
		const existingByFileKey = getProfileByFileKey(desiredFileKey);

		if (mode === 'add' && existingByName) {
			console.log(`  ${C.yellow}Name already used by another profile. Choose a different name.${C.reset}\n`);
			continue;
		}
		if (mode === 'edit' && existingByName && existingByName.provider !== provider.id) {
			console.log(`  ${C.yellow}Name already used by another provider. Choose a different name.${C.reset}\n`);
			continue;
		}
		if (mode === 'add' && existingByFileKey) {
			console.log(`  ${C.yellow}Name collides with an existing profile file. Choose a different name.${C.reset}\n`);
			continue;
		}
		if (mode === 'edit' && existingByFileKey && (!existingByName || existingByName.provider !== provider.id)) {
			console.log(`  ${C.yellow}Name collides with an existing profile file. Choose a different name.${C.reset}\n`);
			continue;
		}

		profileName = desiredName;
		if (existingByName?.provider === provider.id) profileFileKey = existingByName.fileKey;
		else profileFileKey = desiredFileKey;
		console.log(`  ${C.green}✓${C.reset} Profile name: ${profileName}\n`);
		break;
	}

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
	let authMethodChosen: string | null = 'api';
	if (provider.authUrl) {
		eraseScreen();
		drawHeader(`    ${C.bold}${title}${C.reset}`);
		console.log(`  ${C.bold}Step 2:${C.reset} Authentication Method\n`);

		let authMethodSelected = 0;
		const authMethods = ['API Key / Token', 'OAuth / Auth Flow'];

		const drawAuthMethod = () => {
			for (let i = 0; i < authMethods.length; i++) {
				const isSelected = i === authMethodSelected;
				const label = isSelected ? `${C.bold}${authMethods[i]}${C.reset}` : authMethods[i];
				if (isSelected) console.log(`  ${C.cyan}▶${C.reset} ${label}`);
				else console.log(`  ${label}`);
			}
			drawNavLine();
		};

		drawAuthMethod();
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
			if (key.key.name === 'up' || key.char === 'k') {
				authMethodSelected = (authMethodSelected - 1 + authMethods.length) % authMethods.length;
				eraseScreen();
				hideCursor();
				drawHeader(`    ${C.bold}${title}${C.reset}`);
				console.log(`  ${C.bold}Step 2:${C.reset} Authentication Method\n`);
				drawAuthMethod();
			} else if (key.key.name === 'down' || key.char === 'j') {
				authMethodSelected = (authMethodSelected + 1) % authMethods.length;
				eraseScreen();
				hideCursor();
				drawHeader(`    ${C.bold}${title}${C.reset}`);
				console.log(`  ${C.bold}Step 2:${C.reset} Authentication Method\n`);
				drawAuthMethod();
			} else if (key.key.name === 'return') {
				authMethodChosen = authMethodSelected === 1 ? 'oauth' : 'api';
				process.stdin.setRawMode(false);
				break;
			} else if (key.key.name === 'escape') {
				process.stdin.setRawMode(false);
				console.log(`\n  ${C.yellow}Configuration cancelled.${C.reset}\n`);
				await new Promise(r => setTimeout(r, 1500));
				return;
			}
		}
	}

	let authToken = '';
	if (authMethodChosen === 'oauth' && provider.authUrl) {
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
	const existingProfile = getProfileByName(profileName);
	const profile: Profile = existingProfile || { name: profileName, provider: provider.id, env: {}, fileKey: profileFileKey };
	profile.name = profileName;
	profile.provider = provider.id;
	profile.fileKey = profileFileKey;
	profile.env['ANTHROPIC_AUTH_TOKEN'] = authToken.trim();
	profile.env['ANTHROPIC_BASE_URL'] = baseUrl;
	profile.env['ANTHROPIC_MODEL'] = model;
	profile.env['API_TIMEOUT_MS'] = timeout;
	profile.env['CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC'] = '1';

	saveProfile(profile);

	console.log(`  ${C.green}✓${C.reset} ${provider.name} configured successfully!\n`);
	console.log(`  ${C.gray}Profile saved to: profiles/${profileFileKey}.json${C.reset}\n`);

	await new Promise(r => setTimeout(r, 1500));
}

async function addNewProfileFlow() {
	let selected = 0;
	const totalItems = KNOWN_PROVIDERS.length + 1;
	const draw = () => {
		eraseScreen();
		hideCursor();
		drawHeader(`    ${C.bold}Add New Profile${C.reset}`);
		const customLabel = `${C.green}+${C.reset} Custom Provider`;
		if (selected === 0) console.log(`  ${C.cyan}▶${C.reset} ${C.bold}${customLabel}${C.reset}`);
		else console.log(`  ${customLabel}`);
		for (let i = 0; i < KNOWN_PROVIDERS.length; i++) {
			const p = KNOWN_PROVIDERS[i];
			if (selected === i + 1) console.log(`  ${C.cyan}▶${C.reset} ${C.bold}${p.name}${C.reset}`);
			else console.log(`  ${p.name}`);
		}
		drawNavLine();
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
		if (key.key.name === 'up' || key.char === 'k') { selected = (selected - 1 + totalItems) % totalItems; draw(); }
		else if (key.key.name === 'down' || key.char === 'j') { selected = (selected + 1) % totalItems; draw(); }
		else if (key.key.name === 'return') {
			process.stdin.setRawMode(false);
			if (selected === 0) await addCustomProfile();
			else await configureProvider(KNOWN_PROVIDERS[selected - 1], 'add');
			draw();
			process.stdin.setRawMode(true);
		}
		else if (key.key.name === 'escape') { process.stdin.setRawMode(false); return; }
	}
}

async function addCustomProfile() {
	eraseScreen();
	hideCursor();
	drawHeader(`    ${C.bold}Add New Profile${C.reset}`);
	console.log(`  ${C.gray}Create a custom provider profile.${C.reset}\n`);

	let providerName = '';
	while (!providerName.trim()) {
		providerName = await prompt(`  ${C.cyan}> ${C.reset}Provider name`);
		if (!providerName.trim()) console.log(`  ${C.yellow}Provider name is required.${C.reset}`);
	}

	const baseUrlInput = await prompt(`  ${C.cyan}> ${C.reset}API Base URL`);
	if (!baseUrlInput.trim()) {
		console.log(`\n  ${C.yellow}Base URL is required. Cancelled.${C.reset}\n`);
		await new Promise(r => setTimeout(r, 1200));
		return;
	}

	const defaultModelInput = await prompt(`  ${C.cyan}> ${C.reset}Default Model`);
	const defaultModel = defaultModelInput.trim() || 'model';

	const authUrlInput = await prompt(`  ${C.cyan}> ${C.reset}OAuth URL (optional)`);
	const authUrl = authUrlInput.trim() || undefined;

	const authInstructionsInput = await prompt(`  ${C.cyan}> ${C.reset}Auth instructions (optional)`);
	const authInstructions = authInstructionsInput.trim() || undefined;

	const providerId = toProfileFileKey(providerName);
	const provider: Provider = {
		id: providerId,
		name: providerName,
		description: 'Custom provider',
		baseUrl: baseUrlInput.trim(),
		defaultModel,
		authUrl,
		authInstructions,
	};

	await configureProvider(provider, 'add');
}

async function listProfiles() {
	eraseScreen();
	hideCursor();
	const profiles = loadProfiles();
	drawHeader(`    ${C.bold}All Profiles${C.reset}`);

	if (profiles.length === 0) {
		console.log(`  ${C.gray}No profiles configured.${C.reset}\n`);
	} else {
		for (const p of profiles) {
			const hasToken = !!p.env['ANTHROPIC_AUTH_TOKEN'];
			console.log(`  ${hasToken ? C.green + '✓' + C.reset : C.red + '✗' + C.reset} ${C.bold}${p.name}${C.reset} ${C.gray}(${p.provider})${C.reset}`);
			console.log(`      ${C.gray}Model: ${p.env['ANTHROPIC_MODEL'] || '-'}${C.reset}`);
			console.log(`      ${C.gray}URL: ${p.env['ANTHROPIC_BASE_URL'] || '-'}${C.reset}`);
		}
	}
	drawNavLine(`${C.gray}Any key Back${C.reset}`);

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
	hideCursor();
	const currentToken = process.env['ANTHROPIC_AUTH_TOKEN'] || '';
	const currentUrl = process.env['ANTHROPIC_BASE_URL'] || '';
	const currentModel = process.env['ANTHROPIC_MODEL'] || '';

	let matched: Profile | null = null;
	for (const p of loadProfiles()) {
		if (p.env['ANTHROPIC_AUTH_TOKEN'] === currentToken && p.env['ANTHROPIC_BASE_URL'] === currentUrl) { matched = p; break; }
	}

	drawHeader(`    ${C.bold}Current Status${C.reset}`);
	if (matched) console.log(`  ${C.green}✓${C.reset} ${C.bold}${matched.name}${C.reset} ${C.gray}(${matched.provider})${C.reset}`);
	else console.log(`  ${C.gray}○${C.reset} Unknown profile`);
	console.log(`\n  ${C.gray}URL: ${currentUrl || '-'}${C.reset}`);
	console.log(`  ${C.gray}Model: ${currentModel || '-'}${C.reset}`);
	console.log(`  ${C.gray}Token: ${currentToken ? C.green + '[Set]' + C.reset : C.red + '[Not set]' + C.reset}`);
	drawNavLine(`${C.gray}Any key Back${C.reset}`);

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
	hideCursor();
	const profiles = loadProfiles();
	drawHeader(`    ${C.bold}Export Profile${C.reset}`);

	if (profiles.length === 0) {
		console.log(`  ${C.gray}No profiles to export.${C.reset}\n`);
	} else {
		for (const p of profiles) {
			console.log(`  ${C.cyan}▶${C.reset} ${p.name}`);
		}
		console.log(`\n  ${C.gray}Run: source <(claude-profile export <name>)${C.reset}`);
	}
	drawNavLine(`${C.gray}Any key Back${C.reset}`);

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

	if (args.length === 0) {
		// Interactive mode by default
		if (!process.stdin.isTTY) {
			console.log(`\n${C.bold}${C.white}Claude Profile Manager${C.reset}\n\n${C.yellow}Interactive mode requires a terminal.${C.reset}\n\nUse: claude-profile list | current | export <name>\n`);
			return;
		}
		await interactiveMode();
		return;
	}

	if (args[0] === '--help' || args[0] === '-h') {
		console.log(`\n${C.bold}${C.white}Claude Profile Manager${C.reset}\n\n${C.cyan}Interactive TUI (default):${C.reset}\n  claude-profile           Start interactive mode\n\n${C.cyan}Commands:${C.reset}\n  claude-profile list      List all profiles\n  claude-profile current   Show current profile info\n  claude-profile export    Export profile env vars\n\n${C.cyan}Navigation (TUI):${C.reset}\n  Up/Down or j/k          Navigate\n  Enter                   Select\n  Esc or q                Go back\n  Ctrl+C                  Quit\n`);
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

}

async function interactiveMode() {
	if (!process.stdin.isTTY) {
		console.log(`\n${C.bold}${C.white}Claude Profile Manager${C.reset}\n\n${C.yellow}Interactive mode requires a terminal.${C.reset}\n\nUse: claude-profile list | current | export <name>\n`);
		return;
	}

	setupStdin();
	let selected = 0;
	let escArmed = false;
	let escTimer: NodeJS.Timeout | null = null;

	const resetEsc = () => {
		escArmed = false;
		if (escTimer) {
			clearTimeout(escTimer);
			escTimer = null;
		}
	};

	const exitInteractive = () => {
		process.stdin.setRawMode(false);
		process.stdin.removeAllListeners('keypress');
		process.stdin.pause();
		showCursor();
		process.exit(0);
	};

	const draw = () => {
		eraseScreen();
		hideCursor();
		const profiles = loadProfiles();

		drawHeader(`    ${C.bold}Profile Manager${C.reset}`);

		// Menu items
		for (let i = 0; i < menuItems.length; i++) {
			const item = menuItems[i];
			const label = i === 0 ? `Switch Profile (${profiles.length})` : item.label;
			if (i === selected) console.log(`  ${C.cyan}▶${C.reset} ${C.bold}${label}${C.reset}`);
			else console.log(`  ${label}`);
		}

		// Navigation keys on one line
		drawNavLine();
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

		if (key.key.ctrl && key.char === 'c') { exitInteractive(); }
		if (key.key.name === 'escape') {
			if (escArmed) { exitInteractive(); }
			else {
				escArmed = true;
				if (escTimer) clearTimeout(escTimer);
				escTimer = setTimeout(resetEsc, 800);
			}
			continue;
		}
		if (key.char === 'q') { exitInteractive(); }
		if (key.key.name === 'up' || key.char === 'k') { selected = (selected - 1 + menuItems.length) % menuItems.length; draw(); }
		else if (key.key.name === 'down' || key.char === 'j') { selected = (selected + 1) % menuItems.length; draw(); }
		else if (key.key.name === 'return' || key.char === ' ') {
			resetEsc();
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
