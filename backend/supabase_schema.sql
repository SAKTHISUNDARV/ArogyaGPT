-- =====================================================================
-- ArogyaGPT Schema Initialization for Supabase (PostgreSQL)
-- Compatible with SQLAlchemy Models & Alembic Revision 7682c570084c
-- =====================================================================

-- 0. Enable UUID and pgcrypto extensions (standard on Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Create User Role Enum
DO $$ BEGIN
    CREATE TYPE user_role_enum AS ENUM ('patient', 'doctor', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create alembic_version table to keep Alembic migrations synced
CREATE TABLE IF NOT EXISTS alembic_version (
    version_num VARCHAR(32) NOT NULL PRIMARY KEY
);
INSERT INTO alembic_version (version_num) 
VALUES ('7682c570084c')
ON CONFLICT (version_num) DO NOTHING;

-- 3. Users Table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    email VARCHAR(255) NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20),
    date_of_birth TIMESTAMPTZ,
    gender VARCHAR(10),
    role user_role_enum NOT NULL DEFAULT 'patient',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_superuser BOOLEAN NOT NULL DEFAULT FALSE,
    preferred_language VARCHAR(10) NOT NULL DEFAULT 'en',
    avatar_url VARCHAR(500),
    bio TEXT,
    medical_registration_number VARCHAR(100),
    specialization VARCHAR(100),
    last_login_at TIMESTAMPTZ,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_users_email ON users(email);
CREATE INDEX IF NOT EXISTS ix_users_id ON users(id);
CREATE INDEX IF NOT EXISTS ix_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS ix_users_role ON users(role);

-- 4. API Usage Table
CREATE TABLE IF NOT EXISTS api_usage (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id VARCHAR(36),
    endpoint VARCHAR(500) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER NOT NULL,
    response_time_ms DOUBLE PRECISION,
    request_size_bytes INTEGER,
    response_size_bytes INTEGER,
    ip_address VARCHAR(45),
    request_id VARCHAR(36),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_api_usage_endpoint ON api_usage(endpoint);
CREATE INDEX IF NOT EXISTS ix_api_usage_id ON api_usage(id);
CREATE INDEX IF NOT EXISTS ix_api_usage_user_id ON api_usage(user_id);

-- 5. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    event_type VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(36),
    description TEXT,
    metadata JSONB,
    status VARCHAR(20) NOT NULL,
    http_method VARCHAR(10),
    endpoint VARCHAR(500),
    http_status_code INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS ix_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS ix_audit_logs_id ON audit_logs(id);
CREATE INDEX IF NOT EXISTS ix_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS ix_audit_logs_user_id ON audit_logs(user_id);

-- 6. Refresh Tokens Table
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    token_hash VARCHAR(512) NOT NULL UNIQUE,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    revoked_at TIMESTAMPTZ,
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    device_name VARCHAR(200),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_refresh_tokens_id ON refresh_tokens(id);
CREATE INDEX IF NOT EXISTS ix_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS ix_refresh_tokens_user_id ON refresh_tokens(user_id);

-- 7. Reports Table
CREATE TABLE IF NOT EXISTS reports (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    report_type VARCHAR(100),
    hospital_name VARCHAR(255),
    doctor_name VARCHAR(255),
    report_date TIMESTAMPTZ,
    patient_age INTEGER,
    patient_gender VARCHAR(10),
    status VARCHAR(50) NOT NULL DEFAULT 'uploaded',
    pipeline_stage VARCHAR(50) NOT NULL DEFAULT 'initial',
    processing_error TEXT,
    processing_started_at TIMESTAMPTZ,
    processing_completed_at TIMESTAMPTZ,
    celery_task_id VARCHAR(255),
    simplified_text TEXT,
    simplified_text_hindi TEXT,
    summary TEXT,
    risk_level VARCHAR(20),
    ai_metadata JSONB,
    version INTEGER NOT NULL DEFAULT 1,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_reports_created_at ON reports(created_at);
CREATE INDEX IF NOT EXISTS ix_reports_id ON reports(id);
CREATE INDEX IF NOT EXISTS ix_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS ix_reports_user_id ON reports(user_id);

-- 8. Abnormalities Table
CREATE TABLE IF NOT EXISTS abnormalities (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    report_id VARCHAR(36) NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    parameter_name VARCHAR(255) NOT NULL,
    parameter_unit VARCHAR(50),
    detected_value VARCHAR(100) NOT NULL,
    numeric_value DOUBLE PRECISION,
    reference_range_low DOUBLE PRECISION,
    reference_range_high DOUBLE PRECISION,
    reference_range_text VARCHAR(200),
    abnormality_type VARCHAR(20) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    clinical_significance TEXT,
    plain_language_explanation TEXT,
    is_llm_validated BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_abnormalities_id ON abnormalities(id);
CREATE INDEX IF NOT EXISTS ix_abnormalities_report_id ON abnormalities(report_id);

-- 9. Chat Sessions Table
CREATE TABLE IF NOT EXISTS chat_sessions (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    report_id VARCHAR(36) REFERENCES reports(id) ON DELETE SET NULL,
    title VARCHAR(500) NOT NULL DEFAULT 'New Conversation',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    message_count INTEGER NOT NULL DEFAULT 0,
    language_code VARCHAR(10) NOT NULL DEFAULT 'en',
    context_window_size INTEGER NOT NULL DEFAULT 10,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_chat_sessions_id ON chat_sessions(id);
CREATE INDEX IF NOT EXISTS ix_chat_sessions_report_id ON chat_sessions(report_id);
CREATE INDEX IF NOT EXISTS ix_chat_sessions_user_id ON chat_sessions(user_id);

-- 10. Chat Messages Table
CREATE TABLE IF NOT EXISTS chat_messages (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    session_id VARCHAR(36) NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    source_chunks JSONB,
    retrieved_context TEXT,
    model_used VARCHAR(100),
    tokens_used INTEGER,
    latency_ms DOUBLE PRECISION,
    is_helpful BOOLEAN,
    feedback_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS ix_chat_messages_id ON chat_messages(id);
CREATE INDEX IF NOT EXISTS ix_chat_messages_session_id ON chat_messages(session_id);

-- 11. Diagnoses Table
CREATE TABLE IF NOT EXISTS diagnoses (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    report_id VARCHAR(36) NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    condition_name VARCHAR(255) NOT NULL,
    icd10_code VARCHAR(20),
    confidence_score DOUBLE PRECISION,
    source VARCHAR(50) NOT NULL,
    plain_language TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_diagnoses_id ON diagnoses(id);
CREATE INDEX IF NOT EXISTS ix_diagnoses_report_id ON diagnoses(report_id);

-- 12. Extracted Texts Table
CREATE TABLE IF NOT EXISTS extracted_texts (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    report_id VARCHAR(36) NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    file_id VARCHAR(36),
    raw_text TEXT NOT NULL,
    cleaned_text TEXT,
    ocr_provider VARCHAR(50) NOT NULL,
    ocr_confidence DOUBLE PRECISION,
    language_detected VARCHAR(10),
    page_number INTEGER,
    word_count INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_extracted_texts_id ON extracted_texts(id);
CREATE INDEX IF NOT EXISTS ix_extracted_texts_report_id ON extracted_texts(report_id);

-- 13. Lab Results Table
CREATE TABLE IF NOT EXISTS lab_results (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    report_id VARCHAR(36) NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    test_name VARCHAR(255) NOT NULL,
    test_code VARCHAR(50),
    result_value VARCHAR(100) NOT NULL,
    numeric_value DOUBLE PRECISION,
    unit VARCHAR(50),
    reference_range VARCHAR(200),
    is_abnormal BOOLEAN NOT NULL DEFAULT FALSE,
    abnormality_direction VARCHAR(10),
    category VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_lab_results_id ON lab_results(id);
CREATE INDEX IF NOT EXISTS ix_lab_results_report_id ON lab_results(report_id);

-- 14. Medicines Table
CREATE TABLE IF NOT EXISTS medicines (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    report_id VARCHAR(36) NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    medicine_name VARCHAR(255) NOT NULL,
    generic_name VARCHAR(255),
    dosage VARCHAR(100),
    frequency VARCHAR(100),
    duration VARCHAR(100),
    route VARCHAR(50),
    purpose TEXT,
    plain_language TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_medicines_id ON medicines(id);
CREATE INDEX IF NOT EXISTS ix_medicines_report_id ON medicines(report_id);

-- 15. Report Chunks Table
CREATE TABLE IF NOT EXISTS report_chunks (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    report_id VARCHAR(36) NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    chunk_text TEXT NOT NULL,
    chunk_size INTEGER NOT NULL,
    faiss_vector_id INTEGER,
    embedding_model VARCHAR(200) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_report_chunks_chunk_index ON report_chunks(chunk_index);
CREATE INDEX IF NOT EXISTS ix_report_chunks_id ON report_chunks(id);
CREATE INDEX IF NOT EXISTS ix_report_chunks_report_id ON report_chunks(report_id);

-- 16. Report Files Table
CREATE TABLE IF NOT EXISTS report_files (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    report_id VARCHAR(36) NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    original_filename VARCHAR(500) NOT NULL,
    stored_filename VARCHAR(500) NOT NULL,
    file_path VARCHAR(1000) NOT NULL,
    file_url VARCHAR(1000),
    file_type VARCHAR(10) NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    checksum_md5 VARCHAR(32),
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    page_count INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_report_files_id ON report_files(id);
CREATE INDEX IF NOT EXISTS ix_report_files_report_id ON report_files(report_id);

-- 17. Report Versions Table
CREATE TABLE IF NOT EXISTS report_versions (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    report_id VARCHAR(36) NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    snapshot_data JSONB NOT NULL,
    changed_by_user_id VARCHAR(36),
    change_reason VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_report_versions_id ON report_versions(id);
CREATE INDEX IF NOT EXISTS ix_report_versions_report_id ON report_versions(report_id);

-- 18. Translations Table
CREATE TABLE IF NOT EXISTS translations (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    report_id VARCHAR(36) NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    language_code VARCHAR(10) NOT NULL,
    language_name VARCHAR(50) NOT NULL,
    original_text TEXT NOT NULL,
    translated_text TEXT NOT NULL,
    translation_provider VARCHAR(50) NOT NULL,
    character_count INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_translations_id ON translations(id);
CREATE INDEX IF NOT EXISTS ix_translations_language_code ON translations(language_code);
CREATE INDEX IF NOT EXISTS ix_translations_report_id ON translations(report_id);

-- 19. Voice Requests Table
CREATE TABLE IF NOT EXISTS voice_requests (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    report_id VARCHAR(36) REFERENCES reports(id) ON DELETE CASCADE,
    user_id VARCHAR(36) NOT NULL,
    input_text TEXT NOT NULL,
    language_code VARCHAR(10) NOT NULL,
    tts_provider VARCHAR(50) NOT NULL,
    audio_file_path VARCHAR(1000),
    audio_file_url VARCHAR(1000),
    audio_duration_seconds DOUBLE PRECISION,
    file_size_bytes INTEGER,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_voice_requests_id ON voice_requests(id);
CREATE INDEX IF NOT EXISTS ix_voice_requests_report_id ON voice_requests(report_id);

-- =====================================================================
-- Default / Initial Seed Data
-- =====================================================================

-- Default Admin User (Password: Admin@123456 -> bcrypt hash)
INSERT INTO users (
    id, email, hashed_password, full_name, role, is_active, is_email_verified, is_superuser, preferred_language
) VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'admin@arogyagpt.com',
    '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW',
    'Arogya Administrator',
    'admin',
    TRUE,
    TRUE,
    TRUE,
    'en'
) ON CONFLICT (email) DO NOTHING;

-- Default Demo Doctor User (Password: Doctor@123456 -> bcrypt hash)
INSERT INTO users (
    id, email, hashed_password, full_name, role, is_active, is_email_verified, is_superuser, preferred_language, specialization
) VALUES (
    'b0000000-0000-0000-0000-000000000002',
    'doctor@arogyagpt.com',
    '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW',
    'Dr. Rajesh Sharma',
    'doctor',
    TRUE,
    TRUE,
    FALSE,
    'en',
    'General Medicine'
) ON CONFLICT (email) DO NOTHING;
