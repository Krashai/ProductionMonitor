import json

# List of all lines from seed.ts
lines_data = [
    ('LP202', 'LP202 (S7-300)', 'S7-300'),
    ('LP405', 'LP405', 'S7-1200'),
    ('LP702', 'LP702', 'S7-1200'),
    ('LP802', 'LP802', 'S7-1500'),
    ('LP902', 'LP902', 'S7-1200'),
    ('LP302', 'LP302', 'S7-300'),
    ('LP402', 'LP402', 'S7-1200'),
    ('LP502', 'LP502', 'S7-1200'),
    ('LP602', 'LP602', 'S7-1200'),
    ('LCE131', 'LCE131', 'S7-1200'),
    ('LP205', 'LP205', 'S7-1200'),
    ('LP305', 'LP305', 'S7-1200'),
    ('LP505', 'LP505', 'S7-1200'),
    ('LP605', 'LP605', 'S7-1200'),
    ('LP705', 'LP705', 'S7-1200'),
    ('LP707', 'LP707', 'S7-1200'),
    ('LP805', 'LP805', 'S7-1200'),
    ('INS1', 'INS1', 'S7-1200'),
    ('INS2', 'INS2', 'S7-1200'),
    ('LCE132', 'LCE132', 'S7-1200'),
    ('LP606', 'LP606', 'S7-1200'),
    ('LP607', 'LP607', 'S7-1200'),
    ('LP608', 'LP608', 'S7-1200'),
    ('LP609', 'LP609', 'S7-1200'),
]

# Existing config retrieved from docker exec
existing_config = {
    "plcs": [
        {
            "id": "LP902",
            "name": "LP902",
            "ip": "10.3.0.100",
            "rack": 0,
            "slot": 1,
            "type": "S7-1200",
            "tags": [
                {"name": "Speed", "db": 30, "offset": 0, "bit": 0, "type": "REAL"},
                {"name": "Status", "db": 30, "offset": 422, "bit": 0, "type": "BOOL"},
                {"name": "Scrap_Pulse", "db": 30, "offset": 423, "bit": 5, "type": "BOOL"}
            ]
        },
        {
            "id": "LP802",
            "name": "LP802",
            "ip": "10.3.0.77",
            "rack": 0,
            "slot": 1,
            "type": "S7-1500",
            "tags": [
                {"name": "Status", "db": 30, "offset": 370, "bit": 0, "type": "BOOL"},
                {"name": "Speed", "db": 30, "offset": 0, "bit": 0, "type": "REAL"},
                {"name": "Scrap", "db": 30, "offset": 436, "bit": 3, "type": "BOOL"}
            ]
        },
        {
            "id": "LP202",
            "name": "LP202",
            "ip": "10.3.0.68",
            "rack": 0,
            "slot": 1,
            "type": "S7-300",
            "tags": [
                {"name": "Speed", "db": 111, "offset": 18, "bit": 0, "type": "REAL"},
                {"name": "Status", "db": 111, "offset": 0, "bit": 0, "type": "BOOL"}
            ]
        },
        {
            "id": "LP302",
            "name": "LP302",
            "ip": "10.3.0.69",
            "rack": 0,
            "slot": 2,
            "type": "S7-300",
            "tags": [
                {"name": "Speed", "db": 111, "offset": 22, "bit": 0, "type": "REAL"},
                {"name": "Status", "db": 111, "offset": 0, "bit": 0, "type": "BOOL"}
            ]
        },
        {
            "id": "LP702",
            "name": "LP702",
            "ip": "10.3.0.53",
            "rack": 0,
            "slot": 1,
            "type": "S7-1200",
            "tags": [
                {"name": "Status", "db": 30, "offset": 0, "bit": 0, "type": "BOOL"},
                {"name": "Speed", "db": 30, "offset": 2, "bit": 0, "type": "REAL"}
            ]
        }
    ],
    "mqtt_broker": "127.0.0.1",
    "mqtt_port": 1883,
    "poll_rate": 1.0,
    "admin_password_hash": "$2b$12$1stX1mZPFW4uvpwqPtuk.e63D9SEOa.CA4mBDSAbWHGVYxUo8gLvu"
}

plcs_dict = {p['id']: p for p in existing_config['plcs']}

final_plcs = []
for plc_id, name, plc_type in lines_data:
    if plc_id in plcs_dict:
        # Update existing
        plc = plcs_dict[plc_id]
        # Ensure Status tag exists
        if not any(t['name'].lower() == 'status' for t in plc['tags']):
            db = 111 if plc_type == 'S7-300' else 30
            plc['tags'].append({"name": "Status", "db": db, "offset": 0, "bit": 0, "type": "BOOL"})
        final_plcs.append(plc)
    else:
        # Add new with placeholders
        db = 111 if plc_type == 'S7-300' else 30
        final_plcs.append({
            "id": plc_id,
            "name": name,
            "ip": "0.0.0.0",
            "rack": 0,
            "slot": 2 if plc_type == 'S7-300' else 1,
            "type": plc_type,
            "tags": [
                {"name": "Status", "db": db, "offset": 0, "bit": 0, "type": "BOOL"},
                {"name": "Speed", "db": db, "offset": 2 if plc_type != 'S7-300' else 18, "bit": 0, "type": "REAL"}
            ],
            "online": False
        })

existing_config['plcs'] = final_plcs

with open('new_settings.json', 'w') as f:
    json.dump(existing_config, f, indent=4)
