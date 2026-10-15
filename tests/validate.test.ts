import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { validateInvite } from "@/lib/invites/validate";
import { createTestDb, pgliteValidateAdapter, seedUnclaimedInvite } from "./db";

describe("validateInvite (S1 read-only integration seam)", () => {
  let db: PGlite;

  beforeEach(async () => {
    db = await createTestDb();
  });

  afterEach(async () => {
    await db.close();
  });

  it("returns valid for an unclaimed code", async () => {
    await seedUnclaimedInvite(db, { code: "DEV-BBBB-0001", email: "alice@example.com" });

    const result = await validateInvite(pgliteValidateAdapter(db), "DEV-BBBB-0001");

    expect(result).toEqual({ kind: "valid" });
  });

  it("returns invalid for a code that does not exist", async () => {
    const result = await validateInvite(pgliteValidateAdapter(db), "DOES-NOT-EXIST");

    expect(result).toEqual({ kind: "invalid" });
  });

  it("returns already-claimed for a code that has been claimed", async () => {
    const seeded = await seedUnclaimedInvite(db, {
      code: "DEV-BBBB-0002",
      email: "bob@example.com",
    });
    await db.query(
      `insert into members (id, email) values ($1, $2)`,
      [seeded.userId, seeded.email],
    );
    await db.query(
      `update invites set claimed_by = $1, claimed_at = now() where code = $2`,
      [seeded.userId, seeded.code],
    );

    const result = await validateInvite(pgliteValidateAdapter(db), "DEV-BBBB-0002");

    expect(result).toEqual({ kind: "already-claimed" });
  });

  it("accepts a configured universal code without an invite row", async () => {
    const client = pgliteValidateAdapter(db);
    const config = { code: "UNIV-EXAMPLE", enabled: true };
    expect(await validateInvite(client, config.code, config)).toEqual({ kind: "valid" });
    expect(await validateInvite(client, config.code, { ...config, enabled: false }))
      .toEqual({ kind: "invalid" });
  });

  it("rejects a universal code that collides with an ordinary invite", async () => {
    await seedUnclaimedInvite(db, { code: "UNIV-EXAMPLE", email: "collision@example.com" });
    expect(await validateInvite(pgliteValidateAdapter(db), "UNIV-EXAMPLE", {
      code: "UNIV-EXAMPLE", enabled: true,
    })).toEqual({ kind: "configuration-error" });
  });
});
