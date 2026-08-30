import { weapiPost } from './request.js';

export const fetchPlaylistDetail = (pid) =>
  weapiPost('/api/v6/playlist/detail', { id: pid, n: 100000, s: 8 });

export const fetchSongDetailByIds = (idObjs) =>
  weapiPost('/api/v3/song/detail', { c: JSON.stringify(idObjs) });

export const updatePlaylistOrder = (pid, ids) =>
  weapiPost('/api/playlist/manipulate/tracks', {
    pid,
    trackIds: JSON.stringify(ids),
    op: 'update'
  });

export const deleteSongsFromPlaylist = (pid, ids) =>
  weapiPost('/api/playlist/manipulate/tracks', {
    pid,
    trackIds: JSON.stringify(ids),
    op: 'del'
  });

export const fetchAlbumDetail = (albumId) =>
  weapiPost(`/api/v1/album/${albumId}`, {});

export const fetchSongRedCount = (songId) =>
  weapiPost('/api/song/red/count', { songId });

export const fetchSongCommentCounts = (songIds) =>
  weapiPost('/api/resource/commentInfo/list', {
    resourceType: '4',
    resourceIds: JSON.stringify(songIds)
  });
