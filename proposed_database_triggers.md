# Proposed Database Triggers

Adding these triggers to your `init.sql` file will help automate business logic directly at the database level, ensuring data integrity and reducing the need for repetitive backend code.

## 1. Auto-update Driver Status
Automatically manages driver availability based on delivery assignments.

```sql
CREATE OR REPLACE FUNCTION update_driver_status()
RETURNS TRIGGER AS $$
BEGIN
    -- If assigned or in transit, mark driver as busy
    IF NEW.status IN ('assigned', 'picked_up', 'in_transit') THEN
        UPDATE DRIVER SET status = 'busy' WHERE driver_id = NEW.driver_id;
    -- If delivered or failed, mark driver as available
    ELSIF NEW.status IN ('delivered', 'failed') THEN
        UPDATE DRIVER SET status = 'available' WHERE driver_id = NEW.driver_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_driver_status
AFTER INSERT OR UPDATE OF status ON DELIVERY_STATUS
FOR EACH ROW EXECUTE FUNCTION update_driver_status();
```

## 2. Auto-set Actual Delivery Time
Automatically records the exact timestamp when a delivery is marked as completed.

```sql
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
```

## 3. Auto-sync Order Details Status
Keeps the parent order's status perfectly synchronized with the delivery status.

```sql
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
```

## 4. Auto-populate PLACES Table
Since `PLACES` links `customer_id` and `order_id`, this trigger ensures a record is automatically created every time an order is placed.

```sql
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
```

## 5. Auto-calculate Total Order Amount
Instead of calculating the total in your backend, the database dynamically updates `ORDER_DETAILS.amount` whenever an item is added, updated, or removed from `ORDERS`.

```sql
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
```

> [!TIP]
> If you choose to add these to `init.sql`, place them right after your existing `updated_at` triggers and before your View definitions!
