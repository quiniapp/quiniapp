-- Scope ticket_number uniqueness to organization_id.
-- Previously global, causing false collisions between organizations
-- and between cashiers of the same org creating tickets in the same millisecond.
-- ticket_number now includes cashier number suffix with dash (e.g. YYYYMMDDHHmmssSSS-42),
-- so the numeric-only constraint is relaxed to allow digits and a single optional dash suffix.
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS unique_ticket_number;
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS ticket_number_numeric_only;

ALTER TABLE tickets
ADD CONSTRAINT unique_ticket_number UNIQUE (ticket_number, organization_id);

ALTER TABLE tickets
ADD CONSTRAINT ticket_number_format CHECK (ticket_number ~ '^\d+(-\d+)?$');
