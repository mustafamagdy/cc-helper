import React from 'react';
import { Box, Text, useInput } from 'ink';

export interface MenuItem {
	label: string;
	key: string;
}

export function Menu({
	items,
	selected,
	onSelect,
	isActive,
}: {
	items: MenuItem[];
	selected: number;
	onSelect: (index: number) => void;
	isActive: boolean;
}) {
	useInput((input, key) => {
		if (!isActive) return;
		if (input === 'j' || key.downArrow) {
			onSelect((selected + 1) % items.length);
		} else if (input === 'k' || key.upArrow) {
			onSelect((selected - 1 + items.length) % items.length);
		} else if (key.return || input === ' ' || input === '\r' || input === '\n') {
			// Parent handles selection.
		}
	});

	return (
		<Box width={28} paddingTop={1} paddingLeft={1} flexDirection="column">
			{items.map((item, index) => (
				<Text key={item.key} color={index === selected ? 'cyan' : 'white'} bold={index === selected}>
					{index === selected ? '▶ ' : '  '}{item.label}
				</Text>
			))}
		</Box>
	);
}
