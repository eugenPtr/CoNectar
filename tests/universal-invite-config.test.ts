import { afterEach, describe, expect, it } from "vitest";
import { isUniversalInviteCode, universalInviteConfig } from "@/lib/invites/universal";

const originalCode = process.env.UNIVERSAL_INVITE_CODE;
const originalEnabled = process.env.UNIVERSAL_INVITE_CODE_ENABLED;

afterEach(() => {
  if (originalCode === undefined) delete process.env.UNIVERSAL_INVITE_CODE;
  else process.env.UNIVERSAL_INVITE_CODE = originalCode;
  if (originalEnabled === undefined) delete process.env.UNIVERSAL_INVITE_CODE_ENABLED;
  else process.env.UNIVERSAL_INVITE_CODE_ENABLED = originalEnabled;
});

describe("universal invite configuration", () => {
  it("enables only the exact string true with a nonempty matching code", () => {
    process.env.UNIVERSAL_INVITE_CODE = "UNIV-EXAMPLE";
    for (const value of ["TRUE", "1", "false", ""]) {
      process.env.UNIVERSAL_INVITE_CODE_ENABLED = value;
      expect(isUniversalInviteCode("UNIV-EXAMPLE", universalInviteConfig())).toBe(false);
    }
    process.env.UNIVERSAL_INVITE_CODE_ENABLED = "true";
    expect(isUniversalInviteCode("UNIV-EXAMPLE", universalInviteConfig())).toBe(true);
    expect(isUniversalInviteCode("univ-example", universalInviteConfig())).toBe(false);
    process.env.UNIVERSAL_INVITE_CODE = "";
    expect(isUniversalInviteCode("", universalInviteConfig())).toBe(false);
  });
});
