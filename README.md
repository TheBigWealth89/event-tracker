# High-Throughput Real-Time Analytics Pipeline

A production-grade data ingestion and processing pipeline built with Node.js, TypeScript, Redis Streams, and TimescaleDB. This project demonstrates how to build a scalable system capable of ingesting thousands of events per second, processing them in real-time, and storing them for analysis without overwhelming a traditional database.

![Project Status](https://img.shields.io/badge/status-in_progress-yellow)
![Node.js Version](https://img.shields.io/badge/node-%3E%3D20-blue)
![Language](https://img.shields.io/badge/language-TypeScript-blue)

---

## The Problem: Drinking from the Firehose

Modern applications generate a massive "firehose" of user events: every page view, button click, and interaction. A naive approach of writing every single event to a primary database like PostgreSQL will fail spectacularly under load, leading to slow performance and system crashes.

This project solves the challenge of ingesting and processing this high-throughput data stream in a way that is both scalable and reliable.

---

## The Architecture: A Decoupled, Stream-Based Pipeline

This system uses a modern, multi-service, event-driven architecture designed for scale and resilience.

![Architecture Diagram](assets/analytics-pipeline-diagram.png)

* **Ingestion API (Express.js):** A lightweight, asynchronous API endpoint. Its only job is to validate incoming events and instantly push them into a Redis Stream. It's designed for maximum speed and throughput.
* **Redis Streams (The "Conveyor Belt"):** Acts as a durable, persistent data stream. Unlike a simple queue, a stream allows events to be stored and re-read, serving as a robust buffer between the fast ingestion layer and the slower processing layer.
* **Stream Processing Worker:** A stateful background worker that reads events from the Redis Stream in batches. It remembers its position ("bookmark"), ensuring that even if the worker restarts, no event is ever processed twice or missed.
* **TimescaleDB (PostgreSQL for Time-Series):** The permanent data warehouse. The worker writes both the raw event data and aggregated real-time counts to this specialized time-series database, which is optimized for incredibly fast queries over time.

---

## ✨ Key Features

-   **High Throughput:** Designed to handle a massive volume of incoming events without dropping data.
-   **Data Durability & Resilience:** Uses a persistent Redis Stream as a buffer, ensuring events are not lost even if the processing worker is down.
-   **Stateful, "Exactly-Once" Processing:** The worker is designed to be restart-proof. It tracks the last processed event ID to prevent duplicate processing.
-   **Real-Time Aggregation:** Aggregates event data on the fly, providing live metrics that can be used to power a dashboard.
-   **Optimized for Time-Series Data:** Leverages TimescaleDB (a PostgreSQL extension) to efficiently store and query time-stamped event data.

---

## 🛠️ Tech Stack

-   **Backend:** Node.js, TypeScript, Express.js
-   **Streaming:** Redis Streams
-   **Database:** TimescaleDB (on PostgreSQL)
-   **Validation:** Zod
-   **Tools & DevOps:** Git, GitHub, Docker, CI/CD (GitHub Actions)

---

## 🚀 Getting Started


### Prerequisites
- Node.js (v20+)
- Docker and Docker Compose (for running PostgreSQL/TimescaleDB and Redis)

### Setup & Run
1.  **Clone the repository:**
    ```bash
    git clone https://github.com/TheBigWealth89/event-tracker.git
    cd event-tracker
    ```
2.  **Set up environment variables:**
    - Create a `.env` file and add your database and Redis connection details.
3.  **Start the infrastructure:**
    ```bash
    docker-compose up -d
    ```
4.  **Install dependencies and run the application:**
    ```bash
    npm install
    npm run start:api
    npm run start:worker
    ```

---

## 🔮 Future Improvements

* **Add a Second Consumer:** Demonstrate the power of streams by adding a second, independent worker (e.g., a "Fraud Detection Worker") that reads from the same event stream.
* **Scale to Kafka:** For planet-scale applications, the Redis Stream could be replaced with a distributed log like Apache Kafka.
* **Build a Live Dashboard:** Use WebSockets to push the real-time aggregated data from the worker to a live-updating frontend chart.