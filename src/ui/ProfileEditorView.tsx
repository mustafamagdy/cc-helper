import React, { useState } from 'react';
import { Box, Newline, Text, useInput } from 'ink';
import type { OnboardingData, Profile } from '../types.js';

export function ProfileEditorView({
	profile,
	onComplete,
	onCancel,
}: {
	profile: Profile;
	onComplete: (data: OnboardingData | null) => void;
	onCancel: () => void;
}) {
	const providerName = profile.env['PROVIDER_NAME'] || profile.provider;
	const existingName = profile.name || providerName;
	const existingToken = profile.env['ANTHROPIC_AUTH_TOKEN'] || '';
	const existingBaseUrl = profile.env['ANTHROPIC_BASE_URL'] || '';
	const existingModel = profile.env['ANTHROPIC_MODEL'] || 'model';

	const [activeIndex, setActiveIndex] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const [values, setValues] = useState({
		profileName: existingName,
		baseUrl: existingBaseUrl,
		model: existingModel,
		token: existingToken,
	});

	const fields = [
		{ key: 'profileName', label: 'Profile name' },
		{ key: 'baseUrl', label: 'Base URL' },
		{ key: 'model', label: 'Model' },
		{ key: 'token', label: 'API Token' },
	] as const;

	useInput((input, key) => {
		if (key.escape) {
			onCancel();
			return;
		}
		if (key.return || input === '\r' || input === '\n') {
			if (!values.token.trim()) {
				setError('Token is required');
				return;
			}
			onComplete({
				profileName: values.profileName.trim() || existingName,
				baseUrl: values.baseUrl.trim() || existingBaseUrl,
				model: values.model.trim() || existingModel,
				token: values.token.trim(),
			});
			return;
		}
		if (key.tab || key.downArrow) {
			setActiveIndex((activeIndex + 1) % fields.length);
			return;
		}
		if (key.upArrow) {
			setActiveIndex((activeIndex - 1 + fields.length) % fields.length);
			return;
		}
		if (key.backspace || key.delete) {
			const fieldKey = fields[activeIndex].key;
			setValues((prev) => ({
				...prev,
				[fieldKey]: prev[fieldKey].slice(0, -1),
			}));
			return;
		}
		if (input && input.length === 1 && !key.ctrl && !key.meta) {
			const fieldKey = fields[activeIndex].key;
			setValues((prev) => ({
				...prev,
				[fieldKey]: prev[fieldKey] + input,
			}));
			if (error) setError(null);
		}
	});

	const labelWidth = Math.max(...fields.map((f) => f.label.length)) + 1;

	return (
		<Box flexDirection="column" paddingLeft={2} paddingRight={2}>
			<Text bold color="cyan">Profile Editor</Text>
			<Newline />
			<Text color="gray">Tab/↑↓ move · Type to edit · Enter save · Esc cancel</Text>
			<Newline />
			{fields.map((field, index) => {
				const value = values[field.key];
				const paddedLabel = (field.label + ':').padEnd(labelWidth, ' ');
				const isActive = index === activeIndex;
				return (
					<Text key={field.key}>
						<Text color={isActive ? 'cyan' : 'white'} bold={isActive}>
							{isActive ? '▶ ' : '  '}{paddedLabel} 
						</Text>
						<Text
							color={isActive ? 'black' : 'white'}
							backgroundColor={isActive ? 'cyan' : undefined}
							bold={isActive}
						>
							{value || (isActive ? '' : '-')}
						</Text>
					</Text>
				);
			})}
			<Newline />
			<Text color="gray">Provider: {providerName}</Text>
			{profile.env['PROVIDER_AUTH_URL'] && (
				<Text color="cyan">Token help: {profile.env['PROVIDER_AUTH_URL']}</Text>
			)}
			{error && <Text color="yellow">{error}</Text>}
		</Box>
	);
}
