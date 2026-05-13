import 'dotenv/config'
import { pool } from './pool.js'

const sql = `
  CREATE EXTENSION IF NOT EXISTS "pgcrypto";

  DO $$ BEGIN CREATE TYPE user_role AS ENUM ('buyer', 'seller', 'admin'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN CREATE TYPE listing_type AS ENUM ('service', 'product'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN CREATE TYPE listing_status AS ENUM ('active', 'paused', 'deleted'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN CREATE TYPE order_type AS ENUM ('product', 'service'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'shipped', 'fulfilled', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

  CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'buyer',
    display_name VARCHAR(60),
    avatar_url VARCHAR(500),
    bio TEXT,
    saved_shipping_address JSONB,
    stripe_customer_id VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- Add stripe_customer_id to existing deployments that ran the first migration
  ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(100);

  CREATE TABLE IF NOT EXISTS storefronts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) UNIQUE,
    slug VARCHAR(40) UNIQUE NOT NULL,
    display_name VARCHAR(60) NOT NULL,
    bio TEXT,
    avatar_url VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storefront_id UUID NOT NULL REFERENCES storefronts(id),
    type listing_type NOT NULL,
    title VARCHAR(120) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    category VARCHAR(60),
    image_url VARCHAR(500),
    status listing_status NOT NULL DEFAULT 'active',
    inventory_count INTEGER,
    delivery_window_days INTEGER,
    search_vector TSVECTOR,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS listings_search_idx ON listings USING GIN (search_vector);

  CREATE OR REPLACE FUNCTION listings_search_trigger() RETURNS trigger AS $$
  BEGIN
    NEW.search_vector :=
      setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(NEW.description, '')), 'B') ||
      setweight(to_tsvector('english', coalesce(NEW.category, '')), 'C');
    RETURN NEW;
  END
  $$ LANGUAGE plpgsql;

  DROP TRIGGER IF EXISTS listings_search_update ON listings;
  CREATE TRIGGER listings_search_update
    BEFORE INSERT OR UPDATE ON listings
    FOR EACH ROW EXECUTE FUNCTION listings_search_trigger();

  CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id UUID NOT NULL REFERENCES users(id),
    order_type order_type NOT NULL,
    status order_status NOT NULL DEFAULT 'pending',
    total DECIMAL(10,2),
    stripe_pi_id VARCHAR(100),
    shipping_addr JSONB,
    requested_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id),
    listing_id UUID NOT NULL REFERENCES listings(id),
    quantity INTEGER NOT NULL,
    price_at_purchase DECIMAL(10,2) NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cart_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    listing_id UUID NOT NULL REFERENCES listings(id),
    quantity INTEGER NOT NULL,
    UNIQUE(user_id, listing_id)
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES listings(id),
    buyer_id UUID NOT NULL REFERENCES users(id),
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    body TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(listing_id, buyer_id)
  );
`

async function migrate() {
  const client = await pool.connect()
  try {
    await client.query(sql)
    // eslint-disable-next-line no-console
    console.log('Migration complete.')
  } finally {
    client.release()
    await pool.end()
  }
}

migrate().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exit(1)
})
