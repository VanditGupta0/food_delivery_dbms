import { useEffect, useMemo, useState } from "react";
import "./styles.css";

const API_BASE = "http://localhost:5000/api";

export default function App() {
  const [activeTab, setActiveTab] = useState("order");
  const [restaurants, setRestaurants] = useState([]);
  const [restaurantId, setRestaurantId] = useState("");
  const [menu, setMenu] = useState([]);
  const [selectedItems, setSelectedItems] = useState({});
  const [orderResponse, setOrderResponse] = useState(null);
  const [trackingOrderId, setTrackingOrderId] = useState("");
  const [trackingData, setTrackingData] = useState(null);
  const [error, setError] = useState("");
  
  // Data for remaining tables
  const [customers, setCustomers] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [payments, setPayments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [addresses, setAddresses] = useState([]);

  useEffect(() => {
    fetch(`${API_BASE}/restaurants`)
      .then((res) => res.json())
      .then((data) => {
        setRestaurants(data);
        if (data.length > 0 && !restaurantId) setRestaurantId(String(data[0].restaurant_id));
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (activeTab === "order" && restaurantId) {
      fetch(`${API_BASE}/restaurants/${restaurantId}/menu`)
        .then((res) => res.json())
        .then((data) => setMenu(data))
        .catch((err) => setError(err.message));
    } else if (activeTab === "customers") {
      fetchData("customers", setCustomers);
    } else if (activeTab === "drivers") {
      fetchData("drivers", setDrivers);
    } else if (activeTab === "admins") {
      fetchData("admins", setAdmins);
    } else if (activeTab === "ratings") {
      fetchData("ratings", setRatings);
    } else if (activeTab === "payments") {
      fetchData("payments", setPayments);
    } else if (activeTab === "categories") {
      fetchData("categories", setCategories);
    } else if (activeTab === "addresses") {
      fetchData("addresses", setAddresses);
    }
  }, [activeTab, restaurantId]);

  const fetchData = (endpoint, setter) => {
    fetch(`${API_BASE}/${endpoint}`)
      .then(res => res.json())
      .then(data => setter(data))
      .catch(err => setError(err.message));
  };

  const total = useMemo(() => {
    return Object.values(selectedItems).reduce((sum, item) => sum + item.subtotal, 0);
  }, [selectedItems]);

  const toggleItem = (menuItem) => {
    setSelectedItems((prev) => {
      const existing = prev[menuItem.item_code];
      if (existing) {
        const next = { ...prev };
        delete next[menuItem.item_code];
        return next;
      }
      return {
        ...prev,
        [menuItem.item_code]: {
          item_code: menuItem.item_code,
          item_name: menuItem.item_name,
          quantity: 1,
          subtotal: Number(menuItem.price),
          unitPrice: Number(menuItem.price),
        },
      };
    });
  };

  const updateQuantity = (itemCode, quantity) => {
    const numericQty = Math.max(1, Number(quantity || 1));
    setSelectedItems((prev) => ({
      ...prev,
      [itemCode]: {
        ...prev[itemCode],
        quantity: numericQty,
        subtotal: Number((prev[itemCode].unitPrice * numericQty).toFixed(2)),
      },
    }));
  };

  const placeOrder = async () => {
    try {
      setError("");
      const payload = {
        customer_id: 1,
        restaurant_id: Number(restaurantId),
        delivery_address_id: 1,
        payment_mode: "upi",
        items: Object.values(selectedItems).map(({ item_code, quantity }) => ({
          item_code,
          quantity,
        })),
      };

      const res = await fetch(`${API_BASE}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create order");
      setOrderResponse(data);
      setTrackingOrderId(String(data.order_id));
      setSelectedItems({});
      setActiveTab("order");
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchTracking = async () => {
    if (!trackingOrderId) return;
    try {
      const res = await fetch(`${API_BASE}/orders/${trackingOrderId}/tracking`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Tracking lookup failed");
      setTrackingData(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const renderOrderTab = () => (
    <>

      <div className="restaurant-selector">
        <select value={restaurantId} onChange={(e) => setRestaurantId(e.target.value)}>
          {restaurants.map((r) => (
            <option key={r.restaurant_id} value={r.restaurant_id}>
              📍 {r.name} - {r.address}
            </option>
          ))}
        </select>
      </div>

      <div className="menu-grid">
        {menu.map((item) => (
          <div key={item.item_code} className="menu-card">
            <img 
              src={item.image_url || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c"} 
              alt={item.item_name} 
              className="menu-image"
            />
            <div className="menu-content">
              <h3>{item.item_name}</h3>
              <p className="menu-description">{item.description}</p>
              <div className="menu-footer">
                <span className="price">Rs {item.price}</span>
                <div className="cart-controls">
                  {selectedItems[item.item_code] ? (
                    <input
                      type="number"
                      className="qty-input"
                      min="1"
                      style={{width: '60px', padding: '0.5rem', borderRadius: '8px', border: '1px solid #ddd'}}
                      value={selectedItems[item.item_code].quantity}
                      onChange={(e) => updateQuantity(item.item_code, e.target.value)}
                    />
                  ) : (
                    <button className="btn-add" onClick={() => toggleItem(item)}>Add</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {Object.keys(selectedItems).length > 0 && (
        <div className="checkout-section">
          <div>
            <h2 style={{margin: 0}}>Total: Rs {total.toFixed(2)}</h2>
            <p style={{margin: 0, opacity: 0.8}}>{Object.keys(selectedItems).length} items in cart</p>
          </div>
          <button className="checkout-btn" onClick={placeOrder}>Place Order</button>
        </div>
      )}

      {orderResponse && (
        <div className="success" style={{marginTop: '2rem'}}>
          🎉 Order #{orderResponse.order_id} placed! Tracking enabled below.
        </div>
      )}

      <section className="tracking-section card" style={{marginTop: '3rem'}}>
        <h2>📦 Track Order</h2>
        <div className="tracking-form">
          <input
            type="number"
            className="input-field"
            placeholder="Order ID"
            value={trackingOrderId}
            onChange={(e) => setTrackingOrderId(e.target.value)}
          />
          <button className="btn-add" onClick={fetchTracking}>Track</button>
        </div>
        {trackingData && (
          <div style={{marginTop: '1rem'}}>
            <p><strong>Status:</strong> <span className="status-badge">{trackingData.order_status}</span></p>
            <p><strong>Driver:</strong> {trackingData.driver_name || "Searching..."}</p>
            <p><strong>Phone:</strong> {trackingData.driver_phone || "N/A"}</p>
          </div>
        )}
      </section>
    </>
  );

  const renderTable = (headers, rows, keyField) => (
    <div className="table-container">
      <table>
        <thead>
          <tr>{headers.map(h => <th key={h}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row[keyField]}>
              {headers.map(h => {
                const val = row[h.toLowerCase().replace(/ /g, '_')];
                if (h.toLowerCase() === 'status') {
                   return <td key={h}><span className={`status-badge status-${val}`}>{val}</span></td>;
                }
                return <td key={h}>{String(val || 'N/A')}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="container">
      <header>
        <h1>FoodieHub</h1>
        <p>Advanced Management System for Food Delivery</p>
      </header>

      <div className="nav-tabs">
        <button className={`nav-tab ${activeTab === 'order' ? 'active' : ''}`} onClick={() => setActiveTab('order')}>🛒 Orders</button>
        <button className={`nav-tab ${activeTab === 'restaurants' ? 'active' : ''}`} onClick={() => setActiveTab('restaurants')}>🏢 Restaurants</button>
        <button className={`nav-tab ${activeTab === 'customers' ? 'active' : ''}`} onClick={() => setActiveTab('customers')}>👥 Customers</button>
        <button className={`nav-tab ${activeTab === 'drivers' ? 'active' : ''}`} onClick={() => setActiveTab('drivers')}>🛵 Drivers</button>
        <button className={`nav-tab ${activeTab === 'admins' ? 'active' : ''}`} onClick={() => setActiveTab('admins')}>🔑 Admins</button>
        <button className={`nav-tab ${activeTab === 'ratings' ? 'active' : ''}`} onClick={() => setActiveTab('ratings')}>⭐ Ratings</button>
        <button className={`nav-tab ${activeTab === 'payments' ? 'active' : ''}`} onClick={() => setActiveTab('payments')}>💰 Payments</button>
        <button className={`nav-tab ${activeTab === 'categories' ? 'active' : ''}`} onClick={() => setActiveTab('categories')}>📂 Categories</button>
        <button className={`nav-tab ${activeTab === 'addresses' ? 'active' : ''}`} onClick={() => setActiveTab('addresses')}>📍 Addresses</button>
      </div>

      {error && <div className="error" style={{marginBottom: '2rem'}}>{error}</div>}

      <main>
        {activeTab === 'order' && renderOrderTab()}
        {activeTab === 'restaurants' && renderTable(['Restaurant ID', 'Name', 'Address', 'Phone No'], restaurants, 'restaurant_id')}
        {activeTab === 'customers' && renderTable(['Customer ID', 'Name', 'Email', 'Phone No', 'Created At'], customers, 'customer_id')}
        {activeTab === 'drivers' && renderTable(['Driver ID', 'Name', 'Phone No', 'Status', 'Updated At'], drivers, 'driver_id')}
        {activeTab === 'admins' && renderTable(['Admin ID', 'Name', 'Created At'], admins, 'admin_id')}
        {activeTab === 'ratings' && renderTable(['Rating ID', 'Customer Name', 'Restaurant Name', 'Rating Value', 'Review Text'], ratings, 'rating_id')}
        {activeTab === 'payments' && renderTable(['Payment ID', 'Order ID', 'Amount', 'Mode', 'Status', 'Time'], payments, 'payment_id')}
        {activeTab === 'categories' && renderTable(['Category ID', 'Restaurant Name', 'Name', 'Created At'], categories, 'category_id')}
        {activeTab === 'addresses' && renderTable(['Address ID', 'Customer Name', 'Full Address', 'Address Type', 'Is Default'], addresses, 'address_id')}
      </main>
    </div>
  );
}
