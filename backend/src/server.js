const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { pool, query } = require("./db");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/api/health", async (_req, res) => {
  try {
    await query("SELECT 1");
    res.json({ ok: true, message: "Backend + PostgreSQL connected" });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

// Login Endpoints
app.post("/api/login/customer", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: "Email and password are required" });
  try {
    const result = await query("SELECT * FROM login_customer($1, $2)", [email, password]);
    if (result.rows.length === 0) return res.status(401).json({ message: "Invalid email or password" });
    res.json({ role: "customer", ...result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/login/admin", async (req, res) => {
  const { name, password } = req.body;
  if (!name || !password) return res.status(400).json({ message: "Name and password are required" });
  try {
    const result = await query("SELECT * FROM login_admin($1, $2)", [name, password]);
    if (result.rows.length === 0) return res.status(401).json({ message: "Invalid name or password" });
    res.json({ role: "admin", ...result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/restaurants", async (_req, res) => {
  try {
    const result = await query(
      `SELECT restaurant_id, name, address, phone_no
       FROM restaurant
       ORDER BY restaurant_id`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/restaurants/:restaurantId/menu", async (req, res) => {
  const { restaurantId } = req.params;
  try {
    const result = await query(
      `SELECT c.category_id, c.name AS category_name,
              m.item_code, m.item_name, m.price, m.description, m.is_available, m.image_url
       FROM category c
       JOIN menu_item m ON m.category_id = c.category_id
       WHERE c.restaurant_id = $1
       ORDER BY c.category_id, m.item_code`,
      [restaurantId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/orders", async (req, res) => {
  const { customer_id, restaurant_id, delivery_address_id, items, payment_mode } =
    req.body;

  if (!customer_id || !restaurant_id || !delivery_address_id || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "Missing required order fields" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const itemCodes = items.map((item) => item.item_code);
    const menuRows = await client.query(
      `SELECT item_code, price FROM menu_item WHERE item_code = ANY($1::int[])`,
      [itemCodes]
    );
    const menuMap = new Map(menuRows.rows.map((row) => [row.item_code, Number(row.price)]));

    let totalAmount = 0;
    const validatedItems = items.map((item) => {
      const dbPrice = menuMap.get(item.item_code);
      const quantity = Number(item.quantity || 1);
      if (!dbPrice) {
        throw new Error(`Invalid item_code: ${item.item_code}`);
      }
      if (quantity < 1) {
        throw new Error(`Invalid quantity for item_code: ${item.item_code}`);
      }
      const subtotal = Number((dbPrice * quantity).toFixed(2));
      totalAmount += subtotal;
      return {
        item_code: item.item_code,
        quantity,
        item_price: dbPrice,
        subtotal,
      };
    });

    const orderResult = await client.query(
      `INSERT INTO order_details (customer_id, restaurant_id, amount, status, delivery_address_id)
       VALUES ($1, $2, $3, 'pending', $4)
       RETURNING order_id`,
      [customer_id, restaurant_id, totalAmount, delivery_address_id]
    );
    const orderId = orderResult.rows[0].order_id;

    for (const item of validatedItems) {
      await client.query(
        `INSERT INTO orders (order_id, item_code, quantity, item_price, subtotal)
         VALUES ($1, $2, $3, $4, $5)`,
        [orderId, item.item_code, item.quantity, item.item_price, item.subtotal]
      );
    }

    await client.query(
      `INSERT INTO payment_details (order_id, amount, mode, status)
       VALUES ($1, $2, $3, 'pending')`,
      [orderId, totalAmount, payment_mode || "cash"]
    );

    await client.query("COMMIT");
    res.status(201).json({
      message: "Order created successfully",
      order_id: orderId,
      amount: totalAmount,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    res.status(400).json({ message: error.message });
  } finally {
    client.release();
  }
});

app.get("/api/orders/:orderId/tracking", async (req, res) => {
  const { orderId } = req.params;
  try {
    const deliveryResult = await query(
      `SELECT od.order_id, od.status AS order_status, od.amount,
              ds.delivery_id, ds.status AS delivery_status, ds.driver_id,
              d.name AS driver_name, d.phone_no AS driver_phone,
              rl.latitude AS res_lat, rl.longitude AS res_lng,
              ca.latitude AS cus_lat, ca.longitude AS cus_lng
       FROM order_details od
       LEFT JOIN restaurant_location rl ON rl.restaurant_id = od.restaurant_id
       LEFT JOIN customer_address ca ON ca.address_id = od.delivery_address_id
       LEFT JOIN delivery_status ds ON ds.order_id = od.order_id
       LEFT JOIN driver d ON d.driver_id = ds.driver_id
       WHERE od.order_id = $1`,
      [orderId]
    );

    if (deliveryResult.rows.length === 0) {
      return res.status(404).json({ message: "Order not found" });
    }

    const order = deliveryResult.rows[0];
    let latestLocation = null;

    if (order.delivery_id) {
      const locationResult = await query(
        `SELECT latitude, longitude, timestamp
         FROM driver_location
         WHERE delivery_id = $1
         ORDER BY timestamp DESC
         LIMIT 1`,
        [order.delivery_id]
      );
      latestLocation = locationResult.rows[0] || null;
    }

    res.json({ ...order, latest_location: latestLocation });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// New endpoints for remaining tables
app.get("/api/customers", async (_req, res) => {
  try {
    const result = await query("SELECT * FROM customer ORDER BY customer_id");
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/drivers", async (_req, res) => {
  try {
    const result = await query("SELECT * FROM driver ORDER BY driver_id");
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get orders for a specific customer
app.get("/api/customers/:id/orders", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await query(
      `SELECT od.order_id, r.name as restaurant_name, od.amount, od.status, od.order_time
       FROM order_details od
       JOIN restaurant r ON od.restaurant_id = r.restaurant_id
       WHERE od.customer_id = $1
       ORDER BY od.order_time DESC`,
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get addresses for a specific customer
app.get("/api/customers/:id/addresses", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await query(
      `SELECT ca.*, c.name as customer_name 
       FROM customer_address ca
       JOIN customer c ON ca.customer_id = c.customer_id
       WHERE ca.customer_id = $1
       ORDER BY ca.address_id`,
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get live delivery map for a specific customer
app.get("/api/customers/:id/delivery-map", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await query(
      `SELECT od.order_id, od.status AS order_status, od.amount,
              r.name AS restaurant_name,
              rl.latitude AS res_lat, rl.longitude AS res_lng, 
              COALESCE(rl.full_address, r.address) AS res_address,
              c.name AS customer_name,
              ca.latitude AS cus_lat, ca.longitude AS cus_lng, ca.full_address AS cus_address,
              d.name AS driver_name, d.phone_no AS driver_phone, d.status AS driver_status,
              ds.status AS delivery_status
       FROM order_details od
       JOIN restaurant r ON od.restaurant_id = r.restaurant_id
       LEFT JOIN restaurant_location rl ON rl.restaurant_id = r.restaurant_id
       JOIN customer c ON od.customer_id = c.customer_id
       LEFT JOIN customer_address ca ON ca.address_id = od.delivery_address_id
       LEFT JOIN delivery_status ds ON ds.order_id = od.order_id
       LEFT JOIN driver d ON d.driver_id = ds.driver_id
       WHERE od.customer_id = $1
       ORDER BY od.order_id`,
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/admins", async (_req, res) => {
  try {
    const result = await query("SELECT * FROM admin ORDER BY admin_id");
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/ratings", async (_req, res) => {
  try {
    const result = await query(`
      SELECT r.*, c.name as customer_name, rest.name as restaurant_name 
      FROM rating r
      JOIN customer c ON r.customer_id = c.customer_id
      JOIN restaurant rest ON r.restaurant_id = rest.restaurant_id
      ORDER BY r.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/ratings", async (req, res) => {
  const { customer_id, restaurant_id, rating_value, review_text } = req.body;
  try {
    const result = await query(
      `INSERT INTO rating (customer_id, restaurant_id, rating_value, review_text)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [customer_id, restaurant_id, rating_value, review_text]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/payments", async (_req, res) => {
  try {
    const result = await query("SELECT * FROM payment_details ORDER BY time DESC");
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/categories", async (_req, res) => {
  try {
    const result = await query(`
      SELECT c.*, r.name as restaurant_name 
      FROM category c
      JOIN restaurant r ON c.restaurant_id = r.restaurant_id
      ORDER BY c.category_id
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/addresses", async (_req, res) => {
  try {
    const result = await query(`
      SELECT ca.*, c.name as customer_name 
      FROM customer_address ca
      JOIN customer c ON ca.customer_id = c.customer_id
      ORDER BY ca.address_id
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/addresses", async (req, res) => {
  const { customer_id, full_address, latitude, longitude, address_type, is_default } = req.body;
  try {
    const result = await query(
      `INSERT INTO customer_address (customer_id, full_address, latitude, longitude, address_type, is_default)
       VALUES ($1, $2, $3, $4, $5::address_type, $6) RETURNING *`,
      [customer_id, full_address, latitude || 0, longitude || 0, address_type || 'home', is_default || false]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Address Insert Error:", error.message);
    res.status(500).json({ message: error.message });
  }
});

// Analytics Dashboard API
app.get("/api/analytics", async (_req, res) => {
  try {
    const totalRevenue = await query(
      `SELECT COALESCE(SUM(amount), 0) AS total_revenue, COUNT(*) AS total_orders FROM order_details`
    );
    const statusDist = await query(
      `SELECT status, COUNT(*) AS count FROM order_details GROUP BY status ORDER BY count DESC`
    );
    const topRestaurants = await query(
      `SELECT r.name, COUNT(od.order_id) AS order_count, COALESCE(SUM(od.amount), 0) AS revenue
       FROM order_details od
       JOIN restaurant r ON od.restaurant_id = r.restaurant_id
       GROUP BY r.name ORDER BY revenue DESC LIMIT 5`
    );
    const topItems = await query(
      `SELECT m.item_name, SUM(o.quantity) AS total_sold, SUM(o.subtotal) AS revenue
       FROM orders o
       JOIN menu_item m ON o.item_code = m.item_code
       GROUP BY m.item_name ORDER BY total_sold DESC LIMIT 5`
    );
    const customerCount = await query(`SELECT COUNT(*) AS count FROM customer`);
    const driverCount = await query(`SELECT COUNT(*) AS count FROM driver`);
    const avgRating = await query(`SELECT ROUND(AVG(rating_value), 1) AS avg_rating FROM rating`);

    res.json({
      total_revenue: totalRevenue.rows[0].total_revenue,
      total_orders: totalRevenue.rows[0].total_orders,
      total_customers: customerCount.rows[0].count,
      total_drivers: driverCount.rows[0].count,
      avg_rating: avgRating.rows[0].avg_rating,
      status_distribution: statusDist.rows,
      top_restaurants: topRestaurants.rows,
      top_items: topItems.rows,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delivery Map API
app.get("/api/delivery-map", async (_req, res) => {
  try {
    const result = await query(`
       SELECT od.order_id, od.status AS order_status, od.amount,
              r.name AS restaurant_name,
              rl.latitude AS res_lat, rl.longitude AS res_lng, 
              COALESCE(rl.full_address, r.address) AS res_address,
              c.name AS customer_name,
              ca.latitude AS cus_lat, ca.longitude AS cus_lng, ca.full_address AS cus_address,
              d.name AS driver_name, d.phone_no AS driver_phone, d.status AS driver_status,
              ds.status AS delivery_status
       FROM order_details od
       JOIN restaurant r ON od.restaurant_id = r.restaurant_id
       LEFT JOIN restaurant_location rl ON rl.restaurant_id = r.restaurant_id
       JOIN customer c ON od.customer_id = c.customer_id
       LEFT JOIN customer_address ca ON ca.address_id = od.delivery_address_id
       LEFT JOIN delivery_status ds ON ds.order_id = od.order_id
       LEFT JOIN driver d ON d.driver_id = ds.driver_id
       ORDER BY od.order_id
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend running on http://localhost:${PORT}`);
});
