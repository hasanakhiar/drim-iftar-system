# IUT Cafeteria Iftar System

A professional, distributed, and fault-tolerant microservices system designed to handle the high-load Ramadan rush for IUT cafeteria ordering.

## System Architecture

The system is built using a modern microservices architecture, ensuring that failures in one service do not compromise the entire student experience.

- **Identity Provider (Port 3001)**: Single source of truth for student authentication; issues JWT tokens.
- **Order Gateway (Port 3002)**: Primary entry point; performs token validation and proxies stock checks. Persists all orders to MongoDB.
- **Stock Service (Port 3003)**: Manages inventory with optimistic locking to prevent over-selling.
- **Kitchen Queue (Port 3004)**: Asynchronously processes orders, decoupling user feedback from time-intensive food preparation.
- **Notification Hub (Port 3005)**: Bridges RabbitMQ updates to real-time Socket.io events and synchronizes final status to the database.

## Key Features

### Chaos Engineering & Resilience
- **Killswitch System**: Admins can terminate any service to simulate outages.
- **Ghost-Free Reconnection**: Services strictly manage reconnection timers to honor the killswitch without background ghost reconnections.
- **Message Durability**: Uses RabbitMQ with message re-queueing on failure to ensure zero-loss order processing.

### Student Portal
- **Real-time Tracking**: Watch your order transition from Confirmed to Stock Verified to In Kitchen to Ready.
- **Global Outage Banner**: Immediate warning if the Notification Hub is offline before you order.
- **Order History**: Personal order history with advanced pagination and direct tracking recovery.
- **Professional UI**: Dark/Light mode support, custom quantity selectors, and elegant animated modals.

### Admin Monitoring Dashboard
- **System Dashboard**: Live health grid and labeled performance metrics for all services.
- **Inventory Management**: Create, edit, or delete food items with real-time stock updates.
- **Student Management**: Register new students and monitor individual activity/order counts.
- **Advanced Pagination**: Optimized for large datasets with Jump 10 and Skip to End controls.

## Getting Started

### Prerequisites
- Docker & Docker Compose

### Installation & Run
1. Clone the repository.
2. Run the full stack with a single command:
   ```bash
   docker-compose up --build -d
   ```

### Access Ports
- **Student Portal**: [http://localhost:5173](http://localhost:5173)
- **Admin Dashboard**: [http://localhost:5174](http://localhost:5174)

### Default Credentials
- **Student ID**: STU001
- **Password**: password123

## Technologies Used
- **Backend**: Node.js, Express, MongoDB, Redis, RabbitMQ
- **Frontend**: React (Vite), Socket.io-client, Axios
- **DevOps**: Docker, Docker Compose
