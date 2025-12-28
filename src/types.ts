export interface Profile {
  name: string;
  provider: string;
  env: {
    [key: string]: string;
  };
}

export interface ProfileStore {
  profilesDir: string;
  listProfiles(): Profile[];
  getProfile(name: string): Profile | null;
  saveProfile(profile: Profile): void;
  deleteProfile(name: string): boolean;
}
