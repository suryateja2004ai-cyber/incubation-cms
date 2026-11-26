-- ==============================================================================
-- 015_cloud_production_data_constraints.sql
-- Production Relational Integrity Constraints & Referential Safety
--
-- Safety Architecture & PostgreSQL Locking Specifications:
--   1. Accurate Lock Modes (ADD CONSTRAINT ... NOT VALID):
--      - Child Table Lock: SHARE ROW EXCLUSIVE.
--      - Referenced Table Lock: SHARE ROW EXCLUSIVE.
--      - Lock Impact & Blocking Behavior:
--        SHARE ROW EXCLUSIVE conflicts with ROW EXCLUSIVE (INSERT, UPDATE, DELETE),
--        SHARE, SHARE ROW EXCLUSIVE, EXCLUSIVE, and ACCESS EXCLUSIVE.
--        Therefore, concurrent WRITE operations (INSERT, UPDATE, DELETE) on BOTH the child
--        table and the referenced parent table (e.g. public.users, public.components)
--        ARE BLOCKED while this command executes.
--        Only concurrent reads (SELECT) are permitted.
--      - Execution Duration:
--        Because NOT VALID skips the initial historical table scan, the lock is held
--        only for catalog metadata insertion. However, if executed inside a transaction block
--        (BEGIN ... COMMIT) or if an existing transaction holds an uncommitted lock on public.users,
--        the lock will persist until the transaction commits, queuing subsequent client writes.
--        Execution should NOT be promised as instantaneous or zero write impact.
--   2. Non-Blocking Validation Pattern (VALIDATE CONSTRAINT):
--      - Child Table Lock: SHARE UPDATE EXCLUSIVE.
--      - Referenced Table Lock: ROW SHARE.
--      - Lock Impact & Concurrent Operations:
--        SHARE UPDATE EXCLUSIVE permits concurrent SELECT, INSERT, UPDATE, and DELETE.
--        It only conflicts with other DDL (ALTER TABLE), VACUUM FULL, and table rewrites.
--        Validation is deferred until orphaned legacy rows (such as demo leader 238W1A0445)
--        are reconciled by an administrator.
--   3. Safe Cascading Rules:
--      - Updates cascade automatically (ON UPDATE CASCADE) to preserve integrity on roll corrections.
--      - Optional relations set null (ON DELETE SET NULL) for project/team leaders, complaints, and papers.
--      - Critical institutional logs (visits, transactions) restrict deletion (ON DELETE RESTRICT).
--   4. Defensive Unique Indexes:
--      Enforces strict case-insensitive uniqueness on roll numbers without schema locks.
--   5. Non-Destructive Rollback:
--      Dropping a foreign key constraint is 100% non-destructive and drops only the constraint definition,
--      leaving all institutional data rows intact.
-- ==============================================================================

-- 1. Ensure Bare Unique Constraint on users(roll_number) to satisfy PostgreSQL Foreign Key requirements
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_users_roll_number'
  ) THEN
    ALTER TABLE public.users ADD CONSTRAINT uq_users_roll_number UNIQUE (roll_number);
  END IF;
END $$;

-- Maintain Case-Insensitive Index on users(roll_number)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_roll_number_upper
  ON public.users (UPPER(TRIM(roll_number)));

-- 2. Foreign Key: projects.leader_roll -> users.roll_number
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_projects_leader_roll'
  ) THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT fk_projects_leader_roll
      FOREIGN KEY (leader_roll)
      REFERENCES public.users(roll_number)
      ON UPDATE CASCADE
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;

-- 3. Foreign Key: teams.leader_roll -> users.roll_number
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_teams_leader_roll'
  ) THEN
    ALTER TABLE public.teams
      ADD CONSTRAINT fk_teams_leader_roll
      FOREIGN KEY (leader_roll)
      REFERENCES public.users(roll_number)
      ON UPDATE CASCADE
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;

-- 4. Foreign Key: complaints.reported_by_roll -> users.roll_number
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_complaints_reporter_roll'
  ) THEN
    ALTER TABLE public.complaints
      ADD CONSTRAINT fk_complaints_reporter_roll
      FOREIGN KEY (reported_by_roll)
      REFERENCES public.users(roll_number)
      ON UPDATE CASCADE
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;

-- 5. Foreign Key: research_papers.student_roll -> users.roll_number
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_research_papers_student_roll'
  ) THEN
    ALTER TABLE public.research_papers
      ADD CONSTRAINT fk_research_papers_student_roll
      FOREIGN KEY (student_roll)
      REFERENCES public.users(roll_number)
      ON UPDATE CASCADE
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;

-- 6. Foreign Key: authorizations.student_roll -> users.roll_number
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_authorizations_student_roll'
  ) THEN
    ALTER TABLE public.authorizations
      ADD CONSTRAINT fk_authorizations_student_roll
      FOREIGN KEY (student_roll)
      REFERENCES public.users(roll_number)
      ON UPDATE CASCADE
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;

-- 7. Foreign Key: visits.student_roll -> users.roll_number
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_visits_student_roll'
  ) THEN
    ALTER TABLE public.visits
      ADD CONSTRAINT fk_visits_student_roll
      FOREIGN KEY (student_roll)
      REFERENCES public.users(roll_number)
      ON UPDATE CASCADE
      ON DELETE RESTRICT
      NOT VALID;
  END IF;
END $$;

-- 8. Foreign Key: transactions.student_roll -> users.roll_number
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_transactions_student_roll'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT fk_transactions_student_roll
      FOREIGN KEY (student_roll)
      REFERENCES public.users(roll_number)
      ON UPDATE CASCADE
      ON DELETE RESTRICT
      NOT VALID;
  END IF;
END $$;

-- 9. Foreign Key: transactions.component_id -> components.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_transactions_component_id'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT fk_transactions_component_id
      FOREIGN KEY (component_id)
      REFERENCES public.components(id)
      ON UPDATE CASCADE
      ON DELETE RESTRICT
      NOT VALID;
  END IF;
END $$;

-- 10. Check Constraints for Quantities & Values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_components_non_negative_qty'
  ) THEN
    ALTER TABLE public.components
      ADD CONSTRAINT chk_components_non_negative_qty
      CHECK (available_quantity >= 0 AND total_quantity >= 0)
      NOT VALID;
  END IF;
END $$;

-- 11. Performance Optimization Indexes
CREATE INDEX IF NOT EXISTS idx_visits_entry_exit
  ON public.visits (entry_time, exit_time);

CREATE INDEX IF NOT EXISTS idx_transactions_created_status
  ON public.transactions (created_at, status);

CREATE INDEX IF NOT EXISTS idx_components_category_status
  ON public.components (category, status);
