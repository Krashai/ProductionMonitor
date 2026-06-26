export interface Line {
  id: string;
  name: string;
  plcId: string;
  isOnline: boolean;
  lastSeenAt: string | null;
  history: { status: boolean; speed: number; time: string }[];
  plans: { id: string; productIndex: string }[];
  _count: { scrap: number };
}

export interface Hall {
  id: string;
  name: string;
  lines: Line[];
}
