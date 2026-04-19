/**
 * SEED SCRIPT
 *
 * Run with: npm run seed --workspace=server
 *
 * This populates the database with realistic fake data for development.
 * It is safe to re-run: it wipes existing data first (in reverse FK order)
 * then re-inserts everything fresh.
 *
 * Insertion order (foreign key dependencies):
 *   1. users
 *   2. storefronts  (needs users)
 *   3. listings     (needs storefronts)
 *   4. orders       (needs users)
 *   5. order_items  (needs orders + listings)
 *   6. reviews      (needs listings + users)
 */

// ---------------------------------------------------------------------------
// IMPORTS
// ---------------------------------------------------------------------------

// "dotenv/config" reads your .env file and loads every variable into
// process.env so that process.env.DATABASE_URL works below.
import 'dotenv/config'

// bcrypt is what we use to hash passwords before storing them.
// Never store plain text passwords — if the database leaks, every
// user's account on every site they reuse that password is compromised.
import bcrypt from 'bcrypt'

// Our database connection pool. A "pool" keeps several connections open
// so multiple requests don't have to wait for one to finish.
import { pool } from './pool.js'

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------

// saltRounds controls how many times bcrypt scrambles the password.
// 12 rounds = 2^12 = 4,096 iterations. Slow enough to resist brute-force
// attacks, fast enough that a single login doesn't feel slow.
const SALT_ROUNDS = 12

// ---------------------------------------------------------------------------
// STEP 1 — USERS
// ---------------------------------------------------------------------------
// We define our users as plain JavaScript objects first (no database yet).
// Separating data definition from insertion makes the code easier to read
// and change — you can add a user without touching the SQL at all.
//
// password_plain: what a real user would type at the login form
// role: 'buyer' is the default. We'll set sellers to 'seller' here
//       because in the real app a user becomes a seller by creating a
//       storefront — and we're creating storefronts for them below.
const USER_DEFINITIONS = [
  {
    username: 'alicemaker',
    email: 'alice@example.com',
    password_plain: 'password123',
    role: 'seller',
  },
  { username: 'bobcraft', email: 'bob@example.com', password_plain: 'password123', role: 'seller' },
  {
    username: 'carladesign',
    email: 'carla@example.com',
    password_plain: 'password123',
    role: 'seller',
  },
  {
    username: 'danibakes',
    email: 'dani@example.com',
    password_plain: 'password123',
    role: 'seller',
  },
  { username: 'eveteach', email: 'eve@example.com', password_plain: 'password123', role: 'seller' },
  {
    username: 'frankbuyer',
    email: 'frank@example.com',
    password_plain: 'password123',
    role: 'buyer',
  },
  {
    username: 'graceshop',
    email: 'grace@example.com',
    password_plain: 'password123',
    role: 'buyer',
  },
  {
    username: 'henrybrowse',
    email: 'henry@example.com',
    password_plain: 'password123',
    role: 'buyer',
  },
  { username: 'isashops', email: 'isa@example.com', password_plain: 'password123', role: 'buyer' },
  { username: 'jadmin', email: 'admin@example.com', password_plain: 'password123', role: 'admin' },
]

// ---------------------------------------------------------------------------
// STEP 2 — STOREFRONTS
// ---------------------------------------------------------------------------
// Each storefront belongs to one seller user. We reference the seller by
// their username (e.g. 'alicemaker') — later in the code we'll look up
// the actual UUID that PostgreSQL assigned to that user and use that as
// owner_id. You'll see this pattern a lot: define data with human-readable
// references, then resolve them to database IDs at insert time.
//
// slug: this becomes the public URL — /shop/alice-handmade
//       Rules: lowercase, letters/numbers/hyphens only, unique across all storefronts
const STOREFRONT_DEFINITIONS = [
  {
    owner_username: 'alicemaker',
    slug: 'alice-handmade',
    display_name: "Alice's Handmade",
    bio: 'Custom crochet, knitted goods, and fiber art commissions.',
  },
  {
    owner_username: 'bobcraft',
    slug: 'bobs-woodshop',
    display_name: "Bob's Woodshop",
    bio: 'Hand-crafted wooden furniture, cutting boards, and décor.',
  },
  {
    owner_username: 'carladesign',
    slug: 'carla-studio',
    display_name: 'Carla Studio',
    bio: 'Graphic design, logo work, and brand identity packages.',
  },
  {
    owner_username: 'danibakes',
    slug: 'danis-kitchen',
    display_name: "Dani's Kitchen",
    bio: 'Custom cakes, cookies, and baking lessons for all levels.',
  },
  {
    owner_username: 'eveteach',
    slug: 'eve-tutors',
    display_name: 'Eve Tutors',
    bio: 'Math, science, and coding tutoring — middle school through college.',
  },
]

