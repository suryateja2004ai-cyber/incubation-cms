--
-- PostgreSQL database dump
--


-- Dumped from database version 18.0
-- Dumped by pg_dump version 18.0

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

DROP TRIGGER IF EXISTS trg_passwords_retention ON public.passwords;
DROP INDEX IF EXISTS public.idx_visitor_attendance_status;
DROP INDEX IF EXISTS public.idx_visitor_attendance_entry_time;
DROP INDEX IF EXISTS public.idx_publications_roll;
DROP INDEX IF EXISTS public.idx_publications_created;
DROP INDEX IF EXISTS public.idx_projects_roll;
DROP INDEX IF EXISTS public.idx_projects_created;
DROP INDEX IF EXISTS public.idx_power_consumption_time;
DROP INDEX IF EXISTS public.idx_power_consumption_loc;
DROP INDEX IF EXISTS public.idx_power_consumption_device;
DROP INDEX IF EXISTS public.idx_passwords_roll;
DROP INDEX IF EXISTS public.idx_overdue_status;
DROP INDEX IF EXISTS public.idx_overdue_reg;
DROP INDEX IF EXISTS public.idx_overdue_days;
DROP INDEX IF EXISTS public.idx_issued_components_status;
DROP INDEX IF EXISTS public.idx_issued_components_reg;
DROP INDEX IF EXISTS public.idx_issued_components_date;
ALTER TABLE IF EXISTS ONLY public.visitor_attendance DROP CONSTRAINT IF EXISTS visitor_attendance_visitor_id_key;
ALTER TABLE IF EXISTS ONLY public.visitor_attendance DROP CONSTRAINT IF EXISTS visitor_attendance_pkey;
ALTER TABLE IF EXISTS ONLY public.power_consumption DROP CONSTRAINT IF EXISTS uq_device_record;
ALTER TABLE IF EXISTS ONLY public.research_publications DROP CONSTRAINT IF EXISTS research_publications_pkey;
ALTER TABLE IF EXISTS ONLY public.projects DROP CONSTRAINT IF EXISTS projects_pkey;
ALTER TABLE IF EXISTS ONLY public.power_consumption DROP CONSTRAINT IF EXISTS power_consumption_pkey;
ALTER TABLE IF EXISTS ONLY public.passwords DROP CONSTRAINT IF EXISTS passwords_roll_number_key;
ALTER TABLE IF EXISTS ONLY public.passwords DROP CONSTRAINT IF EXISTS passwords_pkey;
ALTER TABLE IF EXISTS ONLY public.overdue_components DROP CONSTRAINT IF EXISTS overdue_components_pkey;
ALTER TABLE IF EXISTS ONLY public.issued_components DROP CONSTRAINT IF EXISTS issued_components_pkey;
ALTER TABLE IF EXISTS public.visitor_attendance ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.power_consumption ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.passwords ALTER COLUMN id DROP DEFAULT;
DROP SEQUENCE IF EXISTS public.visitor_attendance_id_seq;
DROP TABLE IF EXISTS public.visitor_attendance;
DROP VIEW IF EXISTS public.transactions_view;
DROP TABLE IF EXISTS public.research_publications;
DROP TABLE IF EXISTS public.projects;
DROP SEQUENCE IF EXISTS public.power_consumption_id_seq;
DROP TABLE IF EXISTS public.power_consumption;
DROP SEQUENCE IF EXISTS public.passwords_id_seq;
DROP TABLE IF EXISTS public.passwords;
DROP TABLE IF EXISTS public.overdue_components;
DROP TABLE IF EXISTS public.issued_components;
DROP FUNCTION IF EXISTS public.fn_calculate_retention();
--
-- Name: fn_calculate_retention(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_calculate_retention() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.role = 'student' OR NEW.role IS NULL THEN
    IF NEW.academic_year_at_start IS NULL OR NEW.academic_year_at_start < 1 THEN
      NEW.academic_year_at_start := 1;
    ELSIF NEW.academic_year_at_start > 4 THEN
      NEW.academic_year_at_start := 4;
    END IF;

    NEW.retention_period_years := 5 - NEW.academic_year_at_start;

    IF NEW.incubation_start_date IS NULL THEN
      NEW.incubation_start_date := CURRENT_DATE;
    END IF;

    NEW.retention_end_date := (NEW.incubation_start_date + (NEW.retention_period_years || ' years')::interval)::date;
  END IF;
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: issued_components; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.issued_components (
    id character varying(100) NOT NULL,
    registration_number character varying(50) NOT NULL,
    student_name character varying(150) NOT NULL,
    phone_number character varying(25),
    student_details jsonb DEFAULT '{}'::jsonb,
    components jsonb DEFAULT '[]'::jsonb NOT NULL,
    issue_date timestamp with time zone DEFAULT now(),
    overall_due_date timestamp with time zone,
    status character varying(50) DEFAULT 'issued'::character varying,
    notes text,
    issued_by character varying(100),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: overdue_components; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.overdue_components (
    id character varying(150) NOT NULL,
    transaction_id character varying(100) NOT NULL,
    registration_number character varying(50) NOT NULL,
    student_name character varying(150) NOT NULL,
    phone_number character varying(25),
    component_id character varying(100) NOT NULL,
    component_name character varying(150) NOT NULL,
    category character varying(100),
    remaining_quantity integer DEFAULT 1 NOT NULL,
    individual_ids jsonb DEFAULT '[]'::jsonb,
    issue_date timestamp with time zone NOT NULL,
    due_date timestamp with time zone NOT NULL,
    overdue_days integer DEFAULT 0 NOT NULL,
    severity character varying(50) DEFAULT 'moderate'::character varying,
    status character varying(50) DEFAULT 'overdue'::character varying,
    checked_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: passwords; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.passwords (
    id integer NOT NULL,
    roll_number character varying(50) NOT NULL,
    password character varying(255) NOT NULL,
    student_name character varying(150) NOT NULL,
    role character varying(50) DEFAULT 'student'::character varying,
    department character varying(100),
    phone_number character varying(25),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    email character varying(150),
    academic_year_at_start integer DEFAULT 1,
    incubation_start_date date DEFAULT CURRENT_DATE,
    retention_period_years integer DEFAULT 4,
    retention_end_date date
);


--
-- Name: passwords_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.passwords_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: passwords_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.passwords_id_seq OWNED BY public.passwords.id;


--
-- Name: power_consumption; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.power_consumption (
    id integer NOT NULL,
    device_id character varying(100) NOT NULL,
    device_name character varying(150) NOT NULL,
    device_type character varying(50),
    location character varying(100) NOT NULL,
    actual_state character varying(20) DEFAULT 'off'::character varying,
    power_rating_watts numeric(10,2) DEFAULT 0,
    daily_kwh numeric(10,2) DEFAULT 0,
    weekly_kwh numeric(10,2) DEFAULT 0,
    monthly_kwh numeric(10,2) DEFAULT 0,
    yearly_kwh numeric(10,2) DEFAULT 0,
    estimated_monthly_cost numeric(10,2) DEFAULT 0,
    recorded_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: power_consumption_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.power_consumption_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: power_consumption_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.power_consumption_id_seq OWNED BY public.power_consumption.id;


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id character varying(100) NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    domain character varying(100) DEFAULT 'IoT & Embedded'::character varying,
    status character varying(50) DEFAULT 'showcase'::character varying,
    student_roll character varying(50) NOT NULL,
    student_name character varying(150) NOT NULL,
    team_members jsonb DEFAULT '[]'::jsonb,
    tags jsonb DEFAULT '[]'::jsonb,
    github_url text,
    demo_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: research_publications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.research_publications (
    id character varying(100) NOT NULL,
    title character varying(255) NOT NULL,
    abstract text,
    paper_type character varying(100) DEFAULT 'Conference Paper'::character varying,
    domain character varying(100) DEFAULT 'Computer Science'::character varying,
    journal_conference_name character varying(255),
    student_roll character varying(50) NOT NULL,
    student_name character varying(150) NOT NULL,
    authors jsonb DEFAULT '[]'::jsonb,
    doi character varying(150),
    external_url text,
    publication_date date DEFAULT CURRENT_DATE,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: transactions_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.transactions_view AS
 SELECT id,
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


--
-- Name: visitor_attendance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.visitor_attendance (
    id integer NOT NULL,
    visitor_id character varying(50) NOT NULL,
    full_name character varying(150) NOT NULL,
    visitor_type character varying(80) NOT NULL,
    organization_or_dept character varying(150) NOT NULL,
    phone_number character varying(30),
    email character varying(150),
    purpose_of_visit text NOT NULL,
    host_or_accompanied_by character varying(150),
    entry_time timestamp with time zone DEFAULT now() NOT NULL,
    exit_time timestamp with time zone,
    duration_minutes integer,
    status character varying(20) DEFAULT 'inside'::character varying NOT NULL,
    remarks text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: visitor_attendance_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.visitor_attendance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: visitor_attendance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.visitor_attendance_id_seq OWNED BY public.visitor_attendance.id;


--
-- Name: passwords id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.passwords ALTER COLUMN id SET DEFAULT nextval('public.passwords_id_seq'::regclass);


--
-- Name: power_consumption id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.power_consumption ALTER COLUMN id SET DEFAULT nextval('public.power_consumption_id_seq'::regclass);


--
-- Name: visitor_attendance id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitor_attendance ALTER COLUMN id SET DEFAULT nextval('public.visitor_attendance_id_seq'::regclass);


--
-- Data for Name: issued_components; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.issued_components (id, registration_number, student_name, phone_number, student_details, components, issue_date, overall_due_date, status, notes, issued_by, created_at, updated_at) VALUES ('TXN-20261126-529', '238W1A05F6', 'KonkaBhanuprakash', '88888888888', '{"year": "", "email": "", "section": "", "department": ""}', '[{"status": "issued", "dueDate": "2026-12-03T06:23:55.529Z", "category": "Sensors & Electronic Modules", "componentId": "COMP-001", "trackingMode": "aggregate", "componentName": "PIR Motion Sensor (HC-SR501)", "individualIds": [], "issuedQuantity": 1, "returnedQuantity": 0, "returnedIndividualIds": [], "selectedIndividualIds": []}, {"status": "issued", "dueDate": "2026-12-10T06:23:55.529Z", "category": "Development Boards", "componentId": "COMP-002", "trackingMode": "individual", "componentName": "ESP32 Wi-Fi + Bluetooth Dev Board", "individualIds": ["ESP32-001"], "issuedQuantity": 1, "returnedQuantity": 0, "returnedIndividualIds": [], "selectedIndividualIds": ["ESP32-001"]}]', '2026-11-26 11:53:55.529+05:30', '2026-12-10 11:53:55.529+05:30', 'issued', 'for reading', 'Dr. Surya Prasad', '2026-11-26 11:53:55.672458+05:30', '2026-11-26 11:53:55.672458+05:30');
INSERT INTO public.issued_components (id, registration_number, student_name, phone_number, student_details, components, issue_date, overall_due_date, status, notes, issued_by, created_at, updated_at) VALUES ('TXN-20261126-893', '238W1A0477', 'surya', '+919876501001', '{"year": "", "email": "", "section": "A", "department": "Electronics & Communication Engineering"}', '[{"status": "issued", "dueDate": "2026-12-03T06:25:38.893Z", "category": "Sensors & Electronic Modules", "componentId": "COMP-003", "trackingMode": "aggregate", "componentName": "Ultrasonic Distance Sensor (HC-SR04)", "individualIds": [], "issuedQuantity": 8, "returnedQuantity": 6, "returnedIndividualIds": [], "selectedIndividualIds": []}]', '2026-11-26 11:55:38.893+05:30', '2026-12-03 11:55:38.893+05:30', 'partially_returned', NULL, 'Dr. Surya Prasad', '2026-11-26 11:55:38.993439+05:30', '2026-11-26 11:58:34.223727+05:30');
INSERT INTO public.issued_components (id, registration_number, student_name, phone_number, student_details, components, issue_date, overall_due_date, status, notes, issued_by, created_at, updated_at) VALUES ('TXN-20261126-325', '238W1A0477', 'hemadri', '9999999999', '{"year": "", "email": "", "section": "A", "department": "electronics and communication engineering"}', '[{"status": "issued", "dueDate": "2026-12-03T15:22:53.325Z", "category": "Sensors & Electronic Modules", "componentId": "COMP-001", "trackingMode": "aggregate", "componentName": "PIR Motion Sensor (HC-SR501)", "individualIds": [], "issuedQuantity": 4, "returnedQuantity": 3, "returnedIndividualIds": [], "selectedIndividualIds": []}]', '2026-11-26 20:52:53.325+05:30', '2026-12-03 20:52:53.325+05:30', 'partially_returned', NULL, 'Administrator', '2026-11-26 20:52:53.397867+05:30', '2026-11-26 20:53:18.027754+05:30');


--
-- Data for Name: overdue_components; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: passwords; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.passwords (id, roll_number, password, student_name, role, department, phone_number, created_at, updated_at, email, academic_year_at_start, incubation_start_date, retention_period_years, retention_end_date) VALUES (2, 'subadmin', 'subadmin123', 'Sub-Administrator', 'substitute_admin', 'Lab Operations', '9876543211', '2026-11-26 12:21:22.24965+05:30', '2026-11-26 23:34:29.033844+05:30', 'subadmin@vrsec.ac.in', 1, '2026-11-27', 4, NULL);
INSERT INTO public.passwords (id, roll_number, password, student_name, role, department, phone_number, created_at, updated_at, email, academic_year_at_start, incubation_start_date, retention_period_years, retention_end_date) VALUES (1, 'admin', 'admin123', 'Administrator', 'admin', 'Incubation Management', '9876543210', '2026-11-26 12:21:22.24965+05:30', '2026-11-26 23:56:57.190489+05:30', 'suryateja5570@gmail.com', 1, '2026-11-27', 4, NULL);
INSERT INTO public.passwords (id, roll_number, password, student_name, role, department, phone_number, created_at, updated_at, email, academic_year_at_start, incubation_start_date, retention_period_years, retention_end_date) VALUES (4, '238W1A0401', 'student123', 'Aravind Kumar', 'student', 'CSE', '9876543212', '2026-11-26 12:21:22.24965+05:30', '2026-11-26 12:21:22.24965+05:30', NULL, 1, '2026-11-27', 4, '2030-11-27');
INSERT INTO public.passwords (id, roll_number, password, student_name, role, department, phone_number, created_at, updated_at, email, academic_year_at_start, incubation_start_date, retention_period_years, retention_end_date) VALUES (5, '238W1A0499', 'password123', 'Suresh Kumar', 'student', 'ECE', '9876543211', '2026-11-26 12:46:23.841934+05:30', '2026-11-26 12:46:23.841934+05:30', NULL, 1, '2026-11-27', 4, '2030-11-27');
INSERT INTO public.passwords (id, roll_number, password, student_name, role, department, phone_number, created_at, updated_at, email, academic_year_at_start, incubation_start_date, retention_period_years, retention_end_date) VALUES (6, '238W1A0455', 'password123', 'Pooja Sharma', 'student', 'ECE', '9876500000', '2026-11-26 12:51:12.851882+05:30', '2026-11-26 12:51:12.851882+05:30', NULL, 1, '2026-11-27', 4, '2030-11-27');
INSERT INTO public.passwords (id, roll_number, password, student_name, role, department, phone_number, created_at, updated_at, email, academic_year_at_start, incubation_start_date, retention_period_years, retention_end_date) VALUES (7, '238W1A0466', 'studentpassword', 'Anil Kumar', 'student', 'ECE', '9988776655', '2026-11-26 13:04:54.749338+05:30', '2026-11-26 13:04:54.749338+05:30', NULL, 1, '2026-11-27', 4, '2030-11-27');
INSERT INTO public.passwords (id, roll_number, password, student_name, role, department, phone_number, created_at, updated_at, email, academic_year_at_start, incubation_start_date, retention_period_years, retention_end_date) VALUES (8, '238W1A05F1', 'ABC123', 'KONKA', 'student', 'Electronics & Communication Engineering', '9491024745', '2026-11-26 13:10:02.855593+05:30', '2026-11-26 13:10:02.855593+05:30', NULL, 1, '2026-11-27', 4, '2030-11-27');
INSERT INTO public.passwords (id, roll_number, password, student_name, role, department, phone_number, created_at, updated_at, email, academic_year_at_start, incubation_start_date, retention_period_years, retention_end_date) VALUES (9, '238W1A0412', 'studentpassword123', 'M. Sreeja', 'student', 'ECE', '9876543212', '2026-11-26 13:12:28.922547+05:30', '2026-11-26 13:12:28.922547+05:30', NULL, 1, '2026-11-27', 4, '2030-11-27');
INSERT INTO public.passwords (id, roll_number, password, student_name, role, department, phone_number, created_at, updated_at, email, academic_year_at_start, incubation_start_date, retention_period_years, retention_end_date) VALUES (10, '228W1A05G2', 'ABC321', 'RAJU', 'student', 'Electronics & Communication Engineering', '77777777777', '2026-11-26 13:27:58.952407+05:30', '2026-11-26 13:27:58.952407+05:30', NULL, 1, '2026-11-27', 4, '2030-11-27');
INSERT INTO public.passwords (id, roll_number, password, student_name, role, department, phone_number, created_at, updated_at, email, academic_year_at_start, incubation_start_date, retention_period_years, retention_end_date) VALUES (3, '238W1A0477', '000000', 'Harsha Vardhan', 'student', 'ECE', '9876543210', '2026-11-26 12:21:22.24965+05:30', '2026-11-26 23:34:29.105197+05:30', '238w1a0477@vrsec.ac.in', 1, '2026-11-27', 4, '2030-11-27');


--
-- Data for Name: power_consumption; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.power_consumption (id, device_id, device_name, device_type, location, actual_state, power_rating_watts, daily_kwh, weekly_kwh, monthly_kwh, yearly_kwh, estimated_monthly_cost, recorded_at, created_at, updated_at) VALUES (1, 'dev-light-zone-a', 'Smart Ceiling Lights 1', 'light', 'Zone A - South Bay', 'on', 80.00, 0.64, 4.48, 19.20, 230.40, 144.00, '2026-11-26 12:09:53.585153+05:30', '2026-11-26 12:09:53.585153+05:30', '2026-11-26 12:09:53.585153+05:30');
INSERT INTO public.power_consumption (id, device_id, device_name, device_type, location, actual_state, power_rating_watts, daily_kwh, weekly_kwh, monthly_kwh, yearly_kwh, estimated_monthly_cost, recorded_at, created_at, updated_at) VALUES (2, 'dev-fan-zone-b', 'Exhaust Fan Rack', 'fan', 'Zone B - Server & IoT Rack', 'on', 120.00, 1.20, 8.40, 36.00, 432.00, 270.00, '2026-11-26 12:09:53.652539+05:30', '2026-11-26 12:09:53.652539+05:30', '2026-11-26 12:09:53.652539+05:30');
INSERT INTO public.power_consumption (id, device_id, device_name, device_type, location, actual_state, power_rating_watts, daily_kwh, weekly_kwh, monthly_kwh, yearly_kwh, estimated_monthly_cost, recorded_at, created_at, updated_at) VALUES (3, 'dev-ac-main-hall', 'Inverter Air Conditioner', 'ac', 'Main Incubation Hall', 'on', 1500.00, 12.00, 84.00, 360.00, 4320.00, 2700.00, '2026-11-26 12:09:53.712669+05:30', '2026-11-26 12:09:53.712669+05:30', '2026-11-26 12:09:53.712669+05:30');
INSERT INTO public.power_consumption (id, device_id, device_name, device_type, location, actual_state, power_rating_watts, daily_kwh, weekly_kwh, monthly_kwh, yearly_kwh, estimated_monthly_cost, recorded_at, created_at, updated_at) VALUES (4, 'DEV-LIGHT-1', 'Main Lab Ceiling Light 1', 'light', 'Lab Section A', 'ON', 40.00, 0.32, 2.15, 9.40, 112.50, 70.50, '2026-11-27 01:34:13.084091+05:30', '2026-11-26 13:37:01.644563+05:30', '2026-11-27 01:34:13.084091+05:30');
INSERT INTO public.power_consumption (id, device_id, device_name, device_type, location, actual_state, power_rating_watts, daily_kwh, weekly_kwh, monthly_kwh, yearly_kwh, estimated_monthly_cost, recorded_at, created_at, updated_at) VALUES (5, 'DEV-LIGHT-2', 'Main Lab Ceiling Light 2', 'light', 'Lab Section B', 'ON', 40.00, 0.35, 2.20, 9.60, 115.00, 72.00, '2026-11-27 01:34:13.151598+05:30', '2026-11-26 13:37:01.737226+05:30', '2026-11-27 01:34:13.151598+05:30');
INSERT INTO public.power_consumption (id, device_id, device_name, device_type, location, actual_state, power_rating_watts, daily_kwh, weekly_kwh, monthly_kwh, yearly_kwh, estimated_monthly_cost, recorded_at, created_at, updated_at) VALUES (6, 'DEV-LIGHT-3', 'Workstation Focus Lights', 'light', 'Electronics Workbench', 'ON', 30.00, 0.12, 1.05, 4.80, 58.00, 36.00, '2026-11-27 01:34:13.219887+05:30', '2026-11-26 13:37:01.835588+05:30', '2026-11-27 01:34:13.219887+05:30');
INSERT INTO public.power_consumption (id, device_id, device_name, device_type, location, actual_state, power_rating_watts, daily_kwh, weekly_kwh, monthly_kwh, yearly_kwh, estimated_monthly_cost, recorded_at, created_at, updated_at) VALUES (7, 'DEV-LIGHT-4', 'Component Storage Rack Lights', 'light', 'Storage Cabinets', 'ON', 25.00, 0.08, 0.65, 3.10, 38.00, 23.25, '2026-11-27 01:34:13.28863+05:30', '2026-11-26 13:37:01.91686+05:30', '2026-11-27 01:34:13.28863+05:30');
INSERT INTO public.power_consumption (id, device_id, device_name, device_type, location, actual_state, power_rating_watts, daily_kwh, weekly_kwh, monthly_kwh, yearly_kwh, estimated_monthly_cost, recorded_at, created_at, updated_at) VALUES (8, 'DEV-FAN-1', 'Ceiling Fan 1 (Section A)', 'fan', 'Lab Section A', 'ON', 75.00, 0.45, 3.10, 13.50, 162.00, 101.25, '2026-11-27 01:34:13.360452+05:30', '2026-11-26 13:37:01.99574+05:30', '2026-11-27 01:34:13.360452+05:30');
INSERT INTO public.power_consumption (id, device_id, device_name, device_type, location, actual_state, power_rating_watts, daily_kwh, weekly_kwh, monthly_kwh, yearly_kwh, estimated_monthly_cost, recorded_at, created_at, updated_at) VALUES (9, 'DEV-FAN-2', 'Ceiling Fan 2 (Section B)', 'fan', 'Lab Section B', 'ON', 75.00, 0.50, 3.30, 14.20, 170.00, 106.50, '2026-11-27 01:34:13.430439+05:30', '2026-11-26 13:37:02.070214+05:30', '2026-11-27 01:34:13.430439+05:30');
INSERT INTO public.power_consumption (id, device_id, device_name, device_type, location, actual_state, power_rating_watts, daily_kwh, weekly_kwh, monthly_kwh, yearly_kwh, estimated_monthly_cost, recorded_at, created_at, updated_at) VALUES (10, 'DEV-FAN-3', 'Exhaust & Soldering Fume Fan', 'fan', 'Soldering Station', 'OFF', 60.00, 0.15, 1.20, 5.40, 65.00, 40.50, '2026-11-27 01:34:13.496551+05:30', '2026-11-26 13:37:02.134713+05:30', '2026-11-27 01:34:13.496551+05:30');
INSERT INTO public.power_consumption (id, device_id, device_name, device_type, location, actual_state, power_rating_watts, daily_kwh, weekly_kwh, monthly_kwh, yearly_kwh, estimated_monthly_cost, recorded_at, created_at, updated_at) VALUES (11, 'DEV-AC-1', 'Lab Air Conditioner (2 Ton Inverter)', 'ac', 'Main Lab Floor', 'ON', 1800.00, 7.20, 48.50, 205.00, 2460.00, 1537.50, '2026-11-27 01:34:13.560332+05:30', '2026-11-26 13:37:02.19814+05:30', '2026-11-27 01:34:13.560332+05:30');
INSERT INTO public.power_consumption (id, device_id, device_name, device_type, location, actual_state, power_rating_watts, daily_kwh, weekly_kwh, monthly_kwh, yearly_kwh, estimated_monthly_cost, recorded_at, created_at, updated_at) VALUES (12, 'DEV-PROJ-1', 'Ceiling High-Definition Projector', 'projector', 'Presentation Hall', 'OFF', 280.00, 0.40, 2.80, 11.50, 138.00, 86.25, '2026-11-27 01:34:13.628438+05:30', '2026-11-26 13:37:02.268793+05:30', '2026-11-27 01:34:13.628438+05:30');
INSERT INTO public.power_consumption (id, device_id, device_name, device_type, location, actual_state, power_rating_watts, daily_kwh, weekly_kwh, monthly_kwh, yearly_kwh, estimated_monthly_cost, recorded_at, created_at, updated_at) VALUES (13, 'DEV-CAM-1', 'Incubation Lab Camera (ESP32-CAM / IP)', 'camera', 'Lab Entrance / Workbench', 'off', 5.00, 0.12, 0.84, 3.60, 43.80, 27.00, '2026-11-27 01:34:13.694283+05:30', '2026-11-26 13:37:02.339216+05:30', '2026-11-27 01:34:13.694283+05:30');


--
-- Data for Name: projects; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.projects (id, title, description, domain, status, student_roll, student_name, team_members, tags, github_url, demo_url, created_at, updated_at) VALUES ('PROJ-IOT-001', 'Smart Incubation Gesture & Energy Controller', 'Automated energy tracking and PIR sensor control with ESP32 microcontrollers.', 'IoT & Embedded', 'showcase', '238W1A0477', 'hemadri', '[]', '["ESP32", "IoT", "Sensors"]', 'https://github.com/vrsec/smart-lab-iot', NULL, '2026-11-26 12:21:22.268047+05:30', '2026-11-26 12:21:22.268047+05:30');
INSERT INTO public.projects (id, title, description, domain, status, student_roll, student_name, team_members, tags, github_url, demo_url, created_at, updated_at) VALUES ('PROJ-AI-002', 'Computer Vision ID Scanner & OCR Pipeline', 'High-accuracy student ID card barcode and roll number extraction engine.', 'AI & ML', 'showcase', '238W1A0401', 'Aravind Kumar', '[]', '["Python", "OpenCV", "Vision"]', 'https://github.com/vrsec/ocr-pipeline', NULL, '2026-11-26 12:21:22.268047+05:30', '2026-11-26 12:21:22.268047+05:30');


--
-- Data for Name: research_publications; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.research_publications (id, title, abstract, paper_type, domain, journal_conference_name, student_roll, student_name, authors, doi, external_url, publication_date, created_at, updated_at) VALUES ('PUB-2026-001', 'Autonomous IoT Energy Monitoring and Grid Power Minimization in Academic Incubators', 'Explores edge IoT optimization techniques for distributed university hardware laboratories.', 'Conference Paper', 'IoT & Embedded Systems', 'IEEE International Smart Hardware Conference 2026', '238W1A0477', 'hemadri', '[]', '10.1109/ISHC.2026.1042', 'https://doi.org/10.1109/ISHC.2026.1042', '2026-11-26', '2026-11-26 12:21:22.279365+05:30', '2026-11-26 12:21:22.279365+05:30');
INSERT INTO public.research_publications (id, title, abstract, paper_type, domain, journal_conference_name, student_roll, student_name, authors, doi, external_url, publication_date, created_at, updated_at) VALUES ('PUB-2026-002', 'Edge Deep Learning for Offline Biometric Verification under Variable Illuminations', 'Presents a lightweight neural pipeline for facial landmark alignment on local edge hardware.', 'Journal Paper', 'Artificial Intelligence', 'Journal of Machine Vision & Robotics', '238W1A0401', 'Aravind Kumar', '[]', '10.1016/j.jmvr.2026.04.015', 'https://doi.org/10.1016/j.jmvr.2026.04.015', '2026-11-26', '2026-11-26 12:21:22.279365+05:30', '2026-11-26 12:21:22.279365+05:30');


--
-- Data for Name: visitor_attendance; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.visitor_attendance (id, visitor_id, full_name, visitor_type, organization_or_dept, phone_number, email, purpose_of_visit, host_or_accompanied_by, entry_time, exit_time, duration_minutes, status, remarks, created_at, updated_at) VALUES (1, 'VISITOR-20261126-1695-50', 'Dr. K. Srinivas', 'Visiting Faculty', 'Dept. of Mechanical Engineering', '+91 98480 12345', '', 'IoT Smart Automation Consultation & Project Review', 'Dr. Surya Prasad', '2026-11-27 00:50:01.753973+05:30', '2026-11-27 00:52:01.870927+05:30', 2, 'completed', '', '2026-11-27 00:50:01.753973+05:30', '2026-11-27 00:52:01.870927+05:30');
INSERT INTO public.visitor_attendance (id, visitor_id, full_name, visitor_type, organization_or_dept, phone_number, email, purpose_of_visit, host_or_accompanied_by, entry_time, exit_time, duration_minutes, status, remarks, created_at, updated_at) VALUES (2, 'VISITOR-20261126-2766-91', 'Prof. Ramesh Chandra', 'Visiting Faculty', 'Mechanical Engineering, JNTU Kakinada', '+91 99887 76655', '', 'Annual IoT Lab Infrastructure Review', 'Dr. Surya Prasad', '2026-11-27 01:06:42.829322+05:30', '2026-11-27 01:06:43.099216+05:30', 1, 'completed', 'Invited external academic auditor', '2026-11-27 01:06:42.829322+05:30', '2026-11-27 01:06:43.099216+05:30');
INSERT INTO public.visitor_attendance (id, visitor_id, full_name, visitor_type, organization_or_dept, phone_number, email, purpose_of_visit, host_or_accompanied_by, entry_time, exit_time, duration_minutes, status, remarks, created_at, updated_at) VALUES (3, 'VISITOR-20261126-6816-75', 'rajesh sharma', 'Visiting Faculty', 'eee', '', '', 'took something', '', '2026-11-27 01:34:56.888008+05:30', '2026-11-27 01:35:04.344516+05:30', 1, 'completed', '', '2026-11-27 01:34:56.888008+05:30', '2026-11-27 01:35:04.344516+05:30');


--
-- Name: passwords_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.passwords_id_seq', 10, true);


--
-- Name: power_consumption_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.power_consumption_id_seq', 133, true);


--
-- Name: visitor_attendance_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.visitor_attendance_id_seq', 3, true);


--
-- Name: issued_components issued_components_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issued_components
    ADD CONSTRAINT issued_components_pkey PRIMARY KEY (id);


--
-- Name: overdue_components overdue_components_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overdue_components
    ADD CONSTRAINT overdue_components_pkey PRIMARY KEY (id);


--
-- Name: passwords passwords_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.passwords
    ADD CONSTRAINT passwords_pkey PRIMARY KEY (id);


--
-- Name: passwords passwords_roll_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.passwords
    ADD CONSTRAINT passwords_roll_number_key UNIQUE (roll_number);


--
-- Name: power_consumption power_consumption_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.power_consumption
    ADD CONSTRAINT power_consumption_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: research_publications research_publications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.research_publications
    ADD CONSTRAINT research_publications_pkey PRIMARY KEY (id);


--
-- Name: power_consumption uq_device_record; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.power_consumption
    ADD CONSTRAINT uq_device_record UNIQUE (device_id);


--
-- Name: visitor_attendance visitor_attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitor_attendance
    ADD CONSTRAINT visitor_attendance_pkey PRIMARY KEY (id);


--
-- Name: visitor_attendance visitor_attendance_visitor_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitor_attendance
    ADD CONSTRAINT visitor_attendance_visitor_id_key UNIQUE (visitor_id);


--
-- Name: idx_issued_components_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_issued_components_date ON public.issued_components USING btree (issue_date DESC);


--
-- Name: idx_issued_components_reg; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_issued_components_reg ON public.issued_components USING btree (registration_number);


--
-- Name: idx_issued_components_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_issued_components_status ON public.issued_components USING btree (status);


--
-- Name: idx_overdue_days; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_overdue_days ON public.overdue_components USING btree (overdue_days DESC);


--
-- Name: idx_overdue_reg; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_overdue_reg ON public.overdue_components USING btree (registration_number);


--
-- Name: idx_overdue_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_overdue_status ON public.overdue_components USING btree (status);


--
-- Name: idx_passwords_roll; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_passwords_roll ON public.passwords USING btree (lower((roll_number)::text));


--
-- Name: idx_power_consumption_device; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_power_consumption_device ON public.power_consumption USING btree (device_id);


--
-- Name: idx_power_consumption_loc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_power_consumption_loc ON public.power_consumption USING btree (location);


--
-- Name: idx_power_consumption_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_power_consumption_time ON public.power_consumption USING btree (recorded_at DESC);


--
-- Name: idx_projects_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_created ON public.projects USING btree (created_at DESC);


--
-- Name: idx_projects_roll; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_roll ON public.projects USING btree (student_roll);


--
-- Name: idx_publications_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_publications_created ON public.research_publications USING btree (created_at DESC);


--
-- Name: idx_publications_roll; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_publications_roll ON public.research_publications USING btree (student_roll);


--
-- Name: idx_visitor_attendance_entry_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visitor_attendance_entry_time ON public.visitor_attendance USING btree (entry_time DESC);


--
-- Name: idx_visitor_attendance_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visitor_attendance_status ON public.visitor_attendance USING btree (status);


--
-- Name: passwords trg_passwords_retention; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_passwords_retention BEFORE INSERT OR UPDATE ON public.passwords FOR EACH ROW EXECUTE FUNCTION public.fn_calculate_retention();


--
-- PostgreSQL database dump complete
--


