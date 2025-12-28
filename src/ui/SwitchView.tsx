import React, { useEffect, useState } from 'react';
import { Box, Newline, Text, useInput, useStdin } from 'ink';
import type { Profile } from '../types.js';
import { loadProfiles } from '../lib/profiles.js';

export function SwitchView({
	onSelect,
	onCancel,
}: {
	onSelect: (profile: Profile) => void;
	onCancel: () => void;
}) {
	const [selected, setSelected] = useState(0);
	const profiles = loadProfiles();
	const { stdin } = useStdin();

	useEffect(() => {
		if (!stdin) return;
		const handleData = (data: Buffer) => {
			const text = data.toString();
			if (text === '\x1b') {
				onCancel();
			}
		};
		stdin.on('data', handleData);
		return () => {
			stdin.off('data', handleData);
		};
	}, [stdin, onCancel]);

	useInput((input, key) => {
		if (key.escape || input === '\x1b') {
			onCancel();
			return;
		}
		if (input === 'q') {
			onCancel();
			return;
		}
		if (input === 'j' || key.downArrow) {
			setSelected((selected + 1) % profiles.length);
		} else if (input === 'k' || key.upArrow) {
			setSelected((selected - 1 + profiles.length) % profiles.length);
		} else if ((key.return || input === '\r' || input === '\n') && profiles.length > 0) {
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
						<Box key={profile.name} marginBottom={1}>
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