// ---------------------------------------------------------------------------
// STEP 3 — LISTINGS
// ---------------------------------------------------------------------------
// Listings belong to storefronts. We reference them by slug here.
//
// type: 'product' or 'service' — this is the discriminated union from the TDD.
//       Products need inventory_count (how many are in stock).
//       Services need delivery_window_days (how long fulfillment takes).
//       The other field must be null — the database enforces nothing there,
//       but our Zod schema and application logic do.
//
// status: 'active' means visible to buyers. 'paused' hides it. 'deleted' is
//         a soft delete — data stays for order history but nothing shows it.
const LISTING_DEFINITIONS = [
  // Alice's Handmade — crochet products + lessons (services)
  {
    storefront_slug: 'alice-handmade',
    type: 'product',
    title: 'Chunky Knit Throw Blanket',
    description:
      'Handmade merino wool chunky knit blanket, 50x60 inches. Available in cream, gray, and terracotta.',
    price: 89.0,
    category: 'Home & Decor',
    inventory_count: 8,
    delivery_window_days: null,
  },
  {
    storefront_slug: 'alice-handmade',
    type: 'product',
    title: 'Crochet Market Bag',
    description:
      'Reusable cotton market bag, handmade with an open-weave pattern. Holds up to 20 lbs.',
    price: 28.0,
    category: 'Accessories',
    inventory_count: 15,
    delivery_window_days: null,
  },
  {
    storefront_slug: 'alice-handmade',
    type: 'service',
    title: 'Beginner Crochet Lesson (1 hour)',
    description:
      'One-on-one virtual crochet lesson. We cover foundation chains, single and double crochet, and your first small project.',
    price: 45.0,
    category: 'Lessons',
    inventory_count: null,
    delivery_window_days: 7,
  },
  {
    storefront_slug: 'alice-handmade',
    type: 'service',
    title: 'Custom Crochet Commission',
    description:
      'Send me your idea and I will crochet it. Pricing covers design consultation and production of one medium-sized item.',
    price: 120.0,
    category: 'Custom Work',
    inventory_count: null,
    delivery_window_days: 21,
  },

  // Bob's Woodshop — products only
  {
    storefront_slug: 'bobs-woodshop',
    type: 'product',
    title: 'Walnut Cutting Board',
    description:
      'End-grain walnut cutting board, 12x18 inches. Food-safe oil finish. Each board has a unique grain pattern.',
    price: 75.0,
    category: 'Kitchen',
    inventory_count: 12,
    delivery_window_days: null,
  },
  {
    storefront_slug: 'bobs-woodshop',
    type: 'product',
    title: 'Floating Shelf Set (2 shelves)',
    description:
      'Solid oak floating shelves, 24 inches wide. Includes hidden brackets and all mounting hardware.',
    price: 110.0,
    category: 'Home & Decor',
    inventory_count: 6,
    delivery_window_days: null,
  },
  {
    storefront_slug: 'bobs-woodshop',
    type: 'product',
    title: 'Personalized Wooden Keepsake Box',
    description:
      'Engraved maple keepsake box, 8x5 inches. Felt-lined interior. Choose your engraving text at checkout.',
    price: 55.0,
    category: 'Gifts',
    inventory_count: 20,
    delivery_window_days: null,
  },
  {
    storefront_slug: 'bobs-woodshop',
    type: 'service',
    title: 'Custom Furniture Consultation',
    description:
      'One-hour design session to plan a custom piece — dining table, bookshelf, or desk. Includes a written quote.',
    price: 60.0,
    category: 'Custom Work',
    inventory_count: null,
    delivery_window_days: 5,
  },

  // Carla Studio — design services
  {
    storefront_slug: 'carla-studio',
    type: 'service',
    title: 'Logo Design Package',
    description:
      'Three logo concepts, two rounds of revisions, final files in PNG, SVG, and PDF. Turnaround: 5 business days.',
    price: 250.0,
    category: 'Design',
    inventory_count: null,
    delivery_window_days: 7,
  },
  {
    storefront_slug: 'carla-studio',
    type: 'service',
    title: 'Brand Identity Kit',
    description:
      'Full brand package: logo, color palette, typography guide, and business card template. 10 business day turnaround.',
    price: 600.0,
    category: 'Design',
    inventory_count: null,
    delivery_window_days: 14,
  },
  {
    storefront_slug: 'carla-studio',
    type: 'service',
    title: 'Social Media Template Pack',
    description:
      'Set of 10 customizable Canva templates sized for Instagram, Facebook, and LinkedIn. Delivered within 3 days.',
    price: 95.0,
    category: 'Design',
    inventory_count: null,
    delivery_window_days: 3,
  },
  {
    storefront_slug: 'carla-studio',
    type: 'product',
    title: 'Printable Business Card Template',
    description:
      'Editable Canva business card template. Download link sent immediately. Print-ready at 300 DPI.',
    price: 12.0,
    category: 'Templates',
    inventory_count: 999,
    delivery_window_days: null,
  },

  // Dani's Kitchen — baked goods + lessons
  {
    storefront_slug: 'danis-kitchen',
    type: 'product',
    title: 'Dozen Decorated Sugar Cookies',
    description:
      'Royal icing sugar cookies, custom decorated for your event. Flavors: vanilla, lemon, or almond. 1 week lead time.',
    price: 42.0,
    category: 'Food & Baking',
    inventory_count: 10,
    delivery_window_days: null,
  },
  {
    storefront_slug: 'danis-kitchen',
    type: 'product',
    title: 'Custom 6-inch Celebration Cake',
    description:
      'Two-layer 6-inch cake with buttercream frosting. Choose flavor and write a short note for the decoration.',
    price: 65.0,
    category: 'Food & Baking',
    inventory_count: 5,
    delivery_window_days: null,
  },
  {
    storefront_slug: 'danis-kitchen',
    type: 'service',
    title: 'Virtual Baking Lesson (1 hour)',
    description:
      'Learn to bake bread, cookies, or a simple cake from scratch. All skill levels welcome. Materials list sent after booking.',
    price: 50.0,
    category: 'Lessons',
    inventory_count: null,
    delivery_window_days: 7,
  },
  {
    storefront_slug: 'danis-kitchen',
    type: 'service',
    title: 'Custom Cake Design Consultation',
    description:
      'Thirty-minute video call to design your dream celebration cake. Includes a detailed quote for production.',
    price: 25.0,
    category: 'Custom Work',
    inventory_count: null,
    delivery_window_days: 3,
  },

  // Eve Tutors — tutoring services
  {
    storefront_slug: 'eve-tutors',
    type: 'service',
    title: 'SAT Math Tutoring Session (90 min)',
    description:
      'Focused SAT math prep. We work through your weak areas using real practice problems. Progress tracked session to session.',
    price: 80.0,
    category: 'Tutoring',
    inventory_count: null,
    delivery_window_days: 3,
  },
  {
    storefront_slug: 'eve-tutors',
    type: 'service',
    title: 'Intro to Python — 4-Session Course',
    description:
      'Four 60-minute sessions covering Python basics: variables, loops, functions, and a final mini-project. Beginner-friendly.',
    price: 200.0,
    category: 'Tutoring',
    inventory_count: null,
    delivery_window_days: 14,
  },
  {
    storefront_slug: 'eve-tutors',
    type: 'service',
    title: 'Algebra I Drop-In Session (1 hour)',
    description:
      'Bring your homework or a specific topic you are stuck on. We work through it together live.',
    price: 55.0,
    category: 'Tutoring',
    inventory_count: null,
    delivery_window_days: 2,
  },
  {
    storefront_slug: 'eve-tutors',
    type: 'product',
    title: 'SAT Math Prep Workbook (PDF)',
    description:
      'Fifty curated SAT math problems with full worked solutions and strategy notes. Instant PDF download.',
    price: 18.0,
    category: 'Study Materials',
    inventory_count: 999,
    delivery_window_days: null,
  },
]

