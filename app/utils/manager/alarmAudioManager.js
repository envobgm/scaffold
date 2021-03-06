/* eslint-disable no-restricted-syntax,no-underscore-dangle */
import moment from 'moment';
import { Howl } from 'howler';
import MusicManager from './musicManager';
import { macAddr as getMacAddr } from '../custUtil';

const debug = require('debug')('alarmAudioManager');

class AlarmAudioManager extends MusicManager {
  constructor(playlist) {
    super(playlist);
    this._currentMusic = null;
  }

  findCanPlayMusic() {
    for (const alarmAudio of this._playlist) {
      const alarmTime = moment(alarmAudio.alarmTm, 'HH:mm:ss');
      const now = moment();
      const now1 = moment();
      now1.hours(alarmTime.hours());
      now1.minutes(alarmTime.minutes());
      now1.seconds(alarmTime.seconds());
      const diff = Math.abs(now1.diff(now, 'milliseconds'));
      if (diff < 4000) {
        if (!alarmAudio.howl) {
          debug('localFilePath : %o', alarmAudio.filePathName);
          alarmAudio.howl = new Howl({
            src: [alarmAudio.filePathName],
            onplay: this._onPlay.bind(this),
            onend: this._onEnd.bind(this),
            onpause: this._onPause.bind(this),
            onstop: this._onStop.bind(this)
          });
        }
        this._currentMusic = alarmAudio;
        return alarmAudio;
      }
    }
    return null;
  }

  _onPlay() {
    super._onPlay();
    debug(`play ${this._currentMusic.title}`);
  }

  _onEnd() {
    super._onEnd();
    this._currentMusic.howl = null;
    debug(`end ${this._currentMusic.title}`);
  }

  _onPause() {
    super._onPause();
    debug(`pause ${this._currentMusic.title}`);
  }

  _onStop() {
    super._onStop();
    this._currentMusic.howl = null;
    debug(`stop ${this._currentMusic.title}`);
  }

  play() {
    const music = (this._currentMusic = this.findCanPlayMusic());
    if (!this._isLoading && music && !music.howl.playing()) {
      this._isLoading = true;
      music.howl.play();
      getMacAddr()
        .then(mac => {
          window.socket.send({
            data: {
              macAddr: mac,
              soundId: this._currentMusic.uuid,
              fileName: this._currentMusic.title,
              soundType: 'TRACK'
            },
            messageType: 'MONITOR_SOUND'
          });
          return mac;
        })
        .catch(e => {
          throw e;
        });
    }
  }

  playing() {
    return (
      this._isLoading ||
      (this._currentMusic &&
        this._currentMusic.howl &&
        this._currentMusic.howl.playing())
    );
  }

  pause() {
    const music = this._currentMusic;
    if (music && music.howl && !music.howl.playing()) {
      music.howl.pause();
    }
  }

  stop() {
    const music = this._currentMusic;
    if (music && music.howl && !music.howl.playing()) {
      music.howl.stop();
    }
  }
}

export default AlarmAudioManager;
