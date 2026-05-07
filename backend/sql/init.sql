-- 1. SCHEMA DEFINITION

DROP TABLE IF EXISTS DRIVER_LOCATION CASCADE;
DROP TABLE IF EXISTS DELIVERY_STATUS CASCADE;
DROP TABLE IF EXISTS PAYMENT_DETAILS CASCADE;
DROP TABLE IF EXISTS ORDERS CASCADE;
DROP TABLE IF EXISTS PLACES CASCADE;
DROP TABLE IF EXISTS ORDER_DETAILS CASCADE;
DROP TABLE IF EXISTS MENU_ITEM CASCADE;
DROP TABLE IF EXISTS CATEGORY CASCADE;
DROP TABLE IF EXISTS RATING CASCADE;
DROP TABLE IF EXISTS CUSTOMER_ADDRESS CASCADE;
DROP TABLE IF EXISTS RESTAURANT_LOCATION CASCADE;
DROP TABLE IF EXISTS DRIVER CASCADE;
DROP TABLE IF EXISTS RESTAURANT CASCADE;
DROP TABLE IF EXISTS ADMIN CASCADE;
DROP TABLE IF EXISTS CUSTOMER CASCADE;

DROP TYPE IF EXISTS driver_status_type CASCADE;
DROP TYPE IF EXISTS address_type CASCADE;
DROP TYPE IF EXISTS order_status_type CASCADE;
DROP TYPE IF EXISTS delivery_status_type CASCADE;
DROP TYPE IF EXISTS payment_mode_type CASCADE;
DROP TYPE IF EXISTS payment_status_type CASCADE;

CREATE TYPE driver_status_type AS ENUM ('available', 'busy', 'offline');
CREATE TYPE address_type AS ENUM ('Home', 'Work', 'Other');
CREATE TYPE order_status_type AS ENUM ('pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled');
CREATE TYPE delivery_status_type AS ENUM ('assigned', 'picked_up', 'in_transit', 'delivered', 'failed');
CREATE TYPE payment_mode_type AS ENUM ('cash', 'card', 'upi', 'wallet');
CREATE TYPE payment_status_type AS ENUM ('pending', 'completed', 'failed', 'refunded');

