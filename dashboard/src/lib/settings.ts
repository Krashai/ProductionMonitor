/**
 * Globalne ustawienia aplikacji przechowywane w tabeli `app_settings`
 * (klucz/wartość). Obecnie jedyny klucz to tryb pracy dashboardu.
 *
 *  - PLAN_MODE     — domyślny tryb z planami produkcji (OEE, cel, indeks).
 *  - NO_PLAN_MODE  — uproszczony tryb bez planów (prędkość + scrap + status).
 *
 * Odczyt jest cache'owany przez `unstable_cache` pod tagiem `app-settings`,
 * więc kafelki na wallboardzie nie odpytują bazy przy każdym renderze.
 * Zapis robi `revalidateTag('app-settings')` + `revalidatePath('/')`, żeby
 * monitor natychmiast odświeżył tryb.
 */

import { prisma } from '@/lib/prisma';
import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache';

export type AppMode = 'PLAN_MODE' | 'NO_PLAN_MODE';

export const APP_MODES: readonly AppMode[] = ['PLAN_MODE', 'NO_PLAN_MODE'];

const MODE_KEY = 'app_mode';
const SETTINGS_TAG = 'app-settings';

/**
 * Domyślny tryb, gdy w bazie nie ma jeszcze zapisanej wartości.
 * Sterowany env-em `APP_DEFAULT_MODE`, z bezpiecznym fallbackiem do PLAN_MODE.
 */
export const DEFAULT_MODE: AppMode = isAppMode(process.env.APP_DEFAULT_MODE)
  ? process.env.APP_DEFAULT_MODE
  : 'PLAN_MODE';

/**
 * Type guard — czy surowy string jest prawidłowym trybem aplikacji.
 */
export function isAppMode(value: unknown): value is AppMode {
  return typeof value === 'string' && (APP_MODES as readonly string[]).includes(value);
}

/**
 * Odczyt aktualnego trybu z bazy (cache'owany). Każdy błąd DB degraduje
 * do DEFAULT_MODE — wallboard nigdy nie może paść przez ustawienia.
 */
export const getAppMode = unstable_cache(
  async (): Promise<AppMode> => {
    try {
      const row = await prisma.appSetting.findUnique({ where: { key: MODE_KEY } });
      return isAppMode(row?.value) ? row.value : DEFAULT_MODE;
    } catch (error) {
      console.error('getAppMode: nie udało się odczytać trybu, używam domyślnego.', error);
      return DEFAULT_MODE;
    }
  },
  ['app-mode'],
  { tags: [SETTINGS_TAG] }
);

/**
 * Zapis trybu (upsert) + unieważnienie cache i odświeżenie monitora.
 * Waliduje wejście — nie ufamy surowemu stringowi od wywołującego.
 */
export async function setAppMode(mode: AppMode): Promise<void> {
  if (!isAppMode(mode)) {
    throw new Error(`Nieprawidłowy tryb aplikacji: ${String(mode)}`);
  }

  await prisma.appSetting.upsert({
    where: { key: MODE_KEY },
    update: { value: mode },
    create: { key: MODE_KEY, value: mode },
  });

  revalidateTag(SETTINGS_TAG);
  revalidatePath('/');
}
