UPDATE "Setting"
SET "smsMissedWeekTemplate" = 'Rock Frost Group: Hello {{customerName}}, you have not made payment for your {{productName}} for at least 7 days. Balance: {{balance}}. Please contact {{staffName}} to arrange payment. If you have paid, contact GLV to reconcile your record.'
WHERE "smsMissedWeekTemplate" IS NULL
   OR "smsMissedWeekTemplate" = 'Rock Frost Group: Hello {{customerName}}, we have not recorded a payment on your plan for at least 7 days. Balance: {{balance}}. Please contact your collector to arrange payment. If you have paid, contact GLV to reconcile your record.';
