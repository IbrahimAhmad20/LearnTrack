/**
 * Creates Supabase Auth users (auth.users) matching public.users seed UUIDs.
 *
 * Why: Login uses supabase.auth.signInWithPassword(), which checks auth.users —
 *      NOT the password column on public.users. Running seed.sql alone only
 *      fills public.users, so seed emails cannot log in until this runs.
 *
 * Usage (from backend folder, with .env loaded):
 *   node scripts/seed-auth-users.js
 *
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Run AFTER: ddl.sql + seed.sql
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { createClient } = require("@supabase/supabase-js");

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Same password for all seed accounts (matches seed.sql comment). */
const SEED_PASSWORD = "TestPass123!";

const SEED_USERS = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    email: "admin@learntrack.dev",
    full_name: "Admin User",
    role: "admin",
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    email: "instructor@learntrack.dev",
    full_name: "Jane Instructor",
    role: "instructor",
  },
  {
    id: "00000000-0000-0000-0000-000000000009",
    email: "instructor2@learntrack.dev",
    full_name: "Omar Instructor",
    role: "instructor",
  },
  {
    id: "00000000-0000-0000-0000-000000000003",
    email: "student@learntrack.dev",
    full_name: "John Student",
    role: "student",
  },
  {
    id: "00000000-0000-0000-0000-000000000004",
    email: "aisha@learntrack.dev",
    full_name: "Aisha Iqbal",
    role: "student",
  },
  {
    id: "00000000-0000-0000-0000-000000000005",
    email: "hassan@learntrack.dev",
    full_name: "Hassan Khan",
    role: "student",
  },
  {
    id: "00000000-0000-0000-0000-000000000006",
    email: "zara@learntrack.dev",
    full_name: "Zara Ahmad",
    role: "student",
  },
  {
    id: "00000000-0000-0000-0000-000000000007",
    email: "nadia@learntrack.dev",
    full_name: "Nadia Raza",
    role: "student",
  },
  {
    id: "00000000-0000-0000-0000-000000000008",
    email: "omar@learntrack.dev",
    full_name: "Omar Malik",
    role: "student",
  },
  {
    id: "00000000-0000-0000-0000-000000000011",
    email: "sara@learntrack.dev",
    full_name: "Sara Ali",
    role: "student",
  },
  {
    id: "00000000-0000-0000-0000-000000000012",
    email: "bilal@learntrack.dev",
    full_name: "Bilal Akram",
    role: "student",
  },
];

async function main() {
  console.log("Provisioning auth.users for seed accounts (matching public.users user_id)…\n");

  for (const u of SEED_USERS) {
    const { error } = await supabase.auth.admin.createUser({
      id: u.id,
      email: u.email,
      password: SEED_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: u.full_name, role: u.role },
    });

    if (!error) {
      console.log(`  OK  ${u.email}`);
      continue;
    }

    const msg = (error.message || "").toLowerCase();
    if (
      msg.includes("already") ||
      msg.includes("duplicate") ||
      error.status === 422
    ) {
      console.log(`  SKIP ${u.email} — already exists in Auth (${error.message})`);
    } else {
      console.error(`  FAIL ${u.email}`, error.message);
    }
  }

  console.log(
    `\nDone. Log in with any seed email above and password: ${SEED_PASSWORD}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
