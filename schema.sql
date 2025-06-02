-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles Table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  ducks_found INTEGER DEFAULT 0 NOT NULL,
  ducks_named INTEGER DEFAULT 0 NOT NULL,
  total_distance_tracked DECIMAL(10, 2) DEFAULT 0.0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ducks Table
CREATE TABLE ducks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  short_code TEXT UNIQUE NOT NULL, -- e.g., for short URLs like /d/shortcode
  qr_code_url TEXT, -- URL pointing to the QR code image if stored/managed elsewhere
  name TEXT,
  named_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  first_found_at TIMESTAMP WITH TIME ZONE,
  total_finds INTEGER DEFAULT 0 NOT NULL,
  total_distance DECIMAL(10, 2) DEFAULT 0.0 NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL -- To deactivate lost or damaged ducks
  -- batch_id can be added if ducks are always created in batches
);

-- Duck Finds Table
CREATE TABLE duck_finds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  duck_id UUID NOT NULL REFERENCES ducks(id) ON DELETE CASCADE,
  found_by UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Null if found by anonymous user
  found_by_anonymous TEXT, -- Name or identifier for anonymous finders
  found_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  latitude DECIMAL(9, 6),
  longitude DECIMAL(9, 6),
  location_accuracy DECIMAL(9, 6), -- Accuracy of the location in meters
  note TEXT, -- Optional note from the finder
  distance_from_last_find DECIMAL(10, 2), -- Calculated distance from the previous find
  user_agent TEXT, -- User agent of the finding device
  ip_address INET, -- IP address of the finder
  photo_url TEXT, -- URL to a photo uploaded by the finder
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Short URLs Table (primarily for QR codes linking to ducks)
CREATE TABLE short_urls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  short_code TEXT UNIQUE NOT NULL, -- The short code part of the URL
  original_url TEXT NOT NULL, -- The full URL it redirects to (e.g., app-specific duck page)
  duck_id UUID REFERENCES ducks(id) ON DELETE CASCADE, -- Link to the duck if it's a duck URL
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  visit_count INTEGER DEFAULT 0 NOT NULL
);

-- QR Batches Table (for managing batches of QR codes printed)
CREATE TABLE qr_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT, -- e.g., "Conference Batch 2024", "Online Store Q1"
  description TEXT,
  quantity INTEGER NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  fulfilled_at TIMESTAMP WITH TIME ZONE -- When the physical QRs were made available
);

-- Junction table to associate ducks with QR batches (many-to-many, though a duck is usually in one batch)
-- If a duck can only belong to one batch, add a batch_id to the ducks table instead.
-- For this schema, assuming a duck is created as part of one batch.
ALTER TABLE ducks
ADD COLUMN batch_id UUID REFERENCES qr_batches(id) ON DELETE SET NULL;

-- Indexes for frequently queried columns
CREATE INDEX idx_ducks_named_by ON ducks(named_by);
CREATE INDEX idx_duck_finds_duck_id ON duck_finds(duck_id);
CREATE INDEX idx_duck_finds_found_by ON duck_finds(found_by);
CREATE INDEX idx_short_urls_duck_id ON short_urls(duck_id);
CREATE INDEX idx_ducks_batch_id ON ducks(batch_id);

-- Potentially add RLS policies here or in separate files.
-- Example for profiles:
-- ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Public profiles are viewable by everyone." ON profiles FOR SELECT USING (true);
-- CREATE POLICY "Users can insert their own profile." ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
-- CREATE POLICY "Users can update own profile." ON profiles FOR UPDATE USING (auth.uid() = id);
-- (Similar policies would be needed for other tables based on access patterns)

-- Function to update duck stats on new find (example, might be better handled in application logic or more complex triggers)
CREATE OR REPLACE FUNCTION update_duck_on_new_find()
RETURNS TRIGGER AS $$
BEGIN
  -- Update total_finds for the duck
  UPDATE ducks
  SET
    total_finds = total_finds + 1,
    first_found_at = COALESCE(first_found_at, NEW.found_at),
    total_distance = total_distance + COALESCE(NEW.distance_from_last_find, 0.0)
  WHERE id = NEW.duck_id;

  -- Update ducks_found for the profile if user is not anonymous
  IF NEW.found_by IS NOT NULL THEN
    UPDATE profiles
    SET ducks_found = ducks_found + 1
    WHERE id = NEW.found_by;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update duck stats after a new find is inserted
CREATE TRIGGER on_new_duck_find
  AFTER INSERT ON duck_finds
  FOR EACH ROW
  EXECUTE FUNCTION update_duck_on_new_find();

-- Function to update profile when a duck is named
CREATE OR REPLACE FUNCTION update_profile_on_duck_named()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.named_by IS NOT NULL AND (OLD.named_by IS NULL OR OLD.named_by <> NEW.named_by) THEN
    UPDATE profiles
    SET ducks_named = ducks_named + 1
    WHERE id = NEW.named_by;
  END IF;
  IF OLD.named_by IS NOT NULL AND NEW.named_by IS NULL THEN
     UPDATE profiles
     SET ducks_named = ducks_named - 1
     WHERE id = OLD.named_by AND ducks_named > 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update profile stats when a duck is named or unnamed
CREATE TRIGGER on_duck_named
  AFTER UPDATE OF named_by ON ducks
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_on_duck_named();

