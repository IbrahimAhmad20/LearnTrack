# Login, passwords, and seed accounts

This short guide answers common questions when using **Supabase** with LearnTrack.

## Why `public.users.password` looks empty but login still works

The Express login handler (`POST /api/v1/auth/login`) does **not** compare the password to the `password` column in `public.users`.

It calls **Supabase Auth**:

```text
supabase.auth.signInWithPassword({ email, password })
```

That checks the credential stored in **`auth.users`** (Supabase’s auth schema), not your public profile table.

So:

- Accounts you created through **Register** in the app exist in **both** places: `auth.users` (real login secret) and `public.users` (profile + `role`).
- The **Table Editor** might show `public.users.password` as blank, masked, or empty if the row was created from an Auth trigger with an empty password field. **Login still works** because Auth has the password.

**Summary:** Treat **`public.users.password`** as optional / legacy for this project; **the password that matters for “Sign in” is in Supabase Auth.**

---

## Why seed accounts (`admin@learntrack.dev`, etc.) could not log in

`seed.sql` only runs **`INSERT INTO public.users ...`**. It does **not** create rows in **`auth.users`**.

Because login uses **`signInWithPassword`**, those seed emails had **no Auth user** → **Invalid credentials** until Auth is provisioned.

### Fix (after `ddl.sql` + `seed.sql`)

From the **`backend`** folder, with `.env` containing `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`:

```bash
npm run seed:auth
```

That script calls the Admin API to create Auth users with the **same UUIDs** as in `seed.sql`, so they match `public.users.user_id`.

**Password for all seed accounts:** `TestPass123!`

| Email | Role |
|-------|------|
| `admin@learntrack.dev` | admin |
| `instructor@learntrack.dev` | instructor |
| `student@learntrack.dev` | student |
| `aisha@learntrack.dev` … `omar@learntrack.dev` | extra students for analytics |

If a seed email **already exists** in Auth with a **different** user id, the script may skip or error. In that case, delete that user under **Authentication → Users** in the Supabase dashboard, then run `npm run seed:auth` again (or use a fresh project).

---

## Checking UUIDs in `public.users`

Each row must have a **different** `user_id` (primary key). Seed uses:

- `…000000000001` (admin)  
- `…000000000002` (instructor)  
- `…000000000003` (student)  
- … through `…000000000008`

If the dashboard appears to show the same UUID for every row, widen the column or open the row detail — it is often a **display/truncation** issue. The last digit group should change (`…001`, `…002`, etc.).

---

## Optional: keep `public.users.password` in sync

Registration **does** write a bcrypt hash into `public.users` for consistency. Seed rows already include a bcrypt hash for `TestPass123!`. None of that is required for login as long as Auth is correct.

---

---

## Admin dashboard showed “1” total user (or wrong totals)

The hosted Supabase project has an **API setting “Max rows”** (Settings → API). If that value is very low (for example **1**), list endpoints such as `GET /users` only return **one row per request**, so counting `response.data.length` in the UI was wrong.

**What we changed:** The admin overview now uses **`GET /analytics/dashboard/admin`**, which loads totals with **`count: 'exact', head: true`** (not a limited row list). The users list API also **pages** through results with `.range()` until all rows are loaded.

You can still raise **Max rows** in the Supabase dashboard (e.g. **1000**) so other tools behave normally.

---

*See also: `DATABASE_GUIDE.md` and `backend/src/db/seed.sql` header comments.*
