-- Migration: Add client_request_id idempotency key to tickets
-- Prevents duplicate ticket creation when cashiers retry on network failure.

-- 1) Add nullable column (backwards compatible — existing rows stay NULL)
ALTER TABLE public.tickets
ADD COLUMN IF NOT EXISTS client_request_id UUID NULL;

-- 2) Partial unique index — only indexes non-NULL values.
--    Existing tickets (NULL) and the edit flow are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS tickets_client_request_id_idx
ON public.tickets (client_request_id)
WHERE client_request_id IS NOT NULL;
