# Instrukcja Integracji Systemu PLC Gateway

Niniejszy dokument opisuje, w jaki sposób inne systemy (MES, ERP, analityczne, inne microserwisy) mogą pobierać dane ze sterowników PLC za pośrednictwem PLC Gateway.

---

## 📡 1. Integracja przez MQTT (Rekomendowane)

MQTT jest najlepszym sposobem na otrzymywanie danych w czasie rzeczywistym przy minimalnym obciążeniu sieci. Bramka publikuje każdą zmianę wartości tagu jako oddzielną wiadomość.

### Dane połączenia
- **Broker:** Adres IP Twojego serwera
- **Port:** `1883` (domyślny)
- **Format danych:** Tekstowy (String)

### Struktura tematów (Topics)
Dane są publikowane na tematach o strukturze:
`plc/gate/data/{PLC_ID}/{TAG_NAME}`

**Przykłady:**
- `plc/gate/data/linia_1/Temperatura` -> Wiadomość: `24.5`
- `plc/gate/data/linia_1/Status_Silnika` -> Wiadomość: `True`

### Przykład w Python (paho-mqtt)
```python
import paho.mqtt.client as mqtt

def on_message(client, userdata, message):
    print(f"Otrzymano dane: {message.topic} -> {message.payload.decode()}")

client = mqtt.Client()
client.on_message = on_message
client.connect("ADRES_SERWERA", 1883)
client.subscribe("plc/gate/data/#") # Subskrybuj wszystkie dane ze wszystkich PLC
client.loop_forever()
```

---

## 🌐 2. Integracja przez REST API (Pobieranie stanu)

Jeśli Twój system musi pobrać aktualny stan wszystkich sterowników "na żądanie", możesz skorzystać z endpointów FastAPI.

### Autoryzacja
Większość endpointów wymaga tokena JWT. Najpierw musisz się zalogować:
- **POST** `/login`
- **Body:** `{"username": "admin", "password": "your_password"}`
- **Zwraca:** `access_token`

### Pobieranie listy sterowników i wartości
- **GET** `/plcs`
- **Nagłówek:** `Authorization: Bearer {TOKEN}`

**Przykładowa odpowiedź:**
```json
[
  {
    "id": "plc_1",
    "name": "Linia Pakowania",
    "ip": "192.168.1.10",
    "online": true,
    "tags": [
      {
        "name": "Temperatura",
        "value": 23.5,
        "type": "REAL"
      }
    ]
  }
]
```

---

## 🔌 3. Integracja przez WebSockets

Dla aplikacji webowych wymagających odświeżania bez przeładowania strony, bramka udostępnia strumień wszystkich zmian.

- **URL:** `ws://ADRES_SERWERA:8000/ws`
- **Zdarzenie:** `PLC_UPDATE`

Każda zmiana na dowolnym sterowniku powoduje wysłanie przez WebSocket pełnego obiektu tego sterownika.

---

## 💡 Porady dla Integratorów
1. **Cache'owanie:** Zalecamy subskrybowanie MQTT i trzymanie ostatniej wartości w lokalnej bazie danych lub pamięci Twojego systemu.
2. **Monitoring:** Możesz monitorować temat `plc/gate/data/#`, aby wykryć, czy dane przestały spływać (brak publikacji = problem z połączeniem).
3. **Skalowalność:** Bramka jest bezstanowa w kontekście danych procesowych, co pozwala na podpięcie dowolnej liczby odbiorców MQTT bez wpływu na wydajność odczytu z PLC.
