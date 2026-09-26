-- BlazeResolver Database Schema
-- Minimal operational store: agent_logs + tickets only (CRM / orders live in client adapters)

create extension if not exists pgcrypto;

-- ============================================================
-- Tickets: Escalation & Incident Queue
-- Includes proposed action attachment for 1-click HITL approval
-- ============================================================
create table if not exists tickets (
  id uuid primary key default gen_random_uuid(),
  customer_id text,
  conversation_id text,
  order_id text,
  resource_id text, -- Generic operational scope (e.g. branch, warehouse, node)
  category text not null,
  urgency text not null check (urgency in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'rejected')),
  handoff_summary text not null,
  proposed_action jsonb default null, -- Attached proposal for human reviewer (amount, type, reason)
  reviewed_by text default null,
  reviewed_at timestamptz default null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- Agent Logs: Structured Observability per agent stage call
-- ============================================================
create table if not exists agent_logs (
  id uuid primary key default gen_random_uuid(),
  conversation_id text,
  agent_name text not null, -- 'triage' | 'resolve' | 'escalation' | 'quality_review'
  input_summary text,
  output_summary text,
  tool_calls jsonb default '[]',
  guardrail_flags jsonb default '[]',
  latency_ms integer,
  created_at timestamptz not null default now()
);

-- Optimized Indexes
create index if not exists tickets_status_idx on tickets(status);
create index if not exists tickets_customer_idx on tickets(customer_id);
create index if not exists tickets_resource_idx on tickets(resource_id);
create index if not exists agent_logs_conversation_idx on agent_logs(conversation_id);
create index if not exists agent_logs_agent_idx on agent_logs(agent_name);
