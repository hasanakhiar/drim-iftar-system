# Technical Architecture: Iftar Microservices System

This document provides a detailed overview of the system design, component interactions, and overall architecture of the Iftar System.

---

## 1. Architectural Overview

The system is designed as a decoupled, event-driven microservices architecture. This approach ensures high availability, scalability, and resilience during the intense Ramadan peak load.

### 1.1 Core Components

| Component | Role | Technology |
| :--- | :--- | :--- |
| API Gateway | Primary Entry Point | Node.js, Express |
| Identity Provider | Auth & Authz | MongoDB, JWT, Bcrypt |
| Stock Service | Inventory Control | MongoDB, Redis (Cache) |
| Kitchen Queue | Async Processing | RabbitMQ, Node.js |
| Notification Hub | Real-time Updates | Socket.io, RabbitMQ |
| Message Broker | Communication Backbone | RabbitMQ |

---

## 2. Component Interactions

### 2.1 Synchronous Flow (HTTP)
Used for immediate user actions where low latency is critical:
- Authentication: Student UI to Identity Provider (JWT issuance).
- Order Submission: Student UI to Order Gateway (Initial validation).
- Inventory Display: Student UI to Order Gateway (Proxy to Stock Service cache).

### 2.2 Asynchronous Flow (RabbitMQ)
Used for long-running processes to ensure system responsiveness:
- Order Propagation: Gateway to `orders` queue to Stock Service.
- Status Updates: Stock Service to `order-status` queue to Kitchen Queue.
- Real-time Broadcasting: Kitchen/Stock to `order-updates` queue to Notification Hub.

---

## 3. Data Strategy & Persistence

### 3.1 Primary Persistence (MongoDB)
- Identity Provider: Stores student credentials and profiles.
- Order Gateway: Persists all order records for history and auditing.
- Stock Service: Maintains the master inventory list.

### 3.2 High-Speed Caching (Redis)
- Stock Guard: The Order Gateway checks Redis before hitting the database. If stock is 0, the request is rejected in sub-milliseconds.
- UI Recovery: The current status of every order is cached in Redis, allowing the Student Portal to restore the tracking view instantly after a page refresh.

---

## 4. Resilience & Chaos Engineering

### 4.1 Killswitch Mechanism
Every service implements a Chaos Middleware that allows administrators to simulate a total service failure. When killed:
- HTTP requests return 503 Service Unavailable.
- RabbitMQ connections are gracefully closed.
- Reconnection timers are cleared to prevent background "ghost" recoveries.

### 4.2 Ghost-Free Reconnection
Services monitor the chaosMode flag. Automatic reconnection attempts only trigger if the service is explicitly revived by an administrator, ensuring the system strictly honors simulated outages.

---

## 5. Deployment & Infrastructure

### 5.1 Containerization
- Orchestration: Docker Compose manages all containers (services, UIs, and infrastructure).
- Networking: Isolated internal network for service-to-service communication.
- Persistence: Docker volumes ensure database data survives restarts.

### 5.2 CI/CD Pipeline
- Unit Testing: Isolated logic validation for auth and stock.
- Integration Testing: Service-to-service flow validation with containerized dependencies.
- E2E Testing: Full lifecycle validation from student login to order completion.
