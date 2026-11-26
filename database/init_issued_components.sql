-- Initialize issued_components table for Incubation Centre CMS
CREATE TABLE IF NOT EXISTS public.issued_components (
    id VARCHAR(100) PRIMARY KEY,
    registration_number VARCHAR(50) NOT NULL,
    student_name VARCHAR(150) NOT NULL,
    phone_number VARCHAR(25),
    student_details JSONB DEFAULT '{}'::jsonb,
    components JSONB NOT NULL DEFAULT '[]'::jsonb,
    issue_date TIMESTAMPTZ DEFAULT NOW(),
    overall_due_date TIMESTAMPTZ,
    status VARCHAR(50) DEFAULT 'issued',
    notes TEXT,
    issued_by VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast query lookup by student registration number and status
CREATE INDEX IF NOT EXISTS idx_issued_components_reg ON public.issued_components(registration_number);
CREATE INDEX IF NOT EXISTS idx_issued_components_status ON public.issued_components(status);
CREATE INDEX IF NOT EXISTS idx_issued_components_date ON public.issued_components(issue_date DESC);

-- View for transactions compatibility if needed
CREATE OR REPLACE VIEW public.transactions_view AS
SELECT 
    id,
    registration_number AS student_roll,
    student_name,
    phone_number,
    components AS items,
    issue_date,
    overall_due_date,
    status,
    notes,
    issued_by,
    created_at,
    updated_at
FROM public.issued_components;
