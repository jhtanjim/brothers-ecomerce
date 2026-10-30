-- Needed by the search indexes in the next migration. It was installed by hand on the first
-- databases, so a new empty database could not apply the migrations without this.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
