# MeshChat

A secure, containerized local network communication platform designed to enable real-time messaging, file sharing, and peer-to-peer interaction without relying on external internet connectivity.

## Overview
MeshChat is built specifically for closed local environments (LANs), making it ideal for offline operations, campus networks, and local team collaboration. It utilizes containerization to ensure seamless deployment across different host operating systems.

## Key Features
* **Local-First Architecture:** Operates entirely over local area networks (LAN) with zero internet dependency.
* **Real-Time Communication:** Instant text messaging and image sharing between connected devices on the same subnet.
* **Containerized Deployment:** Packaged using **Docker** for consistent execution, lightweight resource usage, and simple setup.
* **Modern Web Interface:** Clean and responsive UI built using **HTML5**, **CSS3**, and **JavaScript**, communicating via local networking protocols.

## Tech Stack
* **Containerization:** Docker
* **Frontend:** HTML5, CSS3, JavaScript
* **Networking:** Local Area Network (LAN) Socket / HTTP Polling

## Getting Started
1. Clone the repository or navigate to the project directory.
2. Build and run the container using Docker:
   ```bash
   docker build -t meshchat .
   docker run -d -p 8080:80 meshchat