CREATE TABLE CUSTOMER (
    customer_id SERIAL PRIMARY KEY,
    Firstname VARCHAR(50) NOT NULL,
    Lastname VARCHAR(50) NOT NULL,
    Name VARCHAR(100) NOT NULL,
    Address TEXT,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone_no VARCHAR(15),
    Password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ADMIN (
    Admin_id SERIAL PRIMARY KEY,
    Name VARCHAR(100) NOT NULL,
    Password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE RESTAURANT (
    restaurant_id SERIAL PRIMARY KEY,
    Name VARCHAR(100) NOT NULL,
    Address TEXT NOT NULL,
    phone_no VARCHAR(15),
    Password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE DRIVER (
    driver_id SERIAL PRIMARY KEY,
    Name VARCHAR(100) NOT NULL,
    phone_no VARCHAR(15) NOT NULL,
    status driver_status_type DEFAULT 'offline',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE RESTAURANT_LOCATION (
    location_id SERIAL PRIMARY KEY,
    restaurant_id INTEGER NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    full_address TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES RESTAURANT(restaurant_id) ON DELETE CASCADE
);

CREATE TABLE CUSTOMER_ADDRESS (
    address_id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    full_address TEXT NOT NULL,
    address_type address_type DEFAULT 'Home',
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES CUSTOMER(customer_id) ON DELETE CASCADE
);

CREATE TABLE RATING (
    rating_id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    restaurant_id INTEGER NOT NULL,
    admin_id INTEGER,
    rating_value INTEGER CHECK (rating_value BETWEEN 1 AND 5),
    review_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES CUSTOMER(customer_id) ON DELETE CASCADE,
    FOREIGN KEY (restaurant_id) REFERENCES RESTAURANT(restaurant_id) ON DELETE CASCADE,
    FOREIGN KEY (admin_id) REFERENCES ADMIN(Admin_id) ON DELETE SET NULL
);

CREATE TABLE CATEGORY (
    Category_id SERIAL PRIMARY KEY,
    restaurant_id INTEGER NOT NULL,
    Name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES RESTAURANT(restaurant_id) ON DELETE CASCADE
);

CREATE TABLE MENU_ITEM (
    item_code SERIAL PRIMARY KEY,
    Category_id INTEGER NOT NULL,
    item_name VARCHAR(100) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    description TEXT,
    image_url TEXT,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (Category_id) REFERENCES CATEGORY(Category_id) ON DELETE CASCADE
);

CREATE TABLE ORDER_DETAILS (
    order_id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    restaurant_id INTEGER NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status order_status_type DEFAULT 'pending',
    delivery_address_id INTEGER,
    FOREIGN KEY (customer_id) REFERENCES CUSTOMER(customer_id) ON DELETE CASCADE,
    FOREIGN KEY (restaurant_id) REFERENCES RESTAURANT(restaurant_id) ON DELETE CASCADE,
    FOREIGN KEY (delivery_address_id) REFERENCES CUSTOMER_ADDRESS(address_id) ON DELETE SET NULL
);

CREATE TABLE PLACES (
    customer_id INTEGER NOT NULL,
    order_id INTEGER NOT NULL,
    placed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (customer_id, order_id),
    FOREIGN KEY (customer_id) REFERENCES CUSTOMER(customer_id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES ORDER_DETAILS(order_id) ON DELETE CASCADE
);

CREATE TABLE ORDERS (
    order_item_id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL,
    item_code INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    item_price DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES ORDER_DETAILS(order_id) ON DELETE CASCADE,
    FOREIGN KEY (item_code) REFERENCES MENU_ITEM(item_code) ON DELETE CASCADE
);

CREATE TABLE DELIVERY_STATUS (
    Delivery_id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL UNIQUE,
    driver_id INTEGER,
    delivery_address TEXT NOT NULL,
    status delivery_status_type DEFAULT 'assigned',
    estimated_time TIMESTAMP,
    actual_delivery_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES ORDER_DETAILS(order_id) ON DELETE CASCADE,
    FOREIGN KEY (driver_id) REFERENCES DRIVER(driver_id) ON DELETE SET NULL
);

CREATE TABLE DRIVER_LOCATION (
    location_id SERIAL PRIMARY KEY,
    driver_id INTEGER NOT NULL,
    delivery_id INTEGER,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (driver_id) REFERENCES DRIVER(driver_id) ON DELETE CASCADE,
    FOREIGN KEY (delivery_id) REFERENCES DELIVERY_STATUS(Delivery_id) ON DELETE SET NULL
);

CREATE TABLE PAYMENT_DETAILS (
    payment_id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL UNIQUE,
    Category_id INTEGER,
    amount DECIMAL(10, 2) NOT NULL,
    time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    mode payment_mode_type NOT NULL,
    transaction_id VARCHAR(100),
    status payment_status_type DEFAULT 'pending',
    FOREIGN KEY (order_id) REFERENCES ORDER_DETAILS(order_id) ON DELETE CASCADE,
    FOREIGN KEY (Category_id) REFERENCES CATEGORY(Category_id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX idx_customer_email ON CUSTOMER(email);
CREATE INDEX idx_restaurant_name ON RESTAURANT(Name);
CREATE INDEX idx_order_status ON ORDER_DETAILS(status);
CREATE INDEX idx_driver_status ON DRIVER(status);
CREATE INDEX idx_delivery_status ON DELIVERY_STATUS(status);
CREATE INDEX idx_menu_item_category ON MENU_ITEM(Category_id);
CREATE INDEX idx_rating_restaurant ON RATING(restaurant_id);
CREATE INDEX idx_driver_timestamp ON DRIVER_LOCATION(driver_id, timestamp);
CREATE INDEX idx_delivery_timestamp ON DRIVER_LOCATION(delivery_id, timestamp);

-- Triggers & Functions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_customer_updated_at BEFORE UPDATE ON CUSTOMER
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_restaurant_updated_at BEFORE UPDATE ON RESTAURANT
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_driver_updated_at BEFORE UPDATE ON DRIVER
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customer_address_updated_at BEFORE UPDATE ON CUSTOMER_ADDRESS
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_menu_item_updated_at BEFORE UPDATE ON MENU_ITEM
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_delivery_status_updated_at BEFORE UPDATE ON DELIVERY_STATUS
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Business Logic Triggers

-- 1. Auto-update Driver Status
CREATE OR REPLACE FUNCTION update_driver_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IN ('assigned', 'picked_up', 'in_transit') THEN
        UPDATE DRIVER SET status = 'busy' WHERE driver_id = NEW.driver_id;
    ELSIF NEW.status IN ('delivered', 'failed') THEN
        UPDATE DRIVER SET status = 'available' WHERE driver_id = NEW.driver_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_driver_status
AFTER INSERT OR UPDATE OF status ON DELIVERY_STATUS
FOR EACH ROW EXECUTE FUNCTION update_driver_status();

-- 2. Auto-set Actual Delivery Time
CREATE OR REPLACE FUNCTION set_actual_delivery_time()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'delivered' AND OLD.status IS DISTINCT FROM 'delivered' THEN
        NEW.actual_delivery_time = CURRENT_TIMESTAMP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_actual_delivery_time
BEFORE UPDATE OF status ON DELIVERY_STATUS
FOR EACH ROW EXECUTE FUNCTION set_actual_delivery_time();

-- 3. Auto-sync Order Details Status
CREATE OR REPLACE FUNCTION sync_order_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'delivered' THEN
        UPDATE ORDER_DETAILS SET status = 'delivered' WHERE order_id = NEW.order_id;
    ELSIF NEW.status = 'failed' THEN
        UPDATE ORDER_DETAILS SET status = 'cancelled' WHERE order_id = NEW.order_id;
    ELSIF NEW.status = 'in_transit' THEN
        UPDATE ORDER_DETAILS SET status = 'out_for_delivery' WHERE order_id = NEW.order_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_order_status
AFTER UPDATE OF status ON DELIVERY_STATUS
FOR EACH ROW EXECUTE FUNCTION sync_order_status();

-- 4. Auto-populate PLACES Table
CREATE OR REPLACE FUNCTION populate_places_table()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO PLACES (customer_id, order_id) 
    VALUES (NEW.customer_id, NEW.order_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_populate_places
AFTER INSERT ON ORDER_DETAILS
FOR EACH ROW EXECUTE FUNCTION populate_places_table();

-- 5. Auto-calculate Total Order Amount
CREATE OR REPLACE FUNCTION update_order_total_amount()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        UPDATE ORDER_DETAILS 
        SET amount = (SELECT COALESCE(SUM(subtotal), 0) FROM ORDERS WHERE order_id = OLD.order_id)
        WHERE order_id = OLD.order_id;
        RETURN OLD;
    ELSE
        UPDATE ORDER_DETAILS 
        SET amount = (SELECT COALESCE(SUM(subtotal), 0) FROM ORDERS WHERE order_id = NEW.order_id)
        WHERE order_id = NEW.order_id;
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_order_amount
AFTER INSERT OR UPDATE OR DELETE ON ORDERS
FOR EACH ROW EXECUTE FUNCTION update_order_total_amount();

-- Views
CREATE OR REPLACE VIEW v_delivery_tracking AS
SELECT
    od.order_id,
    c.Name as customer_name,
    c.phone_no as customer_phone,
    ca.latitude as customer_lat,
    ca.longitude as customer_lng,
    ca.full_address as customer_address,
    r.Name as restaurant_name,
    rl.latitude as restaurant_lat,
    rl.longitude as restaurant_lng,
    rl.full_address as restaurant_address,
    d.Name as driver_name,
    d.phone_no as driver_phone,
    ds.status as delivery_status,
    ds.estimated_time,
    od.status as order_status,
    od.amount
FROM ORDER_DETAILS od
JOIN CUSTOMER c ON od.customer_id = c.customer_id
JOIN CUSTOMER_ADDRESS ca ON od.delivery_address_id = ca.address_id
JOIN RESTAURANT r ON od.restaurant_id = r.restaurant_id
JOIN RESTAURANT_LOCATION rl ON r.restaurant_id = rl.restaurant_id
LEFT JOIN DELIVERY_STATUS ds ON od.order_id = ds.order_id
LEFT JOIN DRIVER d ON ds.driver_id = d.driver_id
WHERE od.status IN ('confirmed', 'preparing', 'ready', 'out_for_delivery');

-- Helper Functions
CREATE OR REPLACE FUNCTION get_latest_driver_location(p_delivery_id INTEGER)
RETURNS TABLE (
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    last_updated TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT dl.latitude, dl.longitude, dl.timestamp
    FROM DRIVER_LOCATION dl
    WHERE dl.delivery_id = p_delivery_id
    ORDER BY dl.timestamp DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE CUSTOMER IS 'Stores customer information and authentication details';
COMMENT ON TABLE RESTAURANT IS 'Stores restaurant information';
COMMENT ON TABLE DRIVER IS 'Stores driver information - no vehicle details, only location tracking';
COMMENT ON TABLE DRIVER_LOCATION IS 'Real-time driver location tracking - updates every 5-7 seconds';
COMMENT ON TABLE RESTAURANT_LOCATION IS 'Fixed location coordinates for restaurants';
COMMENT ON TABLE CUSTOMER_ADDRESS IS 'Customer delivery addresses with coordinates for mapping';
COMMENT ON TABLE ORDER_DETAILS IS 'Main order information';
COMMENT ON TABLE DELIVERY_STATUS IS 'Tracks delivery progress and driver assignment';

-- 2. SEED DATA

-- Admin User
INSERT INTO ADMIN (Name, Password) VALUES
('System Admin', '4321');

-- Professional Restaurants
INSERT INTO RESTAURANT (Name, Address, phone_no, Password) VALUES
('Nagpal Fine Dine', 'Bhupindra Road,Patiala', '9876543001', '$2y$10$samplehash'),
('The Delicious Corner', 'Model Town, Patiala', '9876543002', '$2y$10$samplehash'),
('The Good Bowl', 'SCO 3, Bhupindra Road, Model Town, Patiala', '9876543003', '$2y$10$samplehash'),
('Burger Singh', 'London Street, Patiala', '9876543004', '$2y$10$samplehash'),
('Moti Mahal', 'Kravings,Thapar University,Patiala', '9876543005', '$2y$10$samplehash');

-- Categories
INSERT INTO CATEGORY (restaurant_id, Name) VALUES
(1, 'Fresh Tandoori Pizza'), (1, 'North Indian Meals'), (1, 'Traditional Sweets'),
(2, 'Indo-Chinese'), (2, 'Maggi & Noodles'), (2, 'Evening Snacks'),
(3, 'Healthy Bowls'), (3, 'Fresh Juices'), (3, 'Healthy Wraps'),
(4, 'Desi Burgers'), (4, 'Sides & Snacks'), (4, 'Lassi & Shakes'),
(5, 'Tandoori Specials'), (5, 'Biryani & Rice'), (5, 'Breads');

-- Menu Items
INSERT INTO MENU_ITEM (Category_id, item_name, price, description, image_url) VALUES
(1, 'Paneer Tikka Pizza', 350.00, 'Freshly baked pizza topped with marinated paneer and Indian spices.', '/images/paneer_tikka_pizza.png'),
(1, 'Masala Cheese Corn Pizza', 350.00, 'Cheesy pizza with sweet corn, onions, and a touch of Indian masala.', '/images/masala_cheese_corn_pizza.png'),
(2, 'Dal Makhani with Jeera Rice', 280.00, 'Creamy slow-cooked black lentils served with aromatic cumin rice.', '/images/dal_makhani_jeera_rice.png'),
(3, 'Gulab Jamun with Rabri', 220.00, 'Soft gulab jamuns served with thick, creamy sweetened milk.', '/images/gulab_jamun_rabri.png'),
(4, 'Veg Manchurian Dry', 250.00, 'Mixed veg balls tossed in a spicy and tangy Indo-Chinese sauce.', '/images/veg_manchurian.png'),
(4, 'Paneer Pakora Plate', 100.00, 'Crispy gram flour battered paneer fritters served with mint chutney.', '/images/paneer_pakora_plate.png'),
(5, 'Masala Maggi Special', 100.00, 'The classic comfort food with extra vegetables and secret spices.', '/images/masala_maggi_special.png'),
(7, 'Masala Khichdi Bowl', 200.00, 'Nutritious lentil and rice porridge with tempering of ghee and spices.', '/images/masala_khichdi_bowl.png'),
(8, 'Fresh Nimbu Pani', 75.00, 'Refreshing lemonade with mint and roasted cumin powder.', '/images/fresh_nimbu_pani.png'),
(10, 'Aloo Tikki Supreme Burger', 250.00, 'Crispy potato patty with spicy mayo and fresh vegetables.', '/images/aloo_tikki_burger.png'),
(11, 'Masala Peri Peri Fries', 150.00, 'Golden crispy fries tossed in a spicy peri peri and Indian masala mix.', '/images/masala_peri_peri_fries.png'),
(12, 'Kesar Pista Lassi', 150.00, 'Traditional sweet yogurt drink with saffron and pistachios.', '/images/kesar_pista_lassi.png'),
(13, 'Mutton Rogan Josh', 460.00, 'Slow-cooked Kashmiri mutton in a rich tomato and ginger gravy.', '/images/mutton_rogan_josh.png'),
(14, 'Hyderabadi Chicken Biryani', 420.00, 'Fragrant long-grain basmati rice layered with spiced chicken and saffron.', '/images/hyderabadi_chicken_biryani.png'),
(15, 'Garlic Butter Naan', 60.00, 'Soft, clay-oven baked bread brushed with fresh garlic and butter.', '/images/garlic_butter_naan.png');

-- Drivers
INSERT INTO DRIVER (Name, phone_no, status) VALUES
('Arjun Khanna', '9988776655', 'available'),
('Sneha Kapoor', '9988776654', 'busy'),
('Deepak Verma', '9988776653', 'available'),
('Meera Sharma', '9988776652', 'offline'),
('Karan Malhotra', '9988776651', 'available');

-- Locations
INSERT INTO RESTAURANT_LOCATION (restaurant_id, latitude, longitude, full_address) VALUES
(1, 30.334060, 76.388830, 'Bhupindra Road,Patiala'),
(2, 30.336160, 76.389230, 'Model Town, Patiala'),
(3, 30.315060, 76.415030, 'SCO 3, Bhupindra Road, Model Town, Patiala'),
(4, 30.339260, 76.381230, 'London Street, Patiala'),
(5, 30.342060, 76.383030, 'Kravings,Thapar University,Patiala');

-- Customers
INSERT INTO CUSTOMER (Firstname, Lastname, Name, email, phone_no, Password) VALUES
('Vandit', 'Gupta', 'Vandit Gupta', 'vandit@example.com', '9000000001', '1234'),
('Sambhav', 'Jain', 'Sambhav Jain', 'sambhav@example.com', '9000000003', '1234'),
('Abhinav', 'Sharda', 'Abhinav Sharda', 'abhinav@example.com', '9000000004', '1234');

-- Customer Addresses
INSERT INTO CUSTOMER_ADDRESS (customer_id, full_address, latitude, longitude, address_type, is_default) VALUES
(1, 'Hostel D, Thapar University, Patiala', 30.3585, 76.3653, 'Home', TRUE),
(2, 'Hostel C, Thapar University, Patiala', 30.3400, 76.3800, 'Work', FALSE),
(3, 'Hostel B, Thapar University, Patiala', 30.3600, 76.3700, 'Home', TRUE);

-- Initial Orders
INSERT INTO ORDER_DETAILS (customer_id, restaurant_id, amount, status, delivery_address_id) VALUES
(1, 1, 850.00, 'delivered', 1),
(2, 2, 350.00, 'out_for_delivery', 3),
(3, 4, 540.00, 'preparing', 1),
(1, 5, 940.00, 'pending', 1);

    
INSERT INTO ORDERS (order_id, item_code, quantity, item_price, subtotal) VALUES
(1, 1, 2, 350.00, 700.00), (1, 11, 1, 150.00, 150.00),
(2, 5, 1, 250.00, 250.00), (2, 6, 1, 100.00, 100.00);

-- Delivery Status
INSERT INTO DELIVERY_STATUS (order_id, driver_id, delivery_address, status, estimated_time, actual_delivery_time) VALUES
(1, 1, 'Hostel D, Thapar University, Patiala', 'delivered', CURRENT_TIMESTAMP - INTERVAL '30 minutes', CURRENT_TIMESTAMP - INTERVAL '10 minutes'),
(2, 3, 'Hostel B, Thapar University, Patiala', 'in_transit', CURRENT_TIMESTAMP + INTERVAL '15 minutes', NULL),
(3, 5, 'Hostel D, Thapar University, Patiala', 'assigned', CURRENT_TIMESTAMP + INTERVAL '30 minutes', NULL);

-- Reviews
INSERT INTO RATING (customer_id, restaurant_id, rating_value, review_text) VALUES
(1, 1, 5, 'Best Paneer Pizza in town! The crust is so airy and fresh.'),
(2, 2, 4, 'Food was fresh, but the delivery took slightly longer than expected.'),
(3, 3, 5, 'Perfect for a healthy lunch. The Khichdi bowl is filling and tasty.'),
(1, 4, 3, 'Burger was good, but fries were a bit cold on arrival.'),
(2, 5, 5, 'Authentic spices. The Biryani reminds me of home!');

-- Login Functions
CREATE OR REPLACE FUNCTION login_customer(p_email VARCHAR, p_password VARCHAR)
RETURNS TABLE(id INTEGER, fullname VARCHAR, user_email VARCHAR) AS $$
BEGIN
    RETURN QUERY
    SELECT c.customer_id, c.name, c.email
    FROM CUSTOMER c
    WHERE c.email = p_email AND c.password = p_password;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION login_admin(p_name VARCHAR, p_password VARCHAR)
RETURNS TABLE(id INTEGER, fullname VARCHAR) AS $$
BEGIN
    RETURN QUERY
    SELECT a.admin_id, a.name
    FROM ADMIN a
    WHERE a.name = p_name AND a.password = p_password;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION login_customer IS 'Authenticates a customer by email and password';
COMMENT ON FUNCTION login_admin IS 'Authenticates an admin by name and password';
