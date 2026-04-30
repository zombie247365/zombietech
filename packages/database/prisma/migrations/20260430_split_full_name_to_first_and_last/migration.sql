-- Step 1: Add new columns as NULLABLE (so they can be added to populated tables)
ALTER TABLE "users" ADD COLUMN "first_name" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN "last_name" VARCHAR(255);
ALTER TABLE "pending_verifications" ADD COLUMN "first_name" VARCHAR(255);
ALTER TABLE "pending_verifications" ADD COLUMN "last_name" VARCHAR(255);

-- Step 2: Backfill existing user rows with explicit values per row
UPDATE "users" SET first_name = 'Zombie',    last_name = 'Admin'        WHERE full_name = 'ZombieTech Admin';
UPDATE "users" SET first_name = 'Thabo',    last_name = 'Mokoena'        WHERE full_name = 'Thabo Mokoena';
UPDATE "users" SET first_name = 'Priya',    last_name = 'Naidoo'         WHERE full_name = 'Priya Naidoo';
UPDATE "users" SET first_name = 'Kefilwe',  last_name = 'Sithole'        WHERE full_name = 'Kefilwe Sithole';
UPDATE "users" SET first_name = 'Marco',    last_name = 'van der Berg'   WHERE full_name = 'Marco van der Berg';
UPDATE "users" SET first_name = 'Ayesha',   last_name = 'Cassim'         WHERE full_name = 'Ayesha Cassim';
UPDATE "users" SET first_name = 'Karthie',  last_name = 'Padayachy'      WHERE full_name = 'Karthie Padayachy';

-- Step 3: Verify the backfill worked — fail the migration if any row is still NULL
DO $$
DECLARE
    null_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO null_count FROM "users" WHERE first_name IS NULL OR last_name IS NULL;
    IF null_count > 0 THEN
        RAISE EXCEPTION 'Backfill incomplete: % users have NULL first_name or last_name', null_count;
    END IF;
END $$;

-- Step 4: Lock the new columns to NOT NULL
ALTER TABLE "users" ALTER COLUMN "first_name" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "last_name" SET NOT NULL;

-- Step 5: Drop the old full_name column from users
ALTER TABLE "users" DROP COLUMN "full_name";

-- Step 6: Drop full_name from pending_verifications (table is empty so safe)
ALTER TABLE "pending_verifications" DROP COLUMN "full_name";

-- Step 7: Lock pending_verifications new columns to NOT NULL
ALTER TABLE "pending_verifications" ALTER COLUMN "first_name" SET NOT NULL;
ALTER TABLE "pending_verifications" ALTER COLUMN "last_name" SET NOT NULL;
