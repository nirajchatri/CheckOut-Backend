import { getPool } from './pool.ts';

const DDL = `
IF OBJECT_ID(N'dbo.cms_content_fields', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.cms_content_fields (
    field_key NVARCHAR(120) NOT NULL PRIMARY KEY,
    field_value NVARCHAR(MAX) NOT NULL CONSTRAINT DF_cms_content_fields_value DEFAULT (''),
    updated_at DATETIME2 NOT NULL CONSTRAINT DF_cms_content_fields_updated DEFAULT (SYSUTCDATETIME())
  );
END;

IF OBJECT_ID(N'dbo.cms_section_visibility', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.cms_section_visibility (
    section_id NVARCHAR(50) NOT NULL PRIMARY KEY,
    is_visible BIT NOT NULL CONSTRAINT DF_cms_section_visibility_visible DEFAULT (1),
    updated_at DATETIME2 NOT NULL CONSTRAINT DF_cms_section_visibility_updated DEFAULT (SYSUTCDATETIME())
  );
END;

IF OBJECT_ID(N'dbo.cms_section_order', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.cms_section_order (
    sort_index INT NOT NULL,
    section_id NVARCHAR(50) NOT NULL,
    CONSTRAINT PK_cms_section_order PRIMARY KEY (sort_index),
    CONSTRAINT UQ_cms_section_order_section UNIQUE (section_id)
  );
END;

IF OBJECT_ID(N'dbo.fd_banks', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.fd_banks (
    bank_id NVARCHAR(80) NOT NULL PRIMARY KEY,
    bank_name NVARCHAR(200) NOT NULL,
    headline_rate NVARCHAR(20) NOT NULL,
    logo_url NVARCHAR(500) NOT NULL CONSTRAINT DF_fd_banks_logo DEFAULT (''),
    hero_image_url NVARCHAR(500) NOT NULL CONSTRAINT DF_fd_banks_hero DEFAULT (''),
    tagline NVARCHAR(200) NULL,
    about_json NVARCHAR(MAX) NULL,
    investment_conditions_json NVARCHAR(MAX) NULL,
    trust_points_json NVARCHAR(MAX) NULL,
    compare_banks_json NVARCHAR(MAX) NULL,
    faqs_json NVARCHAR(MAX) NULL,
    sort_order INT NOT NULL CONSTRAINT DF_fd_banks_sort DEFAULT (0),
    is_active BIT NOT NULL CONSTRAINT DF_fd_banks_active DEFAULT (1),
    created_at DATETIME2 NOT NULL CONSTRAINT DF_fd_banks_created DEFAULT (SYSUTCDATETIME()),
    updated_at DATETIME2 NOT NULL CONSTRAINT DF_fd_banks_updated DEFAULT (SYSUTCDATETIME())
  );
END;

IF OBJECT_ID(N'dbo.fd_bank_tenures', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.fd_bank_tenures (
    tenure_id NVARCHAR(80) NOT NULL PRIMARY KEY,
    bank_id NVARCHAR(80) NOT NULL,
    tenure_label NVARCHAR(30) NOT NULL,
    months INT NOT NULL,
    regular_rate DECIMAL(6, 3) NOT NULL,
    senior_rate DECIMAL(6, 3) NOT NULL,
    is_popular BIT NOT NULL CONSTRAINT DF_fd_bank_tenures_popular DEFAULT (0),
    sort_order INT NOT NULL CONSTRAINT DF_fd_bank_tenures_sort DEFAULT (0),
    updated_at DATETIME2 NOT NULL CONSTRAINT DF_fd_bank_tenures_updated DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_fd_bank_tenures_bank FOREIGN KEY (bank_id)
      REFERENCES dbo.fd_banks (bank_id) ON DELETE CASCADE
  );
  CREATE INDEX IX_fd_bank_tenures_bank ON dbo.fd_bank_tenures (bank_id, sort_order);
END;

IF OBJECT_ID(N'dbo.cms_meta', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.cms_meta (
    meta_key NVARCHAR(50) NOT NULL PRIMARY KEY,
    meta_value NVARCHAR(500) NOT NULL,
    updated_at DATETIME2 NOT NULL CONSTRAINT DF_cms_meta_updated DEFAULT (SYSUTCDATETIME())
  );
END;

IF OBJECT_ID(N'dbo.enquiries', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.enquiries (
    enquiry_id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(200) NOT NULL,
    email NVARCHAR(320) NOT NULL,
    mobile NVARCHAR(30) NOT NULL,
    address NVARCHAR(500) NOT NULL,
    city NVARCHAR(100) NOT NULL CONSTRAINT DF_enquiries_city DEFAULT (''),
    state NVARCHAR(100) NOT NULL CONSTRAINT DF_enquiries_state DEFAULT (''),
    pin NVARCHAR(10) NOT NULL CONSTRAINT DF_enquiries_pin DEFAULT (''),
    message NVARCHAR(MAX) NOT NULL,
    ip_address NVARCHAR(45) NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_enquiries_created DEFAULT (SYSUTCDATETIME())
  );
  CREATE INDEX IX_enquiries_created ON dbo.enquiries (created_at DESC);
END;

IF COL_LENGTH(N'dbo.enquiries', N'city') IS NULL
BEGIN
  ALTER TABLE dbo.enquiries ADD city NVARCHAR(100) NOT NULL CONSTRAINT DF_enquiries_city DEFAULT ('');
END;

IF COL_LENGTH(N'dbo.enquiries', N'state') IS NULL
BEGIN
  ALTER TABLE dbo.enquiries ADD state NVARCHAR(100) NOT NULL CONSTRAINT DF_enquiries_state DEFAULT ('');
END;

IF COL_LENGTH(N'dbo.enquiries', N'pin') IS NULL
BEGIN
  ALTER TABLE dbo.enquiries ADD pin NVARCHAR(10) NOT NULL CONSTRAINT DF_enquiries_pin DEFAULT ('');
END;

IF OBJECT_ID(N'dbo.investor_details', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.investor_details (
    investor_id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(200) NOT NULL,
    email NVARCHAR(320) NOT NULL,
    mobile NVARCHAR(30) NOT NULL,
    fund_name NVARCHAR(300) NOT NULL,
    message NVARCHAR(MAX) NOT NULL CONSTRAINT DF_investor_details_message DEFAULT (''),
    ip_address NVARCHAR(45) NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_investor_details_created DEFAULT (SYSUTCDATETIME())
  );
  CREATE INDEX IX_investor_details_created ON dbo.investor_details (created_at DESC);
  CREATE INDEX IX_investor_details_email ON dbo.investor_details (email);
END;
`;

export async function ensureSchema(): Promise<void> {
  const pool = await getPool();
  await pool.request().query(DDL);
}
