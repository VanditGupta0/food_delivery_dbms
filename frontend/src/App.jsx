import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import LoginPage from "./LoginPage";

const API_BASE = "http://localhost:5000/api";

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("");
  const [restaurants, setRestaurants] = useState([]);
  const [restaurantId, setRestaurantId] = useState("");
  const [menu, setMenu] = useState([]);
  const [selectedItems, setSelectedItems] = useState({});
  const [orderResponse, setOrderResponse] = useState(null);
  const [error, setError] = useState("");
  
  // Data for remaining tables
  const [customers, setCustomers] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [payments, setPayments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [addresses, setAddresses] = useState([]);

  // New feature states
  const [analytics, setAnalytics] = useState(null);
  const [deliveryMap, setDeliveryMap] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // Form states
  const [newRating, setNewRating] = useState({ restaurant_id: "", rating_value: 5, review_text: "" });
  const [newAddress, setNewAddress] = useState({ full_address: "", address_type: "Home" });

  const handleLogin = (userData) => {
    setUser(userData);
    setActiveTab(userData.role === "admin" ? "dashboard" : "order");
  };
  const handleLogout = () => setUser(null);

  useEffect(() => {
    if (!user) return;
    if (activeTab === "order" && restaurantId) {
      fetch(`${API_BASE}/restaurants/${restaurantId}/menu`)
        .then((res) => res.json())
        .then((data) => { setMenu(data); setSelectedCategory("All"); setSearchQuery(""); })
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
      const endpoint = user.role === "customer" ? `customers/${user.id}/addresses` : "addresses";
      fetchData(endpoint, setAddresses);
    } else if (activeTab === "dashboard") {
      fetchData("analytics", setAnalytics);
    } else if (activeTab === "map") {
      const endpoint = user.role === "customer" ? `customers/${user.id}/delivery-map` : "delivery-map";
      fetchData(endpoint, setDeliveryMap);
    }
  }, [activeTab, restaurantId, user]);

  useEffect(() => {
    fetch(`${API_BASE}/restaurants`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setRestaurants(data);
          if (data.length > 0 && !restaurantId) setRestaurantId(String(data[0].restaurant_id));
        } else {
          setError(data.message || "Failed to fetch restaurants");
        }
      })
      .catch((err) => setError(err.message));
  }, []);

  const fetchData = (endpoint, setter) => {
    fetch(`${API_BASE}/${endpoint}`)
      .then(res => res.json())
      .then(data => {
        // Allow arrays OR objects that aren't error messages
        if (Array.isArray(data) || (data && typeof data === 'object' && !data.message)) {
          setter(data);
        } else {
          console.error(`Invalid data from ${endpoint}:`, data);
          setter(Array.isArray(data) ? [] : null);
          if (data.message) setError(data.message);
        }
      })
      .catch(err => {
        setError(err.message);
        setter(null);
      });
  };

  const total = useMemo(() => {
    return Object.values(selectedItems).reduce((sum, item) => sum + item.subtotal, 0);
  }, [selectedItems]);

  // Get unique categories from current menu for filter pills
  const menuCategories = useMemo(() => {
    const cats = [...new Set(menu.map(item => item.category_name))];
    return ["All", ...cats];
  }, [menu]);

  // Filtered menu based on search + category
  const filteredMenu = useMemo(() => {
    return menu.filter(item => {
      const matchesSearch = !searchQuery || 
        item.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === "All" || item.category_name === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [menu, searchQuery, selectedCategory]);

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
        customer_id: user.id,
        restaurant_id: Number(restaurantId),
        delivery_address_id: 1, // Simplified for demo
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
      setSelectedItems({});
      setActiveTab("order");
    } catch (err) {
      setError(err.message);
    }
  };

  const submitRating = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/ratings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newRating, customer_id: user.id }),
      });
      if (!res.ok) throw new Error("Failed to submit rating");
      setNewRating({ restaurant_id: "", rating_value: 5, review_text: "" });
      fetchData("ratings", setRatings);
    } catch (err) { setError(err.message); }
  };

  const submitAddress = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/addresses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newAddress, customer_id: user.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to add address");
      setNewAddress({ full_address: "", address_type: "Home" });
      fetchData(`customers/${user.id}/addresses`, setAddresses);
    } catch (err) { setError(err.message); }
  };

  // ============ RENDER: ORDER TAB (with Search & Category Filtering) ============
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

      {/* Search Bar */}
      <div className="search-bar-container">
        <div className="search-bar">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search dishes... (e.g. Pizza, Biryani, Lassi)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          {searchQuery && (
            <button className="search-clear" onClick={() => setSearchQuery("")}>✕</button>
          )}
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="category-pills">
        {menuCategories.map(cat => (
          <button
            key={cat}
            className={`category-pill ${selectedCategory === cat ? 'active' : ''}`}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat === "All" ? "🍽️ All" : cat}
          </button>
        ))}
      </div>

      {/* Filtered Results Count */}
      {(searchQuery || selectedCategory !== "All") && (
        <div className="filter-info">
          Showing {filteredMenu.length} of {menu.length} items
          {searchQuery && <> matching "<strong>{searchQuery}</strong>"</>}
          {selectedCategory !== "All" && <> in <strong>{selectedCategory}</strong></>}
        </div>
      )}

      <div className="menu-grid">
        {filteredMenu.map((item) => (
          <div key={item.item_code} className="menu-card">
            <img 
              src={item.image_url || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c"} 
              alt={item.item_name} 
              className="menu-image"
            />
            <div className="menu-content">
              <span className="category-tag">{item.category_name}</span>
              <h3>{item.item_name}</h3>
              <p className="menu-description">{item.description}</p>
              <div className="menu-footer">
                <span className="price">₹{item.price}</span>
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
        {filteredMenu.length === 0 && (
          <div className="no-results">
            <span style={{fontSize: '3rem'}}>😕</span>
            <p>No dishes found. Try a different search or category.</p>
          </div>
        )}
      </div>

      {Object.keys(selectedItems).length > 0 && (
        <div className="checkout-section">
          <div>
            <h2 style={{margin: 0}}>Total: ₹{total.toFixed(2)}</h2>
            <p style={{margin: 0, opacity: 0.8}}>{Object.keys(selectedItems).length} items in cart</p>
          </div>
          <button className="checkout-btn" onClick={placeOrder}>Place Order</button>
        </div>
      )}

      {orderResponse && (
        <div className="success" style={{marginTop: '2rem'}}>
          Order #{orderResponse.order_id} placed! You can track it in the Live Map tab.
        </div>
      )}
    </>
  );

  // ============ RENDER: ANALYTICS DASHBOARD ============
  const renderDashboard = () => {
    if (!analytics) return <div className="loading-spinner">Loading analytics...</div>;

    const maxRevenue = analytics.top_restaurants?.length > 0
      ? Math.max(...analytics.top_restaurants.map(r => Number(r.revenue)))
      : 1;

    return (
      <div className="dashboard">
        {/* KPI Cards */}
        <div className="stats-grid">
          <div className="stat-card stat-revenue">
            <span className="stat-icon"></span>
            <span className="stat-value">₹{Number(analytics.total_revenue).toLocaleString()}</span>
            <span className="stat-label">Total Revenue</span>
          </div>
          <div className="stat-card stat-orders">
            <span className="stat-icon"></span>
            <span className="stat-value">{analytics.total_orders}</span>
            <span className="stat-label">Total Orders</span>
          </div>
          <div className="stat-card stat-customers">
            <span className="stat-icon"></span>
            <span className="stat-value">{analytics.total_customers}</span>
            <span className="stat-label">Customers</span>
          </div>
          <div className="stat-card stat-drivers">
            <span className="stat-icon"></span>
            <span className="stat-value">{analytics.total_drivers}</span>
            <span className="stat-label">Drivers</span>
          </div>
          <div className="stat-card stat-rating">
            <span className="stat-icon"></span>
            <span className="stat-value">{analytics.avg_rating || "N/A"}</span>
            <span className="stat-label">Avg Rating</span>
          </div>
        </div>

        {/* Order Status Distribution */}
        <div className="dashboard-row">
          <div className="dashboard-card">
            <h3>Order Status Distribution</h3>
            <div className="status-chart">
              {analytics.status_distribution?.map(s => {
                const total = analytics.status_distribution.reduce((sum, x) => sum + Number(x.count), 0);
                const pct = ((Number(s.count) / total) * 100).toFixed(0);
                const colors = {
                  delivered: '#2ed573', pending: '#ffa502', preparing: '#3742fa',
                  out_for_delivery: '#ff6348', confirmed: '#1e90ff', cancelled: '#ff4757', ready: '#7bed9f'
                };
                return (
                  <div key={s.status} className="status-bar-row">
                    <span className="status-bar-label">{s.status}</span>
                    <div className="status-bar-track">
                      <div
                        className="status-bar-fill"
                        style={{ width: `${pct}%`, background: colors[s.status] || '#747d8c' }}
                      />
                    </div>
                    <span className="status-bar-value">{s.count} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Restaurants by Revenue */}
          <div className="dashboard-card">
            <h3>Top Restaurants</h3>
            <div className="bar-chart">
              {analytics.top_restaurants?.map((r, i) => (
                <div key={r.name} className="bar-row">
                  <span className="bar-rank">#{i + 1}</span>
                  <span className="bar-name">{r.name}</span>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{ width: `${(Number(r.revenue) / maxRevenue) * 100}%` }}
                    />
                  </div>
                  <span className="bar-value">₹{Number(r.revenue).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top Selling Items */}
        <div className="dashboard-card" style={{marginTop: '1.5rem'}}>
          <h3>Top Selling Items</h3>
          <div className="top-items-grid">
            {analytics.top_items?.map((item, i) => (
              <div key={item.item_name} className="top-item-card">
                <span className="top-item-rank">#{i + 1}</span>
                <span className="top-item-name">{item.item_name}</span>
                <span className="top-item-sold">{item.total_sold} sold</span>
                <span className="top-item-revenue">₹{Number(item.revenue).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ============ RENDER: LIVE DELIVERY MAP ============
  const renderDeliveryMap = () => {
    if (!Array.isArray(deliveryMap) || deliveryMap.length === 0) {
      return <div className="no-results"><span style={{fontSize: '3rem'}}></span><p>No delivery data found.</p></div>;
    }

    const statusColors = {
      delivered: '#2ed573', assigned: '#3742fa', picked_up: '#ffa502',
      in_transit: '#ff6348', failed: '#ff4757', pending: '#747d8c',
      preparing: '#1e90ff', out_for_delivery: '#ff6348'
    };

    const getProgress = (status) => {
      const stages = { pending: 10, confirmed: 20, preparing: 35, assigned: 40, picked_up: 55, in_transit: 70, out_for_delivery: 80, ready: 85, delivered: 100, failed: 0, cancelled: 0 };
      return stages[status] || 0;
    };

    return (
      <div className="delivery-map">
        <div className="map-header">
          <h2>Live Delivery Simulation</h2>
          <p className="map-subtitle">Real-time tracking of all orders with restaurant & customer coordinates</p>
        </div>

        <div className="map-grid">
          {deliveryMap.map(order => {
            const progress = getProgress(order.delivery_status || order.order_status);
            const statusColor = statusColors[order.delivery_status || order.order_status] || '#747d8c';

            return (
              <div key={order.order_id} className="map-card">
                <div className="map-card-header" style={{ borderColor: statusColor }}>
                  <span className="map-order-id">Order #{order.order_id}</span>
                  <span className="map-status-badge" style={{ background: statusColor }}>
                    {order.delivery_status || order.order_status}
                  </span>
                </div>

                {/* Route Visualization */}
                <div className="route-visual">
                  <div className="route-point restaurant-point">
                    <span className="point-icon"></span>
                    <div className="point-details">
                      <strong>{order.restaurant_name}</strong>
                      <small>{order.res_address || 'N/A'}</small>
                      {order.res_lat && <small className="coords"> {Number(order.res_lat).toFixed(4)}, {Number(order.res_lng).toFixed(4)}</small>}
                    </div>
                  </div>

                  <div className="route-line-container">
                    <div className="route-line">
                      <div className="route-progress" style={{ width: `${progress}%`, background: statusColor }} />
                      <div className="route-driver-icon" style={{ left: `${Math.min(progress, 95)}%` }}>
                        {progress >= 100 ? '' : ''}
                      </div>
                    </div>
                    <span className="route-percent">{progress}%</span>
                  </div>

                  <div className="route-point customer-point">
                    <span className="point-icon"></span>
                    <div className="point-details">
                      <strong>{order.customer_name}</strong>
                      <small>{order.cus_address || 'N/A'}</small>
                      {order.cus_lat && <small className="coords"> {Number(order.cus_lat).toFixed(4)}, {Number(order.cus_lng).toFixed(4)}</small>}
                    </div>
                  </div>
                </div>

                {/* Driver Info */}
                <div className="map-driver-info">
                  <span> {order.driver_name || 'Not Assigned'}</span>
                  {order.driver_phone && <span> {order.driver_phone}</span>}
                  <span> ₹{Number(order.amount).toLocaleString()}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="map-legend">
          <h4>Status Legend</h4>
          <div className="legend-items">
            {Object.entries(statusColors).map(([status, color]) => (
              <span key={status} className="legend-item">
                <span className="legend-dot" style={{background: color}} />
                {status}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ============ RENDER: TABLE ============
  const renderTable = (headers, rows, keyField) => {
    if (!Array.isArray(rows)) return <div className="error">Invalid data format</div>;
    if (rows.length === 0) return <div className="no-results"><p>No records found.</p></div>;

    return (
      <div className="table-container">
        <table>
          <thead>
            <tr>{headers.map(h => <th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row[keyField]}>
                {headers.map(h => {
                  const fieldKey = h.toLowerCase().replace(/ /g, '_');
                  const val = row[fieldKey];
                  if (h.toLowerCase() === 'status') {
                     return <td key={h}><span className={`status-badge status-${val}`}>{val}</span></td>;
                  }
                  return <td key={h}>{String(val !== undefined && val !== null ? val : 'N/A')}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  if (!user) return <LoginPage onLogin={handleLogin} />;

  return (
    <div className="container">
      <header>
        <div className="header-top">
          <h1>FoodieHub</h1>
          <div className="user-info">
            <span>Welcome, <strong>{user.fullname}</strong> ({user.role})</span>
            <button className="logout-btn" onClick={handleLogout}>Logout</button>
          </div>
        </div>
        <p>Advanced Management System for Food Delivery</p>
      </header>

      <div className="nav-tabs">
        {user.role === 'admin' && <button className={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>Dashboard</button>}
        
        <button className={`nav-tab ${activeTab === 'order' ? 'active' : ''}`} onClick={() => setActiveTab('order')}>{user.role === 'admin' ? 'Menu Preview' : 'Order Food'}</button>
        
        <button className={`nav-tab ${activeTab === 'map' ? 'active' : ''}`} onClick={() => setActiveTab('map')}>Live Map</button>
        <button className={`nav-tab ${activeTab === 'restaurants' ? 'active' : ''}`} onClick={() => setActiveTab('restaurants')}>Restaurants</button>
        
        {user.role === 'admin' && <button className={`nav-tab ${activeTab === 'drivers' ? 'active' : ''}`} onClick={() => setActiveTab('drivers')}>Drivers</button>}
        
        <button className={`nav-tab ${activeTab === 'ratings' ? 'active' : ''}`} onClick={() => setActiveTab('ratings')}>Ratings</button>
        
        {user.role === 'admin' && <button className={`nav-tab ${activeTab === 'payments' ? 'active' : ''}`} onClick={() => setActiveTab('payments')}>Payments</button>}
        {user.role === 'admin' && <button className={`nav-tab ${activeTab === 'categories' ? 'active' : ''}`} onClick={() => setActiveTab('categories')}>Categories</button>}
        
        <button className={`nav-tab ${activeTab === 'addresses' ? 'active' : ''}`} onClick={() => setActiveTab('addresses')}>Addresses</button>
        
        {user.role === 'admin' && <button className={`nav-tab ${activeTab === 'customers' ? 'active' : ''}`} onClick={() => setActiveTab('customers')}>Customers</button>}
        {user.role === 'admin' && <button className={`nav-tab ${activeTab === 'admins' ? 'active' : ''}`} onClick={() => setActiveTab('admins')}>Admins</button>}
      </div>

      {error && <div className="error" style={{marginBottom: '2rem'}}>{error}</div>}

      <main>
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'order' && renderOrderTab()}
        {activeTab === 'map' && renderDeliveryMap()}
        {activeTab === 'restaurants' && renderTable(['Restaurant ID', 'Name', 'Address', 'Phone No'], restaurants, 'restaurant_id')}
        {activeTab === 'customers' && renderTable(['Customer ID', 'Name', 'Email', 'Phone No', 'Created At'], customers, 'customer_id')}
        {activeTab === 'drivers' && renderTable(['Driver ID', 'Name', 'Phone No', 'Status', 'Updated At'], drivers, 'driver_id')}
        {activeTab === 'admins' && renderTable(['Admin ID', 'Name', 'Created At'], admins, 'admin_id')}
        {activeTab === 'ratings' && (
          <>
            {user.role === 'customer' && (
              <form className="card" onSubmit={submitRating} style={{marginBottom: '2rem'}}>
                <h3>Rate a Restaurant</h3>
                <div style={{display: 'flex', gap: '1rem', marginBottom: '1rem'}}>
                  <select 
                    value={newRating.restaurant_id} 
                    onChange={e => setNewRating({...newRating, restaurant_id: e.target.value})}
                    required
                  >
                    <option value="">Select Restaurant</option>
                    {restaurants.map(r => <option key={r.restaurant_id} value={r.restaurant_id}>{r.name}</option>)}
                  </select>
                  <input 
                    type="number" min="1" max="5" 
                    value={newRating.rating_value} 
                    onChange={e => setNewRating({...newRating, rating_value: e.target.value})}
                    style={{width: '80px'}}
                  />
                </div>
                <textarea 
                  className="input-field" 
                  placeholder="Tell us about your experience..."
                  value={newRating.review_text}
                  onChange={e => setNewRating({...newRating, review_text: e.target.value})}
                  style={{marginBottom: '1rem', minHeight: '80px'}}
                ></textarea>
                <button type="submit" className="btn-add">Submit Review</button>
              </form>
            )}
            {renderTable(['Rating ID', 'Customer Name', 'Restaurant Name', 'Rating Value', 'Review Text'], ratings, 'rating_id')}
          </>
        )}
        {activeTab === 'payments' && renderTable(['Payment ID', 'Order ID', 'Amount', 'Mode', 'Status', 'Time'], payments, 'payment_id')}
        {activeTab === 'categories' && renderTable(['Category ID', 'Restaurant Name', 'Name', 'Created At'], categories, 'category_id')}
        {activeTab === 'addresses' && (
          <>
            {user.role === 'customer' && (
              <form className="card" onSubmit={submitAddress} style={{marginBottom: '2rem'}}>
                <h3>Add New Address</h3>
                <div style={{display: 'flex', gap: '1rem'}}>
                  <input 
                    className="input-field" 
                    placeholder="Enter full address..."
                    value={newAddress.full_address}
                    onChange={e => setNewAddress({...newAddress, full_address: e.target.value})}
                    required
                  />
                  <select 
                    value={newAddress.address_type} 
                    onChange={e => setNewAddress({...newAddress, address_type: e.target.value})}
                    style={{width: '150px'}}
                  >
                    <option value="Home">Home</option>
                    <option value="Work">Work</option>
                    <option value="Other">Other</option>
                  </select>
                  <button type="submit" className="btn-add">Add</button>
                </div>
              </form>
            )}
            {renderTable(['Customer Name', 'Full Address', 'Address Type', 'Is Default'], addresses, 'address_id')}
          </>
        )}
      </main>
    </div>
  );
}