// ---------------------------------------------------------------------------
// STEP 4 — ORDERS, ORDER_ITEMS, REVIEWS
// ---------------------------------------------------------------------------
// These are more complex because:
//   - An order references a buyer (by username) and listings (by title)
//   - An order_item captures price_at_purchase — a snapshot of the price
//     at the moment of purchase (immutable — even if the listing price changes later)
//   - A review requires a fulfilled order for that listing (purchase verification)
//
// We keep these as a combined structure so it's easy to see which order
// produced which review.
const ORDER_DEFINITIONS = [
  {
    buyer_username: 'frankbuyer',
    order_type: 'product',
    status: 'fulfilled',
    shipping_addr: {
      street: '42 Maple Ave',
      city: 'Brooklyn',
      state: 'NY',
      zip: '11201',
      country: 'US',
    },
    items: [{ listing_title: 'Chunky Knit Throw Blanket', quantity: 1 }],
    reviews: [
      {
        listing_title: 'Chunky Knit Throw Blanket',
        rating: 5,
        body: 'Absolutely beautiful. The cream color is perfect and it arrived well packaged.',
      },
    ],
  },
  {
    buyer_username: 'graceshop',
    order_type: 'product',
    status: 'fulfilled',
    shipping_addr: { street: '8 Elm St', city: 'Queens', state: 'NY', zip: '11354', country: 'US' },
    items: [
      { listing_title: 'Walnut Cutting Board', quantity: 1 },
      { listing_title: 'Personalized Wooden Keepsake Box', quantity: 2 },
    ],
    reviews: [
      {
        listing_title: 'Walnut Cutting Board',
        rating: 5,
        body: 'Gorgeous board, beautiful grain. Ships fast.',
      },
      {
        listing_title: 'Personalized Wooden Keepsake Box',
        rating: 4,
        body: 'Great quality. The engraving came out sharp. Slight delay in shipping.',
      },
    ],
  },
  {
    buyer_username: 'henrybrowse',
    order_type: 'product',
    status: 'fulfilled',
    shipping_addr: { street: '15 Oak Rd', city: 'Bronx', state: 'NY', zip: '10451', country: 'US' },
    items: [{ listing_title: 'Dozen Decorated Sugar Cookies', quantity: 1 }],
    reviews: [
      {
        listing_title: 'Dozen Decorated Sugar Cookies',
        rating: 5,
        body: 'These were the hit of the party. Everyone asked where I got them.',
      },
    ],
  },
  {
    buyer_username: 'isashops',
    order_type: 'product',
    status: 'fulfilled',
    shipping_addr: {
      street: '3 Pine St',
      city: 'Manhattan',
      state: 'NY',
      zip: '10001',
      country: 'US',
    },
    items: [{ listing_title: 'Printable Business Card Template', quantity: 1 }],
    reviews: [
      {
        listing_title: 'Printable Business Card Template',
        rating: 4,
        body: 'Clean design, easy to edit in Canva. Exactly what I needed.',
      },
    ],
  },
  {
    buyer_username: 'frankbuyer',
    order_type: 'product',
    status: 'fulfilled',
    shipping_addr: {
      street: '42 Maple Ave',
      city: 'Brooklyn',
      state: 'NY',
      zip: '11201',
      country: 'US',
    },
    items: [{ listing_title: 'SAT Math Prep Workbook (PDF)', quantity: 1 }],
    reviews: [
      {
        listing_title: 'SAT Math Prep Workbook (PDF)',
        rating: 5,
        body: 'Worked solutions are clear and the strategy tips actually helped me improve my score.',
      },
    ],
  },
  // Service bookings (order_type: 'service', requested_date required)
  {
    buyer_username: 'graceshop',
    order_type: 'service',
    status: 'fulfilled',
    shipping_addr: null,
    requested_date: '2026-05-10',
    items: [{ listing_title: 'Beginner Crochet Lesson (1 hour)', quantity: 1 }],
    reviews: [],
  },
  {
    buyer_username: 'henrybrowse',
    order_type: 'service',
    status: 'fulfilled',
    shipping_addr: null,
    requested_date: '2026-05-14',
    items: [{ listing_title: 'Virtual Baking Lesson (1 hour)', quantity: 1 }],
    reviews: [],
  },
  {
    buyer_username: 'isashops',
    order_type: 'service',
    status: 'fulfilled',
    shipping_addr: null,
    requested_date: '2026-05-20',
    items: [{ listing_title: 'Logo Design Package', quantity: 1 }],
    reviews: [],
  },
]

