-- Drop old tables to migrate to the new Roles-based Hierarchy
DROP TABLE IF EXISTS meeting_departments;
DROP TABLE IF EXISTS meetings;
DROP TABLE IF EXISTS posts;
DROP TABLE IF EXISTS role_transfers;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS roles;
DROP TABLE IF EXISTS departments;

-- 1. Roles (Defining the Hierarchy Power Levels)
-- Power levels: 100 (President/VP), 80 (Board/Secretary), 50 (Lead), 10 (Member)
CREATE TABLE roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    power_level INTEGER NOT NULL,
    created_by TEXT
);

-- 2. Departments
CREATE TABLE departments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT
);

-- 3. Users (Auth & Members)
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role_id TEXT NOT NULL,
    department_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id),
    FOREIGN KEY (department_id) REFERENCES departments(id)
);

-- 4. Role Transfers (Requests to swap/change roles)
CREATE TABLE role_transfers (
    id TEXT PRIMARY KEY,
    target_user_id TEXT NOT NULL,
    requested_role_id TEXT NOT NULL,
    requested_by_user_id TEXT NOT NULL, -- Who initiated the request (usually VP)
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (target_user_id) REFERENCES users(id),
    FOREIGN KEY (requested_role_id) REFERENCES roles(id)
);

-- 5. Meetings (Schedulers)
CREATE TABLE meetings (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    meeting_date DATETIME NOT NULL,
    created_by_user_id TEXT NOT NULL,
    is_global INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

-- 6. Meeting Department Links (Cross-department collaboration)
CREATE TABLE meeting_departments (
    meeting_id TEXT NOT NULL,
    department_id TEXT NOT NULL,
    PRIMARY KEY (meeting_id, department_id),
    FOREIGN KEY (meeting_id) REFERENCES meetings(id),
    FOREIGN KEY (department_id) REFERENCES departments(id)
);

-- 7. Posts (Blogs)
CREATE TABLE posts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    content TEXT NOT NULL,
    image_url TEXT,
    author_id TEXT NOT NULL,
    is_published INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users(id)
);

-- 8. Admin Tokens (custom auth registry)
CREATE TABLE admin_tokens (
    token TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    role_id TEXT NOT NULL DEFAULT 'member',
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    revoked_at DATETIME,
    FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- ==========================================
-- SEED DATA: Departments
-- ==========================================
INSERT INTO departments (id, name, description) VALUES 
('tech', 'Technology', 'Handles technical infrastructure and UI'),
('rnd', 'Research & Development', 'Handles consulting research'),
('pr', 'Public Relations', 'Handles social media and outreach');

-- ==========================================
-- SEED DATA: Strict Hierarchy Roles
-- ==========================================
INSERT INTO roles (id, name, power_level, created_by) VALUES 
('president', 'President', 100, 'system'),
('vice_president', 'Vice President', 100, 'system'),
('secretary', 'Secretary', 80, 'system'),
('lead', 'Technical Lead', 50, 'system'),
('member', 'General Member', 10, 'system');

-- ==========================================
-- SEED DATA: Dummy Accounts for Development
-- Replace with real accounts in production.
-- ==========================================
-- INSERT INTO users (id, name, email, role_id, department_id) VALUES 
-- ('dummy-president-1', 'Super Admin (Pres/VP)', 'admin@vitstudent.ac.in', 'president', NULL),
-- ('dummy-lead-tech', 'Dummy Tech Lead', 'techlead@vitstudent.ac.in', 'lead', 'tech'),
-- ('dummy-member-1', 'Dummy Member', 'member@vitstudent.ac.in', 'member', NULL);

-- ==========================================
-- SEED DATA: Sample Admin Token Registry
-- Replace or delete these rows after migrating to your own tokens.
-- ==========================================
-- INSERT INTO admin_tokens (token, email, name, role_id, created_by) VALUES
-- ('dev-superuser-token', 'admin@vitstudent.ac.in', 'Admin', 'president', 'system');

