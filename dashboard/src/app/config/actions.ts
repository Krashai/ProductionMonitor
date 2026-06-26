'use server';

import { revalidatePath } from 'next/cache';
import { requirePlanningAccess } from '@/lib/auth';
import { isAppMode, setAppMode } from '@/lib/settings';

export type ConfigActionResult =
  | { success: true; mode: 'PLAN_MODE' | 'NO_PLAN_MODE' }
  | { success: false; error: string };

/**
 * Server action wywoływany z formularza /config.
 * Zmienia tryb pracy dashboardu (PLAN_MODE / NO_PLAN_MODE).
 *
 *  - Wymaga aktywnej sesji /planning (ta sama bramka hasła).
 *  - Waliduje wartość po whiteliście — nie ufa surowemu stringowi z formularza.
 */
export async function updateAppMode(
  formData: FormData
): Promise<ConfigActionResult> {
  const gate = await requirePlanningAccess();
  if (gate) return gate;

  const raw = formData.get('mode');
  if (!isAppMode(raw)) {
    return { success: false, error: 'Nieprawidłowy tryb pracy.' };
  }

  try {
    await setAppMode(raw);
    revalidatePath('/');
    return { success: true, mode: raw };
  } catch (error) {
    console.error('updateAppMode: zapis trybu nie powiódł się.', error);
    return { success: false, error: 'Nie udało się zapisać ustawień. Spróbuj ponownie.' };
  }
}
