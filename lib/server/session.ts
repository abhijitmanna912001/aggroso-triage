import "server-only";
import { cookies } from "next/headers";
import { TECHNICIAN_COOKIE, isTechnician } from "../technicians";

const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;

// Reads request data, so call it only inside a Server Action or a component behind <Suspense>.
export async function getTechnician(): Promise<string | null> {
  const value = (await cookies()).get(TECHNICIAN_COOKIE)?.value;
  return isTechnician(value) ? value : null;
}

export async function requireTechnician(): Promise<string> {
  const name = await getTechnician();
  if (name === null) {
    const error = new Error("Not signed in");
    error.name = "NotSignedInError";
    throw error;
  }
  return name;
}

export async function setTechnicianCookie(name: string): Promise<void> {
  if (!isTechnician(name)) throw new Error("Unknown technician");
  (await cookies()).set(TECHNICIAN_COOKIE, name, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: THIRTY_DAYS_SECONDS,
  });
}

export async function clearTechnicianCookie(): Promise<void> {
  (await cookies()).delete(TECHNICIAN_COOKIE);
}
