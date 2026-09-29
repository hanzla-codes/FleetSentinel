# 🚢 FleetSentinel — Fleet Crisis Command

> A real-time maritime fleet monitoring and crisis-response platform for tracking commercial cargo ships, detecting operational risks, and coordinating incident response.

[![Live Demo](https://img.shields.io/badge/Live-Demo-success?style=for-the-badge)](https://fleetsentinel-production-cd66.up.railway.app/)
[![Backend](https://img.shields.io/badge/Backend-Railway-blue?style=for-the-badge)](https://fleetsentinel-production.up.railway.app/)
[![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB?style=for-the-badge\&logo=react\&logoColor=white)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/API-FastAPI-009688?style=for-the-badge\&logo=fastapi\&logoColor=white)](https://fastapi.tiangolo.com/)
[![Docker](https://img.shields.io/badge/Container-Docker-2496ED?style=for-the-badge\&logo=docker\&logoColor=white)](https://www.docker.com/)
[![Railway](https://img.shields.io/badge/Deployment-Railway-purple?style=for-the-badge)](https://railway.app/)

---

## 🌐 Live Demo

### Frontend

**https://fleetsentinel-production-cd66.up.railway.app/**

### Backend

**https://fleetsentinel-production.up.railway.app/**

FleetSentinel is deployed as a full-stack application with a React frontend, FastAPI backend, REST APIs, and a real-time WebSocket communication layer.

---

## 📌 Overview

**FleetSentinel** is a full-stack maritime fleet operations and crisis-management platform built around a live simulated fleet of **15 commercial cargo ships**.

The platform provides a command-center style interface for:

* Monitoring vessel movement
* Inspecting vessel information
* Detecting operational risks
* Reviewing incidents
* Managing distress situations
* Supporting dispatch workflows
* Visualizing fleet activity on an interactive maritime map

Unlike a static dashboard, FleetSentinel uses **WebSocket-based real-time communication** to continuously stream fleet updates from the backend to the frontend.

---

## 🎯 Project Objectives

FleetSentinel demonstrates how modern full-stack technologies can be combined to build a real-time operational system:

* Real-time fleet monitoring
* Geospatial visualization
* Operational risk detection
* Crisis management
* Incident response
* Dispatch workflows
* Live data streaming
* Asynchronous backend processing
* Containerized deployment
* Cloud deployment

---

# 🚢 Core Features

## 1. Real-Time Fleet Monitoring

FleetSentinel continuously simulates and tracks **15 commercial cargo ships**.

Each vessel can provide operational information including:

* Vessel name
* Vessel ID
* Current position
* Latitude
* Longitude
* Fuel status
* Operational status
* Movement state
* Crisis-related conditions

Fleet state is continuously updated through the backend WebSocket service.

---

## 2. 🗺️ Interactive Maritime Map

The frontend uses **React Leaflet** and **Leaflet** for interactive geospatial visualization.

The map provides:

* Live vessel markers
* Vessel popups
* Vessel information
* Real-time movement
* Maritime region visualization
* Strait of Hormuz
* Persian Gulf
* Gulf of Oman

The interface is designed as a simplified maritime operations center.

---

## 3. 🚨 Crisis Center

The Crisis Center provides centralized monitoring of operational incidents and vessel alerts.

Supported crisis conditions include:

| Condition           | Description                               |
| ------------------- | ----------------------------------------- |
| ⚠️ Warning          | Developing operational risk               |
| 🔴 Critical         | High-severity operational condition       |
| 🆘 Distress         | Vessel distress event                     |
| ⛽ Insufficient Fuel | Low-fuel operational risk                 |
| 🚢 Stranded Vessel  | Vessel unable to continue normal movement |

Operators can filter incidents based on condition and severity.

---

## 4. 📡 Dispatch & Incident Management

FleetSentinel includes a dispatch workflow for handling fleet incidents.

The backend provides APIs for:

* Incident retrieval
* Incident history
* Distress events
* Dispatch operations
* Event playback
* Crisis-response workflows

This creates an operational command-and-response workflow rather than simply displaying vessel locations.

---

## 5. 📊 Analytics

The Analytics section provides an operational overview of fleet activity and incidents.

It is intended to help operators understand:

* Fleet conditions
* Vessel status
* Operational incidents
* Crisis activity
* Response-related information

---

## 6. 🔌 Real-Time WebSocket Communication

FleetSentinel uses WebSockets for live fleet synchronization.

### WebSocket Endpoint

```text
wss://fleetsentinel-production.up.railway.app/ws/fleet
```

The backend continuously publishes updated fleet information, allowing the frontend to update ship positions without repeatedly refreshing the page.

---

# 🏗️ System Architecture

```text
                         ┌───────────────────────┐
                         │     User / Browser    │
                         └───────────┬───────────┘
                                     │
                                     ▼
                    ┌──────────────────────────────┐
                    │       React Frontend         │
                    │                              │
                    │ Dashboard                    │
                    │ Fleet                        │
                    │ Crisis Center                │
                    │ Dispatch                     │
                    │ Analytics                    │
                    │ Interactive Map               │
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
                 REST API                     WebSocket
                    │                             │
                    ▼                             ▼
          ┌────────────────────────────────────────────┐
          │              FastAPI Backend               │
          │                                            │
          │ Fleet API                                  │
          │ Dispatch API                               │
          │ Incident Operations                        │
          │ WebSocket Service                          │
          └─────────────────────┬──────────────────────┘
                                │
                                ▼
                     ┌───────────────────────┐
                     │    Fleet Simulator    │
                     │                       │
                     │ 15 Cargo Ships        │
                     │ Live Positions        │
                     │ Fleet State           │
                     │ Operational Events    │
                     └───────────┬───────────┘
                                 │
                                 ▼
                     ┌───────────────────────┐
                     │        Railway        │
                     │                       │
                     │  Frontend + Backend   │
                     └───────────────────────┘
```

---

# 🔄 Application Flow

```text
Fleet Simulator
       │
       │ Live vessel state
       ▼
FastAPI Backend
       │
       ├──────────────► REST APIs
       │
       └──────────────► WebSocket
                              │
                              ▼
                       React Frontend
                              │
                ┌─────────────┼─────────────┐
                ▼             ▼             ▼
              Fleet         Crisis      Analytics
               Map           Center
                │             │
                └─────────────┼─────────────┘
                              ▼
                          Dispatch
```

---

# 🧰 Tech Stack

## Frontend

| Technology    | Purpose                     |
| ------------- | --------------------------- |
| React         | UI development              |
| Vite          | Frontend build tooling      |
| JavaScript    | Application logic           |
| React Leaflet | Interactive map integration |
| Leaflet       | Geospatial visualization    |
| CSS           | UI styling                  |

## Backend

| Technology | Purpose                       |
| ---------- | ----------------------------- |
| Python     | Backend development           |
| FastAPI    | REST API framework            |
| Pydantic   | Data validation               |
| WebSockets | Real-time communication       |
| AsyncIO    | Asynchronous fleet simulation |

## DevOps & Deployment

| Technology | Purpose                    |
| ---------- | -------------------------- |
| Docker     | Containerization           |
| Nginx      | Frontend production server |
| Railway    | Cloud deployment           |
| Git        | Version control            |
| GitHub     | Source-code hosting        |

---

# 📂 Project Structure

```text
fleet-crisis-command/
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── dispatch.py
│   │   │   └── websocket.py
│   │   │
│   │   ├── simulator/
│   │   │   └── engine.py
│   │   │
│   │   └── main.py
│   │
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── pages/
│   │   └── ...
│   │
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
│
└── README.md
```

---

# 🔌 API Endpoints

## Health Check

```http
GET /health
```

Returns the backend health status.

---

## Fleet

```http
GET /api/fleet
```

Returns the current fleet information.

Example response structure:

```json
{
  "count": 15,
  "ships": []
}
```

---

## Dispatch

Dispatch operations are available under:

```text
/api/dispatch/...
```

These APIs support incident and crisis-response operations.

---

## WebSocket

```text
/ws/fleet
```

The WebSocket provides continuous fleet updates to connected clients.

---

# 💻 Local Development

## Prerequisites

Make sure the following are installed:

* Python 3.11+
* Node.js
* npm
* Git
* Docker Desktop (optional for local container testing)

---

## 1. Clone Repository

```powershell
git clone https://github.com/Shahzaib1106/fleet-crisis-command.git

cd fleet-crisis-command
```

---

# 🐍 Backend Setup

Go to the backend:

```powershell
cd backend
```

Create a virtual environment:

```powershell
python -m venv .venv
```

### Activate `.venv`

```powershell
.\.venv\Scripts\Activate.ps1
```

Install dependencies:

```powershell
pip install -r requirements.txt
```

Start FastAPI:

```powershell
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend:

```text
http://localhost:8000
```

Health check:

```text
http://localhost:8000/health
```

### Deactivate `.venv`

When backend work is finished:

```powershell
deactivate
```

---

# ⚛️ Frontend Setup

Open a **new PowerShell terminal**.

Go to the frontend:

```powershell
cd "C:\Users\Shahzaib\Desktop\fleet-crisis-command\frontend"
```

Install dependencies:

```powershell
npm install
```

Start the development server:

```powershell
npm run dev
```

Frontend normally runs at:

```text
http://localhost:5173
```

---

# 🐳 Docker

FleetSentinel's frontend is containerized using Docker and served through Nginx.

## Build

From the project root:

```powershell
docker build -t fleet-frontend ./frontend
```

## Run

```powershell
docker run --rm -p 8080:8080 fleet-frontend
```

Open:

```text
http://localhost:8080
```

---

# ⚙️ Environment Configuration

## Backend

The backend supports configurable frontend origins through:

```text
FRONTEND_ORIGINS
```

Example:

```text
FRONTEND_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080,https://fleetsentinel-production-cd66.up.railway.app
```

This allows FastAPI CORS middleware to accept requests from local and production frontend environments.

---

## Frontend

Production API configuration:

```text
VITE_API_URL=https://fleetsentinel-production.up.railway.app
```

Production WebSocket configuration:

```text
VITE_WS_URL=wss://fleetsentinel-production.up.railway.app/ws/fleet
```

---

# ☁️ Production Deployment

FleetSentinel is deployed using **Railway**.

## Frontend

```text
React
  ↓
Vite
  ↓
Docker
  ↓
Nginx
  ↓
Railway
```

Production frontend:

```text
https://fleetsentinel-production-cd66.up.railway.app/
```

## Backend

```text
FastAPI
  ↓
Docker / Runtime
  ↓
Railway
```

Production backend:

```text
https://fleetsentinel-production.up.railway.app/
```

---

# 🧪 Testing

The system has been tested across the following areas:

* Backend health endpoint
* Fleet API
* WebSocket connectivity
* 15-ship fleet simulation
* Real-time position updates
* Frontend/backend communication
* CORS configuration
* Crisis Center
* Dispatch APIs
* Incident history
* Distress operations
* Docker frontend build
* Local Nginx container
* Railway production deployment

---

# 🔐 Production Considerations

The current version focuses on fleet simulation and operational workflow.

For a production maritime deployment, the following would be required:

* Authentication
* Role-based access control
* Persistent database storage
* Real AIS data
* Encrypted operational infrastructure
* Audit logging
* Monitoring and observability
* Backup and recovery
* Stronger API security
* Production-grade alerting

---

# 🚀 Future Roadmap

## Phase 1 — Data Layer

* PostgreSQL integration
* Persistent vessel records
* Persistent incident history
* Historical fleet playback

## Phase 2 — Real Maritime Data

* AIS integration
* Live vessel positions
* Vessel metadata
* Port information

## Phase 3 — Intelligence

* Anomaly detection
* Predictive fuel analysis
* Route optimization
* Automated risk scoring
* ETA prediction

## Phase 4 — Operations

* Authentication
* Role-based dashboards
* Operator accounts
* Notification system
* Incident escalation

## Phase 5 — Advanced Monitoring

* Weather integration
* Sea-condition monitoring
* Geofencing
* Restricted-zone alerts
* Advanced fleet analytics

---

# 📈 What This Project Demonstrates

FleetSentinel demonstrates practical experience with:

* Full-stack web application development
* React architecture
* FastAPI backend development
* REST API design
* WebSocket communication
* Asynchronous Python programming
* Real-time state synchronization
* Geospatial applications
* Interactive map development
* Incident-management workflows
* Docker containerization
* Nginx configuration
* Cloud deployment
* CORS configuration
* Production debugging
* Git/GitHub workflow

---

# 👨‍💻 Author

## Shahzaib Ahmad

**BSCS — Lahore Garrison University**

### Areas of Interest

* Backend Development
* Python
* AI & Machine Learning
* Full-Stack Development
* Cloud & Deployment
* Real-Time Systems

### Links

* GitHub: https://github.com/Shahzaib1106
* LinkedIn: https://www.linkedin.com/in/shahzaib-ahmad1105/

---

# 📜 License

This project is intended primarily as an educational, portfolio, and demonstration project.

---

## ⭐ FleetSentinel

**Real-time fleet visibility. Crisis awareness. Operational response.**
