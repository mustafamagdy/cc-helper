#!/usr/bin/env node

import React, { useState, useEffect, useRef } from 'react';
import { render, Box, Text, Newline, useInput, useApp, Spacer } from 'ink';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as readline from 'readline';

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
	{
		id: 'claude',
		name: 'Anthropic Claude',
		description: 'Official Anthropic Claude API',
		baseUrl: 'https://api.anthropic.com',
		defaultModel: 'claude-sonnet-4-20250514',
		authUrl: 'https://console.anthropic.com/settings/keys',
		authInstructions: 'Get your API key from the Anthropic Console',
	},
	{
		id: 'glm',
		name: 'GLM (Zhipu AI)',
		description: "Zhipu AI's GLM models",
		baseUrl: 'https://api.z.ai/api/anthropic',
		defaultModel: 'GLM-4.7',
		authUrl: 'https://www.bigmodel.cn/devcenter/apikey',
		authInstructions: 'Get your API key from BigModel dashboard',
	},
	{
		id: 'minimax',
		name: 'MiniMax',
		description: 'MiniMax AI API',
		baseUrl: 'https://api.minimax.io/anthropic',
		defaultModel: 'MiniMax-M2.1',
		authUrl: 'https://platform.minimaxi.com/api-center',
		authInstructions: 'Get your JWT token from MiniMax platform',
	},
	{
		id: 'openrouter',
		name: 'OpenRouter',
		description: 'Unified API for multiple LLM providers',
		baseUrl: 'https://openrouter.ai/api/v1',
		defaultModel: 'anthropic/claude-3.5-sonnet',
		authUrl: 'https://openrouter.ai/keys',
		authInstructions: 'Get your API key from OpenRouter',
	},
];

function getProfilesDir(): string {
	return path.join(__dirname, '..', 'profiles');
}

function loadProfiles(): Profile[] {
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
			});
		} catch {}
	}
	return profiles;
}

function saveProfile(profile: Profile): void {
	const filepath = path.join(getProfilesDir(), `${profile.provider}.json`);
	fs.writeJSONSync(filepath, profile, { spaces: 2 });
}

function getProfile(provider: string): Profile | null {
	const profiles = loadProfiles();
	return profiles.find((p) => p.provider === provider || p.name.toLowerCase() === provider.toLowerCase()) || null;
}

type View = 'main' | 'switch' | 'configure' | 'list' | 'current' | 'export';

const menuItems = [
	{ label: '◉ Switch Profile', key: 'switch' },
	{ label: '◎ Configure', key: 'configure' },
	{ label: '◫ List Profiles', key: 'list' },
	{ label: '◫ Export', key: 'export' },
	{ label: '○ Current', key: 'current' },
];

function Menu({ selected, onSelect }: { selected: number; onSelect: (index: number) => void }) {
	useInput((input, key) => {
		if (input === 'j' || key.downArrow) {
			onSelect((selected + 1) % menuItems.length);
		} else if (input === 'k' || key.upArrow) {
			onSelect((selected - 1 + menuItems.length) % menuItems.length);
		} else if (input === '\r' || input === ' ') {
			// Parent handles selection
		}
	});

	return (
		<Box width={28} paddingTop={1} paddingLeft={1} flexDirection="column">
			<Text bold color="cyan">Claude Profile</Text>
			<Text color="gray">Manager</Text>
			<Newline />
			{menuItems.map((item, index) => (
				<Text key={item.key} color={index === selected ? 'black' : 'gray'} backgroundColor={index === selected ? 'cyan' : undefined} bold={index === selected}>
					{index === selected ? '▶ ' : '  '}{item.label}
				</Text>
			))}
			<Newline />
			<Newline />
			<Text color="gray">↑↓ Navigate</Text>
			<Text color="gray">↵ Select</Text>
			<Text color="gray">Esc Back</Text>
			<Text color="gray">Ctrl+C Quit</Text>
		</Box>
	);
}

