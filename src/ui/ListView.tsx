import React from 'react';
import { Box, Newline, Text } from 'ink';
import { loadProfiles } from '../lib/profiles.js';

export function ListView() {
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
							<Box key={profile.name} marginBottom={1} flexDirection="column">
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
