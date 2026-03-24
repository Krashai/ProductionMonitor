# Line-Gantt Dashboard Network Configuration

This document describes the network configuration for the dashboard to integrate with the PLC Gateway.

## Integration Architecture


- **Interface**: External USB Adapter (`eth1` on host).

## Implemented Changes

### 1. Docker Compose Configuration
- This ensures that even though the projects are separate, the dashboard can always reach the gateway via its stable physical interface.

### 2. Database Stability
- Disabled `TS_TUNE` for the TimescaleDB container to prevent crashes related to system resource detection on the Raspberry Pi.

## Verification
- Confirmed "📡 Subscribed to plc/gate/data/#" in the container logs.