function WelcomeView({ profileCount }: { profileCount: number }) {
	return (
		<Box paddingLeft={2} paddingRight={2} flexDirection="column">
			<Text bold inverse> Welcome to Claude Profile Manager </Text>
			<Newline />
			<Text>Manage your Claude Code provider profiles with ease.</Text>
			<Newline />
			<Text bold color="cyan">Quick Start:</Text>
			<Text>  • Press ↑/↓ to navigate the menu</Text>
			<Text>  • Press ↵ to select a section</Text>
			<Text>  • Configure your providers to get started</Text>
			<Newline />
			<Text color="cyan">{profileCount} profiles configured</Text>
		</Box>
	);
}

function SwitchView({ onSelect }: { onSelect: (profile: Profile) => void }) {
	const [selected, setSelected] = useState(0);
	const profiles = loadProfiles();

	useInput((input, key) => {
		if (input === 'j' || key.downArrow) {
			setSelected((selected + 1) % profiles.length);
		} else if (input === 'k' || key.upArrow) {
			setSelected((selected - 1 + profiles.length) % profiles.length);
		} else if (input === '\r' && profiles.length > 0) {
			onSelect(profiles[selected]);
		}
	});

	return (
		<Box paddingLeft={2} paddingRight={2} flexDirection="column">
			<Text bold inverse> Select Profile </Text>
			<Newline />
			{profiles.length === 0 ? (
				<Text color="yellow">No profiles configured. Go to Configure to add one.</Text>
			) : (
				<Box flexDirection="column">
					{profiles.map((profile, index) => (
						<Box key={profile.provider} marginBottom={1}>
							<Text color={index === selected ? 'black' : 'white'} backgroundColor={index === selected ? 'cyan' : undefined} bold={index === selected}>
								{index === selected ? '▶ ' : '  '}{profile.name} <Text color="gray">({profile.provider})</Text>
							</Text>
						</Box>
					))}
					<Newline />
					<Text color="gray">Press ↵ to switch to selected profile</Text>
				</Box>
			)}
		</Box>
	);
}

function ConfigureView({ onConfigure }: { onConfigure: (provider: Provider) => void }) {
	const [selected, setSelected] = useState(0);

	useInput((input, key) => {
		if (input === 'j' || key.downArrow) {
			setSelected((selected + 1) % KNOWN_PROVIDERS.length);
		} else if (input === 'k' || key.upArrow) {
			setSelected((selected - 1 + KNOWN_PROVIDERS.length) % KNOWN_PROVIDERS.length);
		} else if (input === '\r') {
			onConfigure(KNOWN_PROVIDERS[selected]);
		}
	});

	const provider = KNOWN_PROVIDERS[selected];
	const existingProfile = getProfile(provider.id);
	const hasToken = !!existingProfile?.env['ANTHROPIC_AUTH_TOKEN'];

	return (
		<Box paddingLeft={2} paddingRight={2} flexDirection="column">
			<Text bold inverse> Configure Provider </Text>
			<Newline />
			{KNOWN_PROVIDERS.map((p, index) => {
				const prof = getProfile(p.id);
				const hasT = !!prof?.env['ANTHROPIC_AUTH_TOKEN'];
				return (
					<Box key={p.id} marginBottom={1}>
						<Text color={index === selected ? 'black' : 'white'} backgroundColor={index === selected ? 'cyan' : undefined} bold={index === selected}>
							{index === selected ? '▶ ' : '  '}{hasT ? '✓' : '○'} {p.name}
						</Text>
					</Box>
				);
			})}
			<Newline />
			<Text bold color="cyan">{provider.name}</Text>
			<Text color="gray">{provider.description}</Text>
			<Text>API URL: {provider.baseUrl}</Text>
			<Text>Model: {provider.defaultModel}</Text>
			<Newline />
			{provider.authUrl && (
				<>
					<Text color="cyan">→ {provider.authInstructions}</Text>
					<Text color="cyan">→ {provider.authUrl}</Text>
				</>
			)}
			<Newline />
			<Text color="gray">Press ↵ to configure authentication</Text>
		</Box>
	);
}

