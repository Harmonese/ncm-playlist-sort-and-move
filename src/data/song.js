export function getArtistText(song) {
  if (song.ar && song.ar.length) return song.ar.map(a => a.name).join('/');
  if (song.artists && song.artists.length) return song.artists.map(a => a.name).join('/');
  return '';
}

export function getAlbumText(song) {
  if (song.al && song.al.name) return song.al.name;
  if (song.album && song.album.name) return song.album.name;
  return '';
}

export function toSongItem(song) {
  return {
    id: song.id,
    title: song.name || '',
    artist: getArtistText(song),
    album: getAlbumText(song),
    albumId: song.al?.id || 0,
    publishTime: song.publishTime || 0
  };
}
