-- Remove duplicate patients — keep the oldest record (smallest createdAt)
DELETE FROM "Patient" p1
USING "Patient" p2
WHERE p1."ownerUserId" = p2."ownerUserId"
  AND p1."firstName"   = p2."firstName"
  AND p1."lastName"    = p2."lastName"
  AND p1."createdAt"   > p2."createdAt";

-- Add unique constraint per therapist: same ownerUserId + firstName + lastName is not allowed
CREATE UNIQUE INDEX IF NOT EXISTS "Patient_ownerUserId_firstName_lastName_key"
  ON "Patient"("ownerUserId", "firstName", "lastName");
