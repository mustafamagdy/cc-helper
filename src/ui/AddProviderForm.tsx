import React, { useState } from 'react';
import { Box, Newline, Text, useInput } from 'ink';
import type { CustomProviderData } from '../types.js';
import { slugify } from '../lib/profiles.js';

export function AddProviderForm({
	onComplete,
	onCancel,
}: {
	onComplete: (data: CustomProviderData | null) => void;
	onCancel: () => void;
}) {
	const [activeIndex, setActiveIndex] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const [values, setValues] = useState({
		providerName: '',
		profileName: '',
		baseUrl: '',
		model: '',
		token: '',
		authUrl: '',
		authInstructions: '',
	});

	const fields = [
		{ key: 'providerName', label: 'Provider name' },
		{ key: 'profileName', label: 'Profile name' },
		{ key: 'baseUrl', label: 'Base URL' },
		{ key: 'model', label: 'Model' },
		{ key: 'token', label: 'API Token' },
		{ key: 'authUrl', label: 'Auth URL (optional)' },
		{ key: 'authInstructions', label: 'Auth instructions (optional)' },
	] as const;

	useInput((input, key) => {
		if (key.escape) {
			onCancel();
			return;
		}
		if (key.return || input === '\r' || input === '\n') {
			const providerName = values.providerName.trim();
			const baseUrl = values.baseUrl.trim();
			const token = values.token.trim();
			if (!providerName || !baseUrl || !token) {
				setError('Provider name, Base URL, and Token are required');
				return;
			}
			const profileName = values.profileName.trim() || providerName;
			onComplete({
				profileName,
				providerId: slugify(providerName),
				providerName,
				baseUrl,
				defaultModel: values.model.trim() || 'model',
				authUrl: values.authUrl.trim() || undefined,
				authInstructions: values.authInstructions.trim() || undefined,
				token,
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
			<Text bold color="cyan">Add Provider</Text>
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
			{error && (
				<>
					<Newline />
					<Text color="yellow">{error}</Text>
				</>
			)}
		</Box>
	);
}
