UPDATE "Setting"
SET "smsSalaryTemplate" = 'Rock Frost Group: Hello {{staffName}}, your salary payment of {{amount}} for {{salaryMonth}} was recorded on {{paymentDate}}. Thank you for your work.'
WHERE "smsSalaryTemplate" = 'GLV: Hello {{staffName}}, your salary payment of {{amount}} for {{salaryMonth}} was recorded on {{paymentDate}}. Thank you for your work.';

UPDATE "Setting"
SET "smsWelcomeTemplate" = 'Rock Frost Group: Welcome {{customerName}}! Your {{productName}} plan starts {{startDate}}. Target: {{targetAmount}}. Daily payment: {{dailyAmount}}. Pay Small. Own Big.'
WHERE "smsWelcomeTemplate" = 'GLV: Welcome {{customerName}}! Your {{productName}} plan starts {{startDate}}. Target: {{targetAmount}}. Daily payment: {{dailyAmount}}. Pay Small. Own Big.';

UPDATE "Setting"
SET "smsProgress70Template" = 'Rock Frost Group: Well done {{customerName}}! You have paid at least 70% toward {{productName}}. Paid: {{paidAmount}}. Balance: {{balance}}. Thank you!'
WHERE "smsProgress70Template" = 'GLV: Well done {{customerName}}! You have paid at least 70% toward {{productName}}. Paid: {{paidAmount}}. Balance: {{balance}}. Thank you!';

UPDATE "Setting"
SET "smsMissedWeekTemplate" = 'Rock Frost Group: Hello {{customerName}}, we have not recorded a payment on your plan for at least 7 days. Balance: {{balance}}. Please contact your collector to arrange payment. If you have paid, contact GLV to reconcile your record.'
WHERE "smsMissedWeekTemplate" = 'GLV: Hello {{customerName}}, we have not recorded a payment on your plan for at least 7 days. Balance: {{balance}}. Please contact your collector to arrange payment. If you have paid, contact GLV to reconcile your record.';
