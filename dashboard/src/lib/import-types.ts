/**
 * Typy danych dla funkcji importu planu produkcji z pliku XLSM/XLSX.
 */

/** Surowy wiersz sparsowany z pliku (przed rozwiązaniem lineId) */
export interface ParsedRow {
  resource: string;       // oryginalna wartość z kolumny A (np. "Ex205", "131")
  plcId: string;          // przetransformowany plcId (np. "LP205", "LCE131")
  productIndex: string;   // kolumna B (np. "SA2028CN")
  startTime: Date;        // kolumna E — datetime start
  endTime: Date;          // kolumna H — datetime end
}

/** Wiersz z rozwiązanym lineId i prędkością (do edycji przez użytkownika) */
export interface ImportRow {
  id: string;             // lokalny UUID do identyfikacji wiersza w UI (nie trafia do bazy)
  lineId: string;         // id linii z bazy
  lineName: string;       // nazwa linii (do wyświetlenia)
  resource: string;       // oryginalna nazwa zasobu z pliku
  productIndex: string;
  startTime: Date;
  endTime: Date;
  plannedSpeed: number;   // wypełniane przez użytkownika, domyślnie 0
}

/** Istniejący plan w bazie kolidujący z importem */
export interface ImportConflict {
  id: string;
  lineId: string;
  lineName: string;
  productIndex: string;
  startTime: Date;
  endTime: Date;
}

/** Wynik sprawdzania konfliktów (zwracany z Server Action przed zapisem) */
export interface ImportPreview {
  newRows: ImportRow[];           // wiersze bez konfliktu
  conflictingExisting: ImportConflict[];  // istniejące plany do usunięcia
  conflictingNew: ImportRow[];    // importowane wiersze kolidujące z istniejącymi
}

/** Linia produkcyjna (potrzebna do mapowania zasobów) */
export interface ImportLine {
  id: string;
  plcId: string;
  name: string;
  hallName: string;
}

/** Wynik parsowania pliku */
export interface ParseResult {
  rows: ParsedRow[];
  unknownResources: string[];  // zasoby z pliku nierozpoznane w bazie
}
