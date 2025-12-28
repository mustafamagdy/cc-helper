export interface Profile {
	name: string;
	provider: string;
	env: { [key: string]: string };
	fileKey?: string;
}

export type View = 'main' | 'switch' | 'configure' | 'list';

export interface OnboardingData {
	profileName: string;
	token: string;
	baseUrl: string;
	model: string;
}

export interface CustomProviderData {
	profileName: string;
	providerId: string;
	providerName: string;
	baseUrl: string;
	defaultModel: string;
	authUrl?: string;
	authInstructions?: string;
	token: string;
}
