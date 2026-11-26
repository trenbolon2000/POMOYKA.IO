// Рубрика «Абсурд власти» — общее для filter.js, post.js и scripts/power.js.
//
// Ленты рубрики помечены в db/sources.json регионом POWER. Их записи основной
// отбор не трогает (политика не попадает в общий поток), публикуются они только
// как выпуск рубрики — с надписью на карточке.

export const POWER_REGION = 'POWER';
export const POWER_LABEL = 'Абсурд власти';

export async function powerSourceIds(db) {
  const { data, error } = await db.from('sources').select('id').eq('region', POWER_REGION);
  if (error) throw error;
  return data.map((s) => s.id);
}

// Фильтр PostgREST «не из лент рубрики» для .not('source_id', 'in', …).
export const idList = (ids) => `(${ids.join(',')})`;
