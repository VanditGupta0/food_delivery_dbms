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

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend running on http://localhost:${PORT}`);
});
