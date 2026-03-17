# Line-Gantt Dashboard Network Configuration

This document describes the network configuration for the dashboard to integrate with the PLC Gateway.

## Integration Architecture

The dashboard worker connects to the MQTT broker provided by the `PLCgateway` project.

- **MQTT Broker**: `mqtt://10.10.0.244:1883`
- **Interface**: External USB Adapter (`eth1` on host).

## Implemented Changes

### 1. Docker Compose Configuration
- Updated `MQTT_BROKER_URL` environment variable for the `worker` service to use the host static IP `10.10.0.244`.
- This ensures that even though the projects are separate, the dashboard can always reach the gateway via its stable physical interface.

### 2. Database Stability
- Disabled `TS_TUNE` for the TimescaleDB container to prevent crashes related to system resource detection on the Raspberry Pi.

## Verification
- Confirmed "✅ Worker connected to MQTT Broker" in the container logs.
- Confirmed "📡 Subscribed to plc/gate/data/#" in the container logs.
