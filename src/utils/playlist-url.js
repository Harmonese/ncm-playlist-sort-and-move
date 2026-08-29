export function getPlaylistIdFromLocation() {
  const u = new URL(location.href);
  const id = u.searchParams.get('id');
  if (id) return Number(id);
  const hash = location.hash || '';
  const m = hash.match(/[?&]id=(\d+)/);
  return m ? Number(m[1]) : 0;
}
