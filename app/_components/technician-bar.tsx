import { getTechnician } from "@/lib/server/session";
import { TechnicianSelect } from "./technician-select";

// Reads the cookie, so render it inside a <Suspense> boundary.
export async function TechnicianBar() {
  const current = await getTechnician();
  return <TechnicianSelect current={current} />;
}
