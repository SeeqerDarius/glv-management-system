CREATE TABLE "UserAppearancePreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'light',
    "primaryColor" TEXT NOT NULL DEFAULT '#84cc16',
    "secondaryColor" TEXT NOT NULL DEFAULT '#111827',
    "dashboardCards" TEXT NOT NULL DEFAULT 'standard',
    "loadingAnimation" TEXT NOT NULL DEFAULT 'glv',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAppearancePreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserAppearancePreference_userId_key" ON "UserAppearancePreference"("userId");

ALTER TABLE "UserAppearancePreference"
ADD CONSTRAINT "UserAppearancePreference_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