-- Note: The `auth.users` table is assumed to be provided by Supabase authentication.
-- The `uuid_generate_v4()` function is available if the `uuid-ossp` extension is enabled.
-- Decimal precision (10,2) for distances might need adjustment based on expected values.
-- Location precision (9,6) is standard for GPS coordinates.
-- `total_distance_tracked` on profiles could be updated by a trigger on `duck_finds` as well,
-- summing `distance_from_last_find` for finds made by that user. This can get complex
-- if a user finds the same duck multiple times.
-- For simplicity, `total_distance_tracked` on profiles is not automatically updated by these triggers.
-- It might be better calculated by application logic or a more sophisticated DB function/view.

COMMENT ON COLUMN ducks.short_code IS 'Unique short identifier for the duck, used in friendly URLs.';
COMMENT ON COLUMN duck_finds.distance_from_last_find IS 'Distance in kilometers or miles from the duck''s previously recorded location.';
COMMENT ON TABLE qr_batches IS 'Represents a batch of QR codes that were printed or generated together.';

-- Add RLS policies for all tables as needed, for example:
-- DUCKS
ALTER TABLE ducks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ducks are viewable by everyone." ON ducks FOR SELECT USING (true);
-- Allow authenticated users to create ducks (perhaps admin only - adjust as needed)
CREATE POLICY "Authenticated users can create ducks." ON ducks FOR INSERT WITH CHECK (auth.role() = 'authenticated');
-- Allow user who named the duck or admin to update it
CREATE POLICY "Users can update ducks they named or admins." ON ducks FOR UPDATE USING (auth.uid() = named_by OR get_my_claim('user_role') = '"admin"') WITH CHECK (auth.uid() = named_by OR get_my_claim('user_role') = '"admin"');
-- (Admins should have bypass RLS capabilities or specific admin policies)

-- DUCK_FINDS
ALTER TABLE duck_finds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Duck finds are viewable by everyone." ON duck_finds FOR SELECT USING (true);
-- Allow authenticated users to record their finds
CREATE POLICY "Users can insert their own finds." ON duck_finds FOR INSERT WITH CHECK (auth.uid() = found_by AND found_by_anonymous IS NULL);
-- Allow anonymous users to insert finds
CREATE POLICY "Anonymous users can insert finds." ON duck_finds FOR INSERT WITH CHECK (found_by IS NULL AND found_by_anonymous IS NOT NULL);
-- Allow user who made the find to update it (e.g. add a note or photo later) - Anonymous users cannot update.
CREATE POLICY "Users can update their own finds." ON duck_finds FOR UPDATE USING (auth.uid() = found_by) WITH CHECK (auth.uid() = found_by);

-- SHORT_URLS
ALTER TABLE short_urls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Short URLs are publicly readable for redirection." ON short_urls FOR SELECT USING (true);
-- Policies for creation/update of short_urls would depend on how they are managed (e.g., admin only, or specific users)
CREATE POLICY "Admins can manage short URLs." ON short_urls FOR ALL USING (get_my_claim('user_role') = '"admin"') WITH CHECK (get_my_claim('user_role') = '"admin"');


-- QR_BATCHES
ALTER TABLE qr_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "QR Batches are viewable by admins." ON qr_batches FOR SELECT USING (get_my_claim('user_role') = '"admin"');
CREATE POLICY "Admins can manage QR Batches." ON qr_batches FOR ALL USING (get_my_claim('user_role') = '"admin"') WITH CHECK (get_my_claim('user_role') = '"admin"');

-- Helper function to get user claims (example, depends on Supabase setup)
CREATE OR REPLACE FUNCTION get_my_claim(claim TEXT) RETURNS JSONB
    LANGUAGE sql STABLE
    AS $$
  SELECT nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> claim
$$;

-- Ensure the user running these commands has permissions to create tables, extensions, and policies.
-- For Supabase, you'd typically run this via the SQL editor in the dashboard or as a migration.
-- The `auth.users` table and `auth.uid()` function are specific to Supabase. If using a different auth system, adjust accordingly.

-- Final check on default values and NOT NULL constraints based on requirements.
-- `ducks_found`, `ducks_named`, `total_distance_tracked` on `profiles` should not be nullable if they have a default.
-- `total_finds`, `total_distance`, `is_active` on `ducks` should not be nullable.
-- `visit_count` on `short_urls` should not be nullable.
-- `found_at` on `duck_finds` should not be nullable.
-- `quantity` on `qr_batches` should not be nullable.
-- (The current script mostly has these correct with DEFAULT 0 NOT NULL or similar)

-- Consider if `short_code` on `ducks` should be generated by a sequence or function if not provided.
-- For now, it's marked as NOT NULL, implying it must be provided on insert.
-- A unique index is already specified.

-- The triggers `update_duck_on_new_find` and `update_profile_on_duck_named` provide basic data consistency.
-- More complex scenarios or calculations (like `total_distance_tracked` on profiles) might
-- require more sophisticated triggers or be handled at the application layer for performance and complexity reasons.

-- Remember to configure RLS for the `auth.users` table if direct queries are ever made by non-service roles.
-- Usually, access to `auth.users` is restricted, and user data is exposed via the `profiles` table.
-- The `REFERENCES auth.users(id)` already establishes a link and potential cascade behavior.
-- END OF SQL SCRIPT
