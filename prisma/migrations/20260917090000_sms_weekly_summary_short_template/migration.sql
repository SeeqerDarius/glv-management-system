-- The weekly customer summary now has two wordings: one for customers who met
-- their expected weekly amount, and this one for customers who fell short.
ALTER TABLE "Setting" ADD COLUMN "smsWeeklySummaryShortTemplate" TEXT;
