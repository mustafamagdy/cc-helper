import { spawn } from 'child_process';
import type { Profile } from '../types.js';

export function runProfileInCurrentTerminal(profile: Profile): void {
	// Restore terminal to normal (cooked) mode before spawning child
	// This is critical: we need to release stdin so the child has exclusive access
	if (process.stdin.isTTY) {
		try {
			process.stdin.setRawMode(false);
		} catch {}
		process.stdin.pause();
	}

	const claudePath = process.env['CLAUDE_PATH'] || 'claude';
	const env = { ...process.env, ...profile.env };

	const child = spawn(claudePath, {
		stdio: 'inherit',
		env,
		shell: process.env.SHELL || '/bin/zsh',
	});

	child.on('exit', (code) => {
		process.exit(code ?? 0);
	});
}

export function restoreInkInput(): void {
	if (process.stdin.isTTY) {
		try {
			process.stdin.setRawMode(true);
		} catch {}
		process.stdin.resume();
	}
}
