export interface Config {
  token: string;
  updatedAt: string;
}

export interface Profile {
  name: string;
  config: Config;
  isDefault?: boolean;
}

export interface ConfigStore {
  profiles: Record<string, Config>;
  defaultProfile?: string;
}

export interface ConfigOptions {
  configDir?: string;
  profile?: string;
}
