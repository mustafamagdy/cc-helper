import React, { useState } from 'react';
import { Box, Newline, Text, useInput } from 'ink';
import type { Profile } from '../types.js';
import { loadProfiles } from '../lib/profiles.js';

export function ConfigureView({
	onConfigureProfile,
	onAddProvider,
	onRemoveProvider,
}: {
	onConfigureProfile: (profile: Profile) => void;
	onAddProvider: () => void;
	onRemoveProvider: (providerId: string) => void;
}) {
	const [selected, setSelected] = useState(0);
	const [confirmDelete, setConfirmDelete] = useState<Profile | null>(null);
	const profiles = loadProfiles();
	const totalItems = profiles.length + 1;

	useInput((input, key) => {
		if (confirmDelete) {
			if (input.toLowerCase() === 'y') {
				onRemoveProvider(confirmDelete.provider);
				setConfirmDelete(null);
				setSelected(0);
			} else if (input.toLowerCase() === 'n' || key.escape) {
				setConfirmDelete(null);
			}
			return;
		}
		if (input === 'j' || key.downArrow) {
			setSelected((selected + 1) % totalItems);
		} else if (input === 'k' || key.upArrow) {
			setSelected((selected - 1 + totalItems) % totalItems);
		} else if (key.return || input === '\r' || input === '\n') {
			if (selected === 0) {
				onAddProvider();
			} else {
				onConfigureProfile(profiles[selected - 1]);
			}
		} else if (input === 'd') {
			if (selected > 0) {
				const profile = profiles[selected - 1];
				if (profile.provider !== 'anthropic') {
					setConfirmDelete(profile);
				}
			}
		}
	});

	const profile = profiles[Math.max(0, selected - 1)];

	return (
		<>
			<Box paddingLeft={2} paddingRight={2} flexDirection="column">
				<Text bold inverse> Configure </Text>
				<Newline />
				<Box marginBottom={1}>
					<Text color={selected === 0 ? 'black' : 'white'} backgroundColor={selected === 0 ? 'cyan' : undefined} bold={selected === 0}>
						{selected === 0 ? '▶ ' : '  '}+ Add Provider
					</Text>
				</Box>
				{profiles.map((p, index) => {
					const hasToken = !!p.env['ANTHROPIC_AUTH_TOKEN'];
					const rowIndex = index + 1;
					return (
						<Box key={p.fileKey || p.name} marginBottom={1}>
							<Text color={rowIndex === selected ? 'black' : 'white'} backgroundColor={rowIndex === selected ? 'cyan' : undefined} bold={rowIndex === selected}>
								{rowIndex === selected ? '▶ ' : '  '}{hasToken ? '✓' : '○'} {p.name} <Text color="gray">({p.provider})</Text>
							</Text>
						</Box>
					);
				})}
				<Newline />
				{selected === 0 ? (
					<>
						<Text bold color="cyan">Add Provider</Text>
						<Text color="gray">Create a new provider profile</Text>
					</>
				) : (
					<>
						<Text bold color="cyan">{profile?.name || '-'}</Text>
						<Text color="gray">Provider: {profile?.provider || '-'}</Text>
						<Text>API URL: {profile?.env['ANTHROPIC_BASE_URL'] || '-'}</Text>
						<Text>Model: {profile?.env['ANTHROPIC_MODEL'] || '-'}</Text>
					</>
				)}
				<Newline />
				<Text color="gray">Press ↵ to add or update a profile for the selected provider</Text>
				<Text color="gray">Press d to remove a provider (except Anthropic)</Text>
			</Box>
			{confirmDelete && (
				<Box
					alignSelf="center"
					marginTop={1}
					paddingX={2}
					paddingY={1}
					width="80%"
					borderStyle="round"
					borderColor="yellow"
					flexDirection="column"
				>
					<Text bold color="yellow">Delete provider?</Text>
					<Text>Remove all profiles for <Text bold>{confirmDelete.name}</Text>?</Text>
					<Text color="gray">Press y to confirm, n or Esc to cancel</Text>
				</Box>
			)}
		</>
	);
}
