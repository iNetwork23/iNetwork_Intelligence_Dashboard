import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const lockName = "admin-access-mutation";
const confirmation = `UNLOCK ${lockName}`;

if (process.env.CONFIRM_ADMIN_ACCESS_UNLOCK !== confirmation) {
  console.error(`Abbruch: CONFIRM_ADMIN_ACCESS_UNLOCK muss exakt "${confirmation}" sein.`);
  process.exit(2);
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Abbruch: SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlt.");
  process.exit(2);
}

const storeKey = `rbac:lock:${createHash("sha256").update(lockName).digest("hex")}`;
const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: lock, error: readError } = await supabase
  .from("sync_state")
  .select("value")
  .eq("key", storeKey)
  .maybeSingle();
if (readError) throw readError;
if (!lock) {
  console.log("Kein Admin-Zugriffs-Lock vorhanden; nichts zu tun.");
  process.exit(0);
}

const owner = lock.value?.owner;
if (typeof owner !== "string" || !owner) {
  console.error("Abbruch: Lock-Datensatz hat keinen gültigen Owner.");
  process.exit(1);
}
const { data: removed, error: deleteError } = await supabase
  .from("sync_state")
  .delete()
  .eq("key", storeKey)
  .eq("value->>owner", owner)
  .select("key")
  .maybeSingle();
if (deleteError) throw deleteError;
if (!removed) {
  console.error("Abbruch: Der Lock wurde zwischen Lesen und Löschen geändert.");
  process.exit(1);
}
console.log("Admin-Zugriffs-Lock owner-bedingt entfernt. Ursache und Zeitpunkt im Incident-Protokoll dokumentieren.");