// ---------------------------------------------------------------------------
// MAIN FUNCTION
// ---------------------------------------------------------------------------
// async/await means: "this function does things that take time (database calls)
// and it waits for each one to finish before moving to the next line."
//
// Without async/await you'd have callbacks inside callbacks inside callbacks —
// a mess called "callback hell." async/await makes asynchronous code read
// like normal top-to-bottom code.
async function seed() {
  // pool.connect() gives us a dedicated connection from the pool.
  // We use a single client (connection) for the whole seed so we can
  // wrap everything in one transaction.
  const client = await pool.connect()

  try {
    // ------------------------------------------------------------------
    // BEGIN TRANSACTION
    // ------------------------------------------------------------------
    // A transaction is an all-or-nothing operation. Either ALL of the
    // inserts below succeed, or NONE of them do. If anything throws an
    // error halfway through, the ROLLBACK in the catch block undoes
    // everything — you never end up with half-seeded data.
    await client.query('BEGIN')

    // ------------------------------------------------------------------
    // WIPE EXISTING DATA (in reverse FK order)
    // ------------------------------------------------------------------
    // We delete in the opposite order of insertion. If we tried to delete
    // users first, PostgreSQL would complain: "you can't delete this user,
    // they're referenced by a storefront." We delete the dependents first.
    //
    // TRUNCATE ... CASCADE does it in one command — it follows all the
    // foreign key chains and clears dependent tables automatically.
    console.log('Clearing existing data…')
    await client.query('TRUNCATE users CASCADE')
    // CASCADE automatically clears storefronts, listings, orders,
    // order_items, cart_items, and reviews because they all chain
    // back to users through foreign keys.

    // ------------------------------------------------------------------
    // INSERT USERS
    // ------------------------------------------------------------------
    console.log('Inserting users…')

    // Map over our definitions and hash each password.
    // Promise.all() runs all the bcrypt.hash() calls in parallel —
    // hashing is slow (intentionally), so doing them concurrently
    // rather than one-by-one cuts the total time significantly.
    const hashedUsers = await Promise.all(
      USER_DEFINITIONS.map(async (u) => ({
        ...u, // spread all existing fields (username, email, role…)
        password_hash: await bcrypt.hash(u.password_plain, SALT_ROUNDS),
      }))
    )

    // Now insert each hashed user into the database.
    // We build an array of inserted user rows so we can look up IDs later.
    const insertedUsers = []

    for (const u of hashedUsers) {
      // Parameterized query — NEVER concatenate user data into SQL strings.
      // $1, $2, $3… are placeholders. The actual values go in the array
      // as the second argument. This prevents SQL injection attacks.
      //
      // RETURNING * means: after inserting, send back the full row.
      // That's how we get the UUID that PostgreSQL auto-generated for `id`.
      const { rows } = await client.query(
        `INSERT INTO users (email, username, password, role)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [u.email, u.username, u.password_hash, u.role]
      )
      insertedUsers.push(rows[0])
    }

    // Build a lookup map: { 'frankbuyer': { id: 'uuid...', ... }, ... }
    // This lets us find a user's UUID by their username later.
    const userByUsername = Object.fromEntries(insertedUsers.map((u) => [u.username, u]))

    // ------------------------------------------------------------------
    // INSERT STOREFRONTS
    // ------------------------------------------------------------------
    console.log('Inserting storefronts…')

    const insertedStorefronts = []

    for (const sf of STOREFRONT_DEFINITIONS) {
      // Look up the owner's UUID using the username we stored in the definition.
      const owner = userByUsername[sf.owner_username]

      const { rows } = await client.query(
        `INSERT INTO storefronts (owner_id, slug, display_name, bio)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [owner.id, sf.slug, sf.display_name, sf.bio]
      )
      insertedStorefronts.push(rows[0])
    }

    // Build a lookup map: { 'alice-handmade': { id: 'uuid...', ... }, ... }
    const storefrontBySlug = Object.fromEntries(insertedStorefronts.map((sf) => [sf.slug, sf]))

    // ------------------------------------------------------------------
    // INSERT LISTINGS
    // ------------------------------------------------------------------
    console.log('Inserting listings…')

    const insertedListings = []

    for (const l of LISTING_DEFINITIONS) {
      const storefront = storefrontBySlug[l.storefront_slug]

      // Note: we don't insert search_vector manually.
      // The PostgreSQL trigger (from migrate.js) fires on every INSERT
      // and builds it automatically from title + description + category.
      const { rows } = await client.query(
        `INSERT INTO listings
           (storefront_id, type, title, description, price, category,
            inventory_count, delivery_window_days, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')
         RETURNING *`,
        [
          storefront.id,
          l.type,
          l.title,
          l.description,
          l.price,
          l.category,
          l.inventory_count, // NULL for services
          l.delivery_window_days, // NULL for products
        ]
      )
      insertedListings.push(rows[0])
    }

    // Build a lookup map: { 'Walnut Cutting Board': { id: '...', price: 75, ... } }
    const listingByTitle = Object.fromEntries(insertedListings.map((l) => [l.title, l]))

    // ------------------------------------------------------------------
    // INSERT ORDERS, ORDER_ITEMS, and REVIEWS
    // ------------------------------------------------------------------
    console.log('Inserting orders, order_items, and reviews…')

    for (const orderDef of ORDER_DEFINITIONS) {
      const buyer = userByUsername[orderDef.buyer_username]

      // Calculate the total by summing (price × quantity) for each item.
      // We use price_at_purchase = the listing's current price.
      // In a real purchase, this snapshot is captured at checkout time
      // so future price changes don't alter historical order totals.
      const total = orderDef.items.reduce((sum, item) => {
        const listing = listingByTitle[item.listing_title]
        return sum + parseFloat(listing.price) * item.quantity
      }, 0)

      // Insert the order.
      // shipping_addr is stored as JSONB — a JSON blob.
      // We pass it as a JavaScript object; pg serializes it to JSON automatically.
      // Service orders have no shipping address (null) but have requested_date.
      const { rows: orderRows } = await client.query(
        `INSERT INTO orders (buyer_id, order_type, status, total, shipping_addr, requested_date)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          buyer.id,
          orderDef.order_type,
          orderDef.status,
          total.toFixed(2),
          orderDef.shipping_addr ? JSON.stringify(orderDef.shipping_addr) : null,
          orderDef.requested_date ?? null,
        ]
      )
      const order = orderRows[0]

      // Insert each line item (order_item) for this order.
      for (const item of orderDef.items) {
        const listing = listingByTitle[item.listing_title]

        await client.query(
          `INSERT INTO order_items (order_id, listing_id, quantity, price_at_purchase)
           VALUES ($1, $2, $3, $4)`,
          [order.id, listing.id, item.quantity, listing.price]
        )

        // Decrement inventory for product listings.
        // Services don't have inventory — we skip them.
        if (listing.type === 'product' && listing.inventory_count !== null) {
          await client.query(
            `UPDATE listings SET inventory_count = inventory_count - $1 WHERE id = $2`,
            [item.quantity, listing.id]
          )
        }
      }

      // Insert any reviews attached to this order.
      // Reviews are only possible when the order is 'fulfilled' (purchase verified).
      for (const review of orderDef.reviews) {
        const listing = listingByTitle[review.listing_title]

        await client.query(
          `INSERT INTO reviews (listing_id, buyer_id, rating, body)
           VALUES ($1, $2, $3, $4)`,
          [listing.id, buyer.id, review.rating, review.body]
        )
      }
    }

    // ------------------------------------------------------------------
    // COMMIT
    // ------------------------------------------------------------------
    // Everything succeeded — make all changes permanent.
    // Before COMMIT, all these inserts exist only inside our transaction.
    // Other database connections can't see them yet. COMMIT makes them real.
    await client.query('COMMIT')
    console.log('Seed complete.')
  } catch (err) {
    // ------------------------------------------------------------------
    // ROLLBACK
    // ------------------------------------------------------------------
    // Something went wrong. Undo every insert from this transaction.
    // The database returns to exactly the state it was in before BEGIN.
    await client.query('ROLLBACK')
    console.error('Seed failed — rolled back.', err)
    process.exit(1)
  } finally {
    // ------------------------------------------------------------------
    // RELEASE
    // ------------------------------------------------------------------
    // Always release the connection back to the pool, whether we succeeded
    // or failed. If you forget this, the connection is "leaked" — the pool
    // eventually runs out of connections and the app hangs.
    client.release()
    await pool.end()
  }
}

seed()
