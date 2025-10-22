# High-Throughput Real-Time Analytics Pipeline

A production-grade data ingestion and processing pipeline built with Node.js, TypeScript, Redis Streams, and TimescaleDB. This project demonstrates how to build a scalable, event-driven system capable of ingesting thousands of events per second, processing them in real-time, and visualizing them on a live-updating dashboard.

![Project Status](https://img.shields.io/badge/status-complete-brightgreen)
![Node.js Version](https://img.shields.io/badge/node-%3E%3D20-blue)
![Language](https://img.shields.io/badge/language-TypeScript-blue)

---

## The Problem: Drinking from the Firehose

Modern applications generate a massive "firehose" of user events. A naive approach of writing every single event to a primary database will fail spectacularly under load, leading to system crashes and stale, outdated analytics.

This project solves the challenge of ingesting and processing this high-throughput data stream in a way that is both scalable and reliable, providing instant insights to the business.

---

## The Architecture: A Decoupled, Real-Time Pipeline

This system uses a modern, multi-service, event-driven architecture designed for scale, resilience, and real-time communication.

![Architecture Diagram](assets/analytics-pipeline-diagram.png)

- **Ingestion API (Express.js):** A lightweight, asynchronous API endpoint. Its only job is to validate incoming events and instantly push them into a Redis Stream, ensuring maximum speed.
- **Redis Streams (The "Conveyor Belt"):** Acts as a durable, persistent data stream, serving as a robust buffer between the fast ingestion layer and the slower processing layer.
- **Stream Processing Worker:** A stateful background worker that reads events from the Redis Stream in batches. It remembers its position ("bookmark"), ensuring that if the worker restarts, no event is ever processed twice. After aggregating data, it publishes an update to a Redis Pub/Sub channel.
- **TimescaleDB (The Data Warehouse):** The permanent data store. The worker writes both raw event data and aggregated real-time counts to this specialized time-series database, which is optimized for incredibly fast queries over time.
- **Real-Time Layer (Socket.IO):** The main API server subscribes to the Redis Pub/Sub channel. When it receives an update from the worker, it immediately broadcasts the new data to all connected dashboard clients via WebSockets.

---

## ✨ Key Features

- **Live Analytics Dashboard:** Visualizes aggregated event data in real-time using **WebSockets (Socket.IO)**, providing instant insights without needing page refreshes.
- **High Throughput:** Designed to handle a massive volume of incoming events without dropping data.
- **Data Durability & Resilience:** Uses a persistent Redis Stream as a buffer, ensuring events are not lost even if the processing worker is down.
- **Stateful, "Exactly-Once" Processing:** The worker is designed to be restart-proof. It tracks the last processed event ID in Redis to prevent duplicate processing.
- **Real-Time Aggregation:** Aggregates event data on the fly, providing live metrics to power the dashboard.
- **Local CI Pipeline:** Uses **Husky** pre-commit hooks to automatically run type-checking and linting, ensuring code quality before every commit.

---

## 🛠️ Tech Stack

- **Backend:** Node.js, TypeScript, Express.js
- **Real-Time:** Socket.IO
- **Streaming:** Redis Streams (with **`ioredis`**)
- **Database:** TimescaleDB (on PostgreSQL)
- **Validation:** Zod
- **Tools & DevOps:** Git, GitHub, Docker, Docker Compose, Husky,CI/CD (GitHub Actions)
- **Load Testing:** `bash` scripting with `curl`

---

## 🚀 Getting Started

This project is fully containerized with Docker, making the setup process simple and reproducible.

### Prerequisites

- Node.js (v20+)
- Docker and Docker Compose

### Setup & Run

1.  **Clone the repository:**

    ```bash
    git clone [https://github.com/TheBigWealth89/event-tracker.git](https://github.com/TheBigWealth89/event-tracker.git)
    cd event-tracker
    ```

2.  **Set up Environment Variables:**
    - Create a `.env` file by copying the example: `cp .env.example .env`.
    - Fill in the required database and Redis credentials. These will be used by Docker Compose.

3.  **Start the Entire Application Stack:**
    This single command will build your Node.js images and start the API server, the worker, PostgreSQL/TimescaleDB, and Redis containers.
    ```bash
    docker-compose up --build
    ```

---

## 🕹️ Usage & Testing

Once the application is running, you can interact with it in several ways.

### 1. View the Live Dashboard

Navigate to **`http://localhost:5000/dashboard`** in your browser. The dashboard will connect via WebSockets and update in real-time as new events are processed.

### 2. Send Test Events

To simulate a burst of incoming data, you can use the provided test script. Open a new terminal and run:

```bash
# On macOS/Linux or Git Bash on Windows
bash ./test_track.sh

```
This will send multiple events to the ingestion API. Watch the dashboard and your worker's logs to see them being processed in real-time.

### 3. Code Quality Checks (Husky)

Husky pre-commit hooks are enabled. When you make a commit, your code will be automatically linted and type-checked, ensuring high quality before it's ever pushed to the repository.

### Future improvements 

**Add a Second Consumer:** Demonstrate the power of streams by adding a second, independent worker (e.g., a "Fraud Detection Worker") that reads from the same event stream.

**Scale to Kafka:** For planet-scale applications, the Redis Stream could be replaced with a distributed log like Apache Kafka.