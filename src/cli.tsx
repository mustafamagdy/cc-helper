#!/usr/bin/env node

import React, { useEffect, useRef, useState } from 'react';
import { Box, Newline, Text, render, useApp, useInput } from 'ink';
import type { CustomProviderData, OnboardingData, Profile, View } from './types.js';
import { loadProfiles, removeProviderProfiles, saveProfile } from './lib/profiles.js';
import { restoreInkInput, runProfileInCurrentTerminal } from './lib/terminal.js';
import { AddProviderForm } from './ui/AddProviderForm.js';
import { ConfigureView } from './ui/ConfigureView.js';
import { Header, NavLine } from './ui/Header.js';
import { ListView } from './ui/ListView.js';
import { Menu, type MenuItem } from './ui/Menu.js';
import { ProfileEditorView } from './ui/ProfileEditorView.js';
import { SwitchView } from './ui/SwitchView.js';

const menuItems: MenuItem[] = [
	{ label: 'Switch Profile', key: 'switch' },
	{ label: 'Configure', key: 'configure' },
	{ label: 'List Profiles', key: 'list' },
];

// Store profile to run after app exits
let profileToRun: Profile | null = null;

function App() {
	const [viewStack, setViewStack] = useState<View[]>(['main']);
	const [menuIndex, setMenuIndex] = useState(0);
	const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
	const [addingCustomProvider, setAddingCustomProvider] = useState(false);
	const [lastSwitchedProfile, setLastSwitchedProfile] = useState<string | null>(null);
	const [profileVersion, setProfileVersion] = useState(0); // Force re-render when profiles change
	const escExitArmedRef = useRef(false);
	const escExitTimerRef = useRef<NodeJS.Timeout | null>(null);
	const { exit } = useApp();

	const profiles = loadProfiles();
	const view = viewStack[viewStack.length - 1] || 'main';

	useEffect(() => {
		if (!selectedProfile && !addingCustomProvider) {
			restoreInkInput();
		}
	}, [view, selectedProfile, addingCustomProvider]);

	const pushView = (nextView: View) => {
		setViewStack((prev) => [...prev, nextView]);
	};

	const popView = () => {
		setViewStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
	};

	useInput((input, key) => {
		if (key.ctrl && input === 'c') {
			process.exit(0);
		}
		if (input === 'q') {
			if (view === 'main') {
				process.exit(0);
			} else {
				popView();
				setSelectedProfile(null);
			}
			return;
		}
		if (view === 'main' && (input === 'j' || key.downArrow)) {
			setMenuIndex((menuIndex + 1) % menuItems.length);
		} else if (view === 'main' && (input === 'k' || key.upArrow)) {
			setMenuIndex((menuIndex - 1 + menuItems.length) % menuItems.length);
		} else if (view === 'main' && (key.return || input === ' ' || input === '\r' || input === '\n')) {
			const viewKey = menuItems[menuIndex].key;
			pushView(viewKey as View);
		} else if (key.escape || input === '\x1b') {
			if (view === 'main') {
				if (escExitArmedRef.current) {
					process.exit(0);
				}
				escExitArmedRef.current = true;
				if (escExitTimerRef.current) clearTimeout(escExitTimerRef.current);
				escExitTimerRef.current = setTimeout(() => {
					escExitArmedRef.current = false;
				}, 800);
			} else {
				popView();
				setSelectedProfile(null);
			}
		}
	});

	const handleConfigureProfile = (profile: Profile) => {
		setSelectedProfile(profile);
	};

	const handleAddCustomProvider = () => {
		setAddingCustomProvider(true);
	};

	const handleRemoveProvider = (providerId: string) => {
		if (providerId === 'claude') return;
		removeProviderProfiles(providerId);
		setProfileVersion((v) => v + 1);
	};

	const handleOnboardingComplete = (data: OnboardingData | null) => {
		if (selectedProfile && data) {
			const profile: Profile = {
				name: data.profileName,
				provider: selectedProfile.provider,
				env: {
					...selectedProfile.env,
					'ANTHROPIC_AUTH_TOKEN': data.token,
					'ANTHROPIC_BASE_URL': data.baseUrl,
					'ANTHROPIC_MODEL': data.model,
				},
				fileKey: selectedProfile.fileKey,
			};

			saveProfile(profile);
			setProfileVersion((v) => v + 1);
		}
		setSelectedProfile(null);
		setViewStack(['main', 'list']);
		restoreInkInput();
	};

	const handleCustomProviderComplete = (data: CustomProviderData | null) => {
		if (data) {
			const profile: Profile = {
				name: data.profileName,
				provider: data.providerId,
				env: {
					'ANTHROPIC_AUTH_TOKEN': data.token,
					'ANTHROPIC_BASE_URL': data.baseUrl,
					'ANTHROPIC_MODEL': data.defaultModel,
					'PROVIDER_NAME': data.providerName,
					'PROVIDER_AUTH_URL': data.authUrl || '',
					'PROVIDER_AUTH_INSTRUCTIONS': data.authInstructions || '',
				},
			};
			saveProfile(profile);
			setProfileVersion((v) => v + 1);
		}
		setAddingCustomProvider(false);
		setViewStack(['main', 'list']);
		restoreInkInput();
	};

	const handleSwitch = (profile: Profile) => {
		// Claude profiles don't need a token (they use direct auth)
		const needsToken = profile.provider !== 'claude' && !profile.env['ANTHROPIC_AUTH_TOKEN'];

		if (needsToken) {
			console.log(`\n\x1b[33mProfile needs token. Configure first.\x1b[0m\n`);
		} else {
			setLastSwitchedProfile(profile.name);
			// Store profile to run after Ink fully exits
			profileToRun = profile;
			// Exit Ink - the profile will be spawned after cleanup
			exit();
		}
	};

	if (selectedProfile) {
		return (
			<ProfileEditorView
				profile={selectedProfile}
				onComplete={handleOnboardingComplete}
				onCancel={() => setSelectedProfile(null)}
			/>
		);
	}
	if (addingCustomProvider) {
		return (
			<AddProviderForm
				onComplete={handleCustomProviderComplete}
				onCancel={() => setAddingCustomProvider(false)}
			/>
		);
	}

	return (
		<Box width="100%" height="100%" flexDirection="column">
			<Header
				title={
					view === 'main' ? 'Profile Manager' :
					view === 'switch' ? 'Switch Profile' :
					view === 'configure' ? 'Configure' :
					'All Profiles'
				}
			/>
			<Box flexGrow={1} paddingTop={1} paddingBottom={1} paddingLeft={2} paddingRight={2} borderStyle="round" borderColor="cyan" flexDirection="column">
				{view === 'main' && (
					<>
						<Menu items={menuItems} selected={menuIndex} onSelect={setMenuIndex} isActive={view === 'main'} />
						<Newline />
						<Text color="gray">{profiles.length} profiles configured</Text>
					</>
				)}
				{view === 'switch' && (
					<SwitchView
						onSelect={handleSwitch}
						onCancel={() => {
							popView();
							setSelectedProfile(null);
						}}
					/>
				)}
				{view === 'configure' && (
					<ConfigureView
						onConfigureProfile={handleConfigureProfile}
						onAddProvider={handleAddCustomProvider}
						onRemoveProvider={handleRemoveProvider}
					/>
				)}
				{view === 'list' && <ListView />}
			</Box>
			<NavLine />
		</Box>
	);
}

// Render the app and wait for it to exit before running profile
const { waitUntilExit } = render(<App />);

// After Ink fully exits, spawn the profile if one was selected
waitUntilExit().then(() => {
	if (profileToRun) {
		runProfileInCurrentTerminal(profileToRun);
	}
});
