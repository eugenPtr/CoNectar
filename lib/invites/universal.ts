export interface UniversalInviteConfig {
  code: string;
  enabled: boolean;
}

export function universalInviteConfig(): UniversalInviteConfig {
  return {
    code: process.env.UNIVERSAL_INVITE_CODE?.trim() ?? "",
    enabled: process.env.UNIVERSAL_INVITE_CODE_ENABLED === "true",
  };
}

export function isUniversalInviteCode(code: string, config: UniversalInviteConfig): boolean {
  return config.enabled && config.code !== "" && code === config.code;
}
