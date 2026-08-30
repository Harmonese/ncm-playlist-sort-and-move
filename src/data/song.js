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

function getPositiveNumber(value) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function getNonNegativeNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export function toSongItem(song, originalIndex = null) {
  return {
    id: song.id,
    originalIndex,
    title: song.name || '',
    artist: getArtistText(song),
    album: getAlbumText(song),
    albumId: song.al?.id || 0,
    albumDiscNo: getPositiveNumber(song.disc || song.cd),
    albumTrackNo: getPositiveNumber(song.no),
    publishTime: song.publishTime || 0,
    redCount: getNonNegativeNumber(song.redCount),
    popularity: getNonNegativeNumber(song.popularity ?? song.pop),
    commentCount: getNonNegativeNumber(song.commentCount)
  };
}
