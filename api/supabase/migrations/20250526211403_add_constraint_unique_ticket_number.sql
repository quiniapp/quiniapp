ALTER TABLE tickets
ADD CONSTRAINT unique_ticket_number UNIQUE (ticket_number);
