-- The exported finance seed expects this owner account to exist before it
-- inserts the household membership.
INSERT INTO "kakeibo"."user" (
    "id",
    "name",
    "email",
    "emailVerified",
    "createdAt",
    "updatedAt"
)
VALUES (
    'seed-user-zatti',
    'Alexandre Zatti',
    'zatti.alexandre61@gmail.com',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("email") DO UPDATE SET
    "updatedAt" = EXCLUDED."updatedAt";
