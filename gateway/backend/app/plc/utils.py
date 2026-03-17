import snap7
from snap7.util import get_real, get_int, get_bool, get_dint, get_string

def decode_tag_value(raw_data: bytearray, offset: int, tag_type: str, bit: int = 0):
    """Dekoduje surowe dane ze sterownika PLC na odpowiedni typ Pythona."""
    try:
        t_type = tag_type.upper()
        if t_type == "REAL":
            return get_real(raw_data, offset)
        elif t_type == "INT":
            return get_int(raw_data, offset)
        elif t_type == "DINT":
            return get_dint(raw_data, offset)
        elif t_type == "BOOL":
            # W S7 bity są adresowane jako bajt.bit (np. DB1.DBX0.0)
            return get_bool(raw_data, offset, bit)
        elif t_type == "STRING":
            # S7 String ma 2 bajty nagłówka (max len, actual len)
            return get_string(raw_data, offset)
        return None
    except Exception as e:
        print(f"Błąd dekodowania tagu {tag_type} na offset {offset} bit {bit}: {e}")
        return None
