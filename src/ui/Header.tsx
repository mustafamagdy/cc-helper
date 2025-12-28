import React from 'react';
import { Box, Newline, Text } from 'ink';

const HEADER_LINES = [
	'   ██████╗ ██████╗     ██╗  ██╗███████╗██╗     ██████╗ ███████╗██████╗ ',
	'  ██╔════╝██╔════╝     ██║  ██║██╔════╝██║     ██╔══██╗██╔════╝██╔══██╗',
	'  ██║     ██║          ███████║█████╗  ██║     ██████╔╝█████╗  ██████╔╝',
	'  ██║     ██║          ██╔══██║██╔══╝  ██║     ██╔═══╝ ██╔══╝  ██╔══██╗',
	'  ╚██████╗╚██████╗     ██║  ██║███████╗███████╗██║     ███████╗██║  ██║',
	'   ╚═════╝ ╚═════╝     ╚═╝  ╚═╝╚══════╝╚══════╝╚═╝     ╚══════╝╚═╝  ╚═╝',
];

const NAV_DIVIDER = '────────────────────────────────────────────────────────';

export function Header({ title }: { title: string }) {
	return (
		<Box paddingLeft={2} paddingTop={1} flexDirection="column">
			{HEADER_LINES.map((line) => (
				<Text key={line} color="cyan">{line}</Text>
			))}
			<Newline />
			<Text bold>{`    ${title}`}</Text>
			<Newline />
		</Box>
	);
}

export function NavLine() {
	return (
		<Box paddingLeft={2} paddingBottom={1} flexDirection="column">
			<Text>
				<Text color="cyan">↑↓ j/k</Text>
				<Text color="gray"> Navigate</Text>
				{'  '}
				<Text color="green">Enter</Text>
				<Text color="gray"> Select</Text>
				{'  '}
				<Text color="yellow">Esc/q</Text>
				<Text color="gray"> Back</Text>
			</Text>
			<Text color="gray">{NAV_DIVIDER}</Text>
		</Box>
	);
}
