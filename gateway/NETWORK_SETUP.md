# PLC Gateway Network Configuration Setup

This document describes the network configuration implemented to bridge two physical subnets using the Raspberry Pi as a gateway.

## Network Architecture

The system uses two physical network interfaces:
1.  **Built-in Ethernet (`eth0`)**: 
    *   **IP**: `10.3.0.117/24`
    *   **Purpose**: Communication with Siemens PLCs (S7 Protocol).
2.  **USB Ethernet Adapter (`eth1`)**:
    *   **IP**: `10.10.0.244/24`

## Implemented Changes

### 1. Host OS Configuration (NetworkManager)
- Created static IP profiles for both interfaces to ensure persistence across reboots.
- Disabled DHCP on `eth0` to prevent address conflicts.

### 2. Mosquitto Configuration
- Created `mosquitto/config/mosquitto.conf`.
- Configured `listener 1883` and `allow_anonymous true` to permit external connections (required for Mosquitto 2.0+).

### 3. Docker Service Isolation
- Modified `docker-compose.yml` to bind specific services to the USB adapter IP (`10.10.0.244`).
- **Port Bindings**:
    - Backend API: `10.10.0.244:8000`
    - Frontend Web UI: `10.10.0.244:3000`

## Verification
- Verified that services are listening exclusively on the `10.10.0.244` interface using `ss -tlnp`.
- Confirmed that the Backend container can reach the `10.3.0.x` subnet via the host's routing table.