function ListView() {
	const profiles = loadProfiles();

	return (
		<Box paddingLeft={2} paddingRight={2} flexDirection="column">
			<Text bold inverse> All Profiles </Text>
			<Newline />
			{profiles.length === 0 ? (
				<Text color="yellow">No profiles configured.</Text>
			) : (
				<Box flexDirection="column">
					{profiles.map((profile) => {
						const hasToken = !!profile.env['ANTHROPIC_AUTH_TOKEN'];
						return (
							<Box key={profile.provider} marginBottom={1} flexDirection="column">
								<Text bold color={hasToken ? 'green' : 'red'}>
									{hasToken ? '✓' : '✗'} {profile.name} <Text color="gray">({profile.provider})</Text>
								</Text>
								<Text color="gray">  Model: {profile.env['ANTHROPIC_MODEL'] || '-'}</Text>
								<Text color="gray">  URL: {profile.env['ANTHROPIC_BASE_URL'] || '-'}</Text>
								<Text color="gray">  Status: {hasToken ? 'Configured' : 'Needs token'}</Text>
							</Box>
						);
					})}
				</Box>
			)}
		</Box>
	);
}

function CurrentView() {
	const currentToken = process.env['ANTHROPIC_AUTH_TOKEN'] || '';
	const currentUrl = process.env['ANTHROPIC_BASE_URL'] || '';
	const currentModel = process.env['ANTHROPIC_MODEL'] || '';

	let matched: Profile | null = null;
	for (const p of loadProfiles()) {
		if (p.env['ANTHROPIC_AUTH_TOKEN'] === currentToken && p.env['ANTHROPIC_BASE_URL'] === currentUrl) {
			matched = p;
			break;
		}
	}

	return (
		<Box paddingLeft={2} paddingRight={2} flexDirection="column">
			<Text bold inverse> Current Status </Text>
			<Newline />
			{matched ? (
				<Text color="green">✓ {matched.name} ({matched.provider})</Text>
			) : (
				<Text color="gray">○ Unknown profile</Text>
			)}
			<Newline />
			<Text color="gray">ANTHROPIC_BASE_URL: {currentUrl || '-'}</Text>
			<Text color="gray">ANTHROPIC_MODEL: {currentModel || '-'}</Text>
			<Text color="gray">ANTHROPIC_AUTH_TOKEN: {currentToken ? '[Set]' : '[Not set]'}</Text>
		</Box>
	);
}

function ExportView() {
	const profiles = loadProfiles();

	return (
		<Box paddingLeft={2} paddingRight={2} flexDirection="column">
			<Text bold inverse> Export Profile </Text>
			<Newline />
			{profiles.length === 0 ? (
				<Text color="yellow">No profiles to export.</Text>
			) : (
				<Box flexDirection="column">
					{profiles.map((profile) => (
						<Text key={profile.provider}>  • {profile.name}</Text>
					))}
					<Newline />
					<Text color="gray">{'Run: source <(claude-profile export <profile>)'}</Text>
				</Box>
			)}
		</Box>
	);
}

function AuthForm({ provider, onComplete }: { provider: Provider; onComplete: (token: string) => void }) {
	const [token, setToken] = useState('');
	const [submitted, setSubmitted] = useState(false);
	const rl = useRef<readline.Interface | null>(null);

	useEffect(() => {
		// Use readline for input in Node.js context
		rl.current = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		});

		console.clear();
		console.log(`\n\x1b[1m\x1b[36m${provider.name}\x1b[0m`);
		console.log(`\x1b[90m${provider.description}\x1b[0m\n`);
		console.log(`API URL: \x1b[36m${provider.baseUrl}\x1b[0m`);
		console.log(`Model: \x1b[36m${provider.defaultModel}\x1b[0m\n`);
		if (provider.authUrl) {
			console.log(`\x1b[36m→\x1b[0m ${provider.authInstructions}`);
			console.log(`\x1b[36m→\x1b[0m ${provider.authUrl}\n`);
		}
		console.log('\x1b[90mEnter your authentication token:\x1b[0m');

		rl.current.question('> ', (answer) => {
			if (rl.current) {
				rl.current.close();
				rl.current = null;
			}
			onComplete(answer);
		});

		return () => {
			if (rl.current) {
				rl.current.close();
				rl.current = null;
			}
		};
	}, [provider]);

	if (submitted) {
		return (
			<Box paddingLeft={2} paddingRight={2}>
				<Text color="green">✓ Authentication complete!</Text>
			</Box>
		);
	}

	return (
		<Box paddingLeft={2} paddingRight={2}>
			<Text>Authenticating with {provider.name}...</Text>
			<Text color="gray"> (use terminal input)</Text>
		</Box>
	);
}

