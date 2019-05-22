/* eslint-disable no-underscore-dangle,no-param-reassign,no-restricted-syntax,no-return-assign */

import moment from 'moment';
import PlaylistManager from '../../playlistManager';
import { random } from '../../../utils/custUtil';

const debug = require('debug')('playlistManagerProxy');

/**
 * 播放列表管理器代理
 */
export default function proxy(playlists, setting) {
  let songMarks = []; // 随机队列
  let mark = null; // 歌曲索引
  let playlistUUID = null; // 当前播放列表索引
  let isFinal = false; // 列表切换时是否存在播放中的歌曲
  /**
   * 随机设置播放歌曲
   */
  function setSong() {
    if (songMarks.length === 0) {
      debug('随机队列一轮播放结束');
      songMarks = Object.keys(this._playlist);
    }
    mark = songMarks.splice(random(0, songMarks.length), 1);
    debug('歌曲放完了，准备随机放下一首歌曲 ', this._playlist[mark]);
  }

  /**
   * 是否达到切换条件
   * @param id
   * @returns {boolean}
   */
  function canChange(id) {
    // 对于这两个判断条件的解释：
    // 1、刚好在两个播放列表切换的时间点上
    // 2、由于在切换时发现旧的播放列表还有最后一首歌曲没播完，实际还没发生切换，要等最后一首歌end之后才能切换
    if (playlistUUID !== id || isFinal) {
      return true;
    }
    return false;
  }

  /**
   * 切换播放列表
   * @param newPl
   * @returns {tracks|Function|*}
   */
  function change(newPl) {
    const m = this._playlist ? this._playlist[mark] : null;
    if (m && m.howl && m.howl.playing()) {
      if (!isFinal) isFinal = true;
      return this._playlist;
    }
    debug('当前播放的时段: %s~%s', newPl.startTm, newPl.endTm);
    playlistUUID = newPl.uuid;
    this._playlist = newPl.tracks; // 用新的播放列表替换，并重置索引，避免访问越界。
    setSong.apply(this); // 停止旧播放列表的播放
    return this._playlist;
  }

  /**
   * 获取播放列表
   * @returns {*}
   */
  function findCanPlayList() {
    let start = null;
    let end = null;
    let now = null;
    for (const pl of this._plan) {
      start = moment(pl.startTm, 'HH:mm:ss');
      end = moment(pl.endTm, 'HH:mm:ss');
      now = moment();
      if (start.isBefore(now) && end.isAfter(now)) {
        if (canChange.apply(this, [pl.uuid])) {
          // 判断是否是新旧播放列表的交替
          return change.apply(this, [pl]);
        }
        return this._playlist;
      }
    }
    return (this._playlist = null);
  }

  /**
   * 检查歌曲是否刷新
   * @param matchPl
   * @returns {*}
   */
  function checkMusic(matchPl) {
    const currentMusic = this._music;
    const music = { ...matchPl[mark] };
    if (currentMusic && currentMusic.md5 === music.md5) {
      return currentMusic;
    }
    return music;
  }

  return new Proxy(new PlaylistManager(playlists, setting), {
    get(o, k) {
      switch (k) {
        case proxy.METHOD_STOP:
          debug(proxy.METHOD_STOP);
          return () => {
            const stop = o[k];
            stop.apply(o);
            setSong.apply(o);
          };
        case proxy.METHOD_PLAY:
          debug(proxy.METHOD_PLAY);
          return () => {
            const play = o[k];
            play.apply(o);
          };
        case proxy.METHOD_END:
          debug(proxy.METHOD_END);
          return () => {
            const end = o[k];
            end.apply(o);
            setSong.apply(o);
            (function completeFinalMusic() {
              if (isFinal) isFinal = false;
            }.apply(o));
          };
        case proxy.METHOD_GET_PLAYLIST:
          // debug(proxy.METHOD_GET_PLAYLIST);
          return () => {
            return findCanPlayList.apply(o);
          };
        case proxy.METHOD_GET_MUSIC: {
          // debug(proxy.METHOD_GET_MUSIC);
          return function() {
            const matchPl = findCanPlayList.apply(o);
            if (matchPl) {
              this._music = checkMusic.apply(o, [matchPl]);
              const findCanPlayMusic = o[k];
              return findCanPlayMusic;
            }
          }.apply(o);
        }
        default:
          return o[k];
      }
    }
  });
}

proxy.METHOD_STOP = 'stop';
proxy.METHOD_PLAY = 'play';
proxy.METHOD_END = '_onEnd';
proxy.METHOD_GET_PLAYLIST = 'findCanPlayList';
proxy.METHOD_GET_MUSIC = 'findCanPlayMusic';