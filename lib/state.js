// Служебное состояние между запусками крона — таблица app_state (key → jsonb).

export async function getState(db, key) {
  const { data, error } = await db.from('app_state').select('value').eq('key', key).maybeSingle();
  if (error) throw error;
  return data?.value ?? null;
}

export async function setState(db, key, value) {
  const { error } = await db.from('app_state').upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw error;
}
