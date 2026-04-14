# Changelog

All notable changes to the Helper workspace are documented in this file.

## [Unreleased]

### Added - 2026-04-14

#### Ticket Types
- **`client_request_id`**: Added optional field to `ITicketEntityBase` (`string | null`), `INewTicketEntity` (`string`), and `newTicketSchema` (optional UUID) for idempotency key support
