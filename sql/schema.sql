-- CheckOut CMS SQL Server schema
-- Database: checkout

-- CMS text/image field values (hero.title, features.subtitle, etc.)
-- Table: cms_content_fields
--   field_key NVARCHAR(120) PK
--   field_value NVARCHAR(MAX)
--   updated_at DATETIME2

-- Page section visibility toggles
-- Table: cms_section_visibility
--   section_id NVARCHAR(50) PK
--   is_visible BIT
--   updated_at DATETIME2

-- Page section display order
-- Table: cms_section_order
--   sort_index INT PK
--   section_id NVARCHAR(50) UNIQUE

-- FD calculator banks
-- Table: fd_banks
--   bank_id, bank_name, headline_rate, logo_url, hero_image_url
--   tagline, about_json, investment_conditions_json, trust_points_json
--   compare_banks_json, faqs_json, sort_order, is_active

-- FD tenure rates per bank (General + Senior Citizen)
-- Table: fd_bank_tenures
--   tenure_id, bank_id FK, tenure_label, months
--   regular_rate, senior_rate, is_popular, sort_order

-- CMS metadata (last updated timestamp)
-- Table: cms_meta
--   meta_key, meta_value, updated_at