function App() {
	const [view, setView] = useState<View>('main');
	const [menuIndex, setMenuIndex] = useState(0);
	const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
	const [lastSwitchedProfile, setLastSwitchedProfile] = useState<string | null>(null);

	const profiles = loadProfiles();

	useInput((input, key) => {
		if (key.ctrl && input === 'c') {
			process.exit(0);
		}
		if (view === 'main' && (input === 'j' || key.downArrow)) {
			setMenuIndex((menuIndex + 1) % menuItems.length);
		} else if (view === 'main' && (input === 'k' || key.upArrow)) {
			setMenuIndex((menuIndex - 1 + menuItems.length) % menuItems.length);
		} else if (view === 'main' && (input === '\r' || input === ' ')) {
			const viewKey = menuItems[menuIndex].key;
			if (viewKey === 'export') {
				setView('export');
			} else {
				setView(viewKey as View);
			}
		} else if (key.escape) {
			setView('main');
			setSelectedProvider(null);
		}
	});

	const handleConfigure = (provider: Provider) => {
		setSelectedProvider(provider);
	};

	const handleAuthComplete = (token: string) => {
		if (selectedProvider && token.trim()) {
			const existingProfile = getProfile(selectedProvider.id);
			const profile: Profile = existingProfile || {
				name: selectedProvider.name,
				provider: selectedProvider.id,
				env: {},
			};

			profile.env['ANTHROPIC_AUTH_TOKEN'] = token.trim();
			profile.env['ANTHROPIC_BASE_URL'] = selectedProvider.baseUrl;
			if (!profile.env['ANTHROPIC_MODEL']) {
				profile.env['ANTHROPIC_MODEL'] = selectedProvider.defaultModel;
			}

			saveProfile(profile);
			console.log(`\n\x1b[32m✓ ${selectedProvider.name} configured successfully!\x1b[0m\n`);
		}
		setSelectedProvider(null);
		setView('configure');
	};

	const handleSwitch = (profile: Profile) => {
		if (profile.env['ANTHROPIC_AUTH_TOKEN']) {
			setLastSwitchedProfile(profile.name);
			console.clear();
			console.log(`\n\x1b[32m✓ Switching to ${profile.name}...\x1b[0m\n`);
			console.log(`To use this profile in your shell, run:`);
			console.log(`\x1b[36msource <(claude-profile export ${profile.name})\x1b[0m\n`);
			console.log(`Or add to your shell profile:`);
			console.log(`\x1b[36meval "$(claude-profile switch ${profile.name})"\x1b[0m\n`);
		} else {
			console.log(`\n\x1b[33mProfile needs token. Configure first.\x1b[0m\n`);
		}
	};

	if (selectedProvider) {
		return <AuthForm provider={selectedProvider} onComplete={handleAuthComplete} />;
	}

	return (
		<Box width="100%" height="100%" flexDirection="row">
			<Menu selected={menuIndex} onSelect={setMenuIndex} />
			<Box width="100%-28" paddingTop={1} paddingBottom={1} paddingLeft={2} paddingRight={2} borderStyle="round" borderColor="cyan" flexDirection="column">
				{view === 'main' && <WelcomeView profileCount={profiles.length} />}
				{view === 'switch' && <SwitchView onSelect={handleSwitch} />}
				{view === 'configure' && <ConfigureView onConfigure={handleConfigure} />}
				{view === 'list' && <ListView />}
				{view === 'current' && <CurrentView />}
				{view === 'export' && <ExportView />}
			</Box>
		</Box>
	);
}

render(<App />);
