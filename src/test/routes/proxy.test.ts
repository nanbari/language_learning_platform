import { describe, it, expect } from "vitest";
import { request, makeUser } from "@/test/http";
import { proxy, config } from "@/proxy";

const student = makeUser(1, "student");
const teacher = makeUser(2, "teacher");
const admin = makeUser(3, "teacher", true);

/** Où le filtre envoie une requête : null = la page est servie. */
async function where(path: string, as: ReturnType<typeof makeUser> | null) {
  const res = await proxy(await request("GET", path, { as }));
  const location = res.headers.get("location");
  return location ? new URL(location).pathname + new URL(location).search : null;
}

describe("proxy — pages privées (AUTH-01)", () => {
  it("couvre /arabic comme /student et /teacher", () => {
    expect(config.matcher).toEqual(["/teacher/:path*", "/student/:path*", "/arabic/:path*"]);
  });

  it("anonyme : renvoyé vers la connexion, avec retour sur la page demandée", async () => {
    expect(await where("/arabic/vocabulary", null)).toBe("/login?next=%2Farabic%2Fvocabulary");
    expect(await where("/student", null)).toBe("/login?next=%2Fstudent");
    expect(await where("/teacher/create", null)).toBe("/login?next=%2Fteacher%2Fcreate");
  });

  it("élève : ses pages et l'arabe ; pas l'espace enseignant", async () => {
    expect(await where("/arabic", student)).toBeNull();
    expect(await where("/student/live", student)).toBeNull();
    expect(await where("/teacher", student)).toBe("/student");
  });

  it("enseignant : son espace ; l'espace élève et l'arabe le renvoient chez lui ; les sons des lettres restent aux admins", async () => {
    expect(await where("/teacher/present", teacher)).toBeNull();
    expect(await where("/arabic/reading", teacher)).toBe("/teacher");
    expect(await where("/teacher/letters", teacher)).toBe("/teacher");
    expect(await where("/arabic/reading", admin)).toBeNull();
    expect(await where("/teacher/letters", admin)).toBeNull();
  });
});
