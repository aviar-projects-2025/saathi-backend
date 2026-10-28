
import crypto from "node:crypto";
import RegistrationSession from "../src/model/registrationSession.js";

export const hashRegistrationCredential = (credential) =>
  crypto.createHash("sha256").update(credential).digest("hex");

export async function createRegistrationSession({
  mobile,
  referredBy,
}) {
  const credential = crypto.randomBytes(32).toString("base64url");

  const session = await RegistrationSession.create({
    credentialHash: hashRegistrationCredential(credential),
    mobile,
    referredBy,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  });

  return { credential, session };
}

export async function getRegistrationSession(credential) {
  if (
    typeof credential !== "string" ||
    credential.length < 32 ||
    credential.length > 200
  ) {
    return null;
  }

  return RegistrationSession.findOne({
    credentialHash: hashRegistrationCredential(credential),
    expiresAt: { $gt: new Date() },
    completedAt: null,
  });
}
