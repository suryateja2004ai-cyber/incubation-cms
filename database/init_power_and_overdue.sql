-- Initialize power_consumption and overdue_components tables for Incubation Centre CMS

-- 1. Power Consumption Table
CREATE TABLE IF NOT EXISTS public.power_consumption (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(100) NOT NULL,
    device_name VARCHAR(150) NOT NULL,
    device_type VARCHAR(50),
    location VARCHAR(100) NOT NULL, -- Zone name / location
    actual_state VARCHAR(20) DEFAULT 'off',
    power_rating_watts NUMERIC(10, 2) DEFAULT 0,
    daily_kwh NUMERIC(10, 2) DEFAULT 0,
    weekly_kwh NUMERIC(10, 2) DEFAULT 0,
    monthly_kwh NUMERIC(10, 2) DEFAULT 0,
    yearly_kwh NUMERIC(10, 2) DEFAULT 0,
    estimated_monthly_cost NUMERIC(10, 2) DEFAULT 0,
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_device_record UNIQUE (device_id)
);

CREATE INDEX IF NOT EXISTS idx_power_consumption_device ON public.power_consumption(device_id);
CREATE INDEX IF NOT EXISTS idx_power_consumption_loc ON public.power_consumption(location);
CREATE INDEX IF NOT EXISTS idx_power_consumption_time ON public.power_consumption(recorded_at DESC);

-- 2. Overdue Components Table
CREATE TABLE IF NOT EXISTS public.overdue_components (
    id VARCHAR(150) PRIMARY KEY, -- Unique ID e.g. OVD-{txn_id}-{component_id}
    transaction_id VARCHAR(100) NOT NULL,
    registration_number VARCHAR(50) NOT NULL,
    student_name VARCHAR(150) NOT NULL,
    phone_number VARCHAR(25),
    component_id VARCHAR(100) NOT NULL,
    component_name VARCHAR(150) NOT NULL,
    category VARCHAR(100),
    remaining_quantity INTEGER NOT NULL DEFAULT 1,
    individual_ids JSONB DEFAULT '[]'::jsonb,
    issue_date TIMESTAMPTZ NOT NULL,
    due_date TIMESTAMPTZ NOT NULL, -- End date
    overdue_days INTEGER NOT NULL DEFAULT 0,
    severity VARCHAR(50) DEFAULT 'moderate', -- 'critical' | 'moderate'
    status VARCHAR(50) DEFAULT 'overdue', -- 'overdue', 'resolved', 'returned'
    checked_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_overdue_reg ON public.overdue_components(registration_number);
CREATE INDEX IF NOT EXISTS idx_overdue_status ON public.overdue_components(status);
CREATE INDEX IF NOT EXISTS idx_overdue_days ON public.overdue_components(overdue_days DESC);
