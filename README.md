# Iftar Microservices System

A professional, distributed, and fault-tolerant microservices system designed to handle the high-load Ramadan rush for IUT cafeteria ordering.

## Project Documentation Index

For a detailed understanding of the project, please refer to the following documents:

1.  **[Requirement Analysis](RequirementAnalysis.md)**: Deep dive into problem statements, identified requirements, and implementation checklist.
2.  **[Technical Architecture](TechnicalArchitecture.md)**: Detailed overview of system design, component interactions, and data strategy.
3. ** [Stack Report & Justification](Stack Report & Justification.md)**: Comprehensive analysis of chosen technologies and their suitability for the project. 
3.  **[Testing Guide](TESTING_GUIDE.md)**: Comprehensive manual for running and understanding the three-tier testing suite.

---

## Quick Start

### Prerequisites
- Docker & Docker Compose

### Installation & Run
1. Clone the repository.
2. Run the full stack with a single command:
   ```bash
   docker-compose up --build -d
   ```

### Access Ports
- Student Portal: [http://localhost:5173](http://localhost:5173)
- Admin Dashboard: [http://localhost:5174](http://localhost:5174)

### Default Credentials
- Student ID: `STU001`
- Password: `password123`

---

## Key Features

- **Decoupled Microservices**: 5 backend services + 2 UIs communicating via HTTP and RabbitMQ.
- **Chaos Engineering**: Built-in killswitch system to simulate and monitor service outages.
- **Real-time Feedback**: Instant order tracking updates via Socket.io.
- **High-Performance Caching**: Redis-backed stock checks and state recovery.
- **Advanced Management**: Full inventory CRUD and student directory with activity metrics.
- **Professional UI**: Responsive designs with Dark/Light mode support and custom components.

---

## AI Tool Disclosure
In accordance with DevSprint 2026 rules, the following AI tools were used during the development of this project:
- Google Gemini
- GitHub Copilot
