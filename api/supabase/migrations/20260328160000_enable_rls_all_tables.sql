-- Enable RLS on all public tables.
-- The backend uses service_role key which bypasses RLS — no behavior change for the API.
-- This blocks direct PostgREST access via anon/authenticated keys if the key is ever leaked.

ALTER TABLE public.bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bets_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.current_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lotteries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_lotteries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_prizes_by_turn ENABLE ROW LEVEL SECURITY;
