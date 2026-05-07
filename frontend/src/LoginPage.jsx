import { useState } from "react";

const API_BASE = "http://localhost:5000/api";

export default function LoginPage({ onLogin }) {
  const [role, setRole] = useState("customer");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const url = role === "customer" ? `${API_BASE}/login/customer` : `${API_BASE}/login/admin`;
      const body = role === "customer" ? { email, password } : { name, password };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Login failed");
      onLogin(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg-shapes">
        <div className="shape shape-1" />
        <div className="shape shape-2" />
        <div className="shape shape-3" />
      </div>

      <div className="login-card">
        <div className="login-header">
          <h1 className="login-logo">🍔 FoodieHub</h1>
          <p className="login-subtitle">Sign in to manage your food delivery</p>
        </div>

        {/* Role Toggle */}
        <div className="role-toggle">
          <button
            className={`role-btn ${role === "customer" ? "active" : ""}`}
            onClick={() => { setRole("customer"); setError(""); }}
          >
            👤 Customer
          </button>
          <button
            className={`role-btn ${role === "admin" ? "active" : ""}`}
            onClick={() => { setRole("admin"); setError(""); }}
          >
            🔑 Admin
          </button>
        </div>

        <form onSubmit={handleLogin} className="login-form">
          {role === "customer" ? (
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                placeholder="vandit@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          ) : (
            <div className="form-group">
              <label>Admin Name</label>
              <input
                type="text"
                placeholder="System Admin"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="login-hint">
          <p><strong>Demo Credentials:</strong></p>
          {role === "customer" ? (
            <p>Email: <code>vandit@example.com</code> | Password: <code>1234</code></p>
          ) : (
            <p>Name: <code>System Admin</code> | Password: <code>4321</code></p>
          )}
        </div>
      </div>
    </div>
  );
}
