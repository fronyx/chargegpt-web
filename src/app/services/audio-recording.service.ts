import { Injectable } from '@angular/core';
import RecordRTC, { StereoAudioRecorder } from 'recordrtc';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

export interface RecordedAudioOutput {
  blob: Blob;
  title: string;
}

@Injectable()
export class AudioRecordingService {
  private stream: any;
  private recorder: any;
  private startTime: any;
  private recorded$ = new Subject<RecordedAudioOutput>( );
  private recordingFailed$ = new Subject<string>();
  private isAudioRecording$ = new BehaviorSubject<boolean>(false);
  private isSoundDetected = false;
  private MIN_DECIBELS = -55;

  getRecordedBlob(): Observable<RecordedAudioOutput> {
    return this.recorded$.asObservable();
  }

  getAudioRecording(): Observable<boolean> {
    return this.isAudioRecording$.asObservable();
  }

  recordingFailed(): Observable<string> {
    return this.recordingFailed$.asObservable();
  }

  startRecording() {
    if (this.recorder) {
      // It means recording is already started or it is already recording something
      return;
    }

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(s => {
        this.stream = s;

        const mediaRecorder = new MediaRecorder(s);

        const audioContext = new AudioContext();
        const audioStreamSource = audioContext.createMediaStreamSource(s);
        const analyser = audioContext.createAnalyser();
        analyser.minDecibels = this.MIN_DECIBELS;
        audioStreamSource.connect(analyser);

        const bufferLength = analyser.frequencyBinCount;
        const domainData = new Uint8Array(bufferLength);

        this.isSoundDetected = false;

        const detectSound = () => {
          if (this.isSoundDetected) {
            return
          }
    
          analyser.getByteFrequencyData(domainData); 
    
          for (let i = 0; i < bufferLength; i++) {
            const value = domainData[i];
    
            if (domainData[i] > 0) {
              this.isSoundDetected = true
            }
          }
    
          window.requestAnimationFrame(detectSound);
        };
    
        window.requestAnimationFrame(detectSound);

        this.record();
        this.isAudioRecording$.next(true);
      }).catch(error => {
        this.recordingFailed$.next('');
      });
  }

  abortRecording() {
    this.stopMedia();
  }

  private record() {
    this.recorder = new RecordRTC(this.stream, {
      type: 'audio',
      mimeType: 'audio/wav',
      recorderType: StereoAudioRecorder,
    });

    this.recorder.startRecording();
    this.startTime = Date.now();
  }

  stopRecording() {
    if (this.recorder) {
      this.recorder.stopRecording(() => {

        const blob = this.recorder.getBlob();

        if (this.isSoundDetected && (Date.now() - this.startTime > 300)) {
          const title = encodeURIComponent('audio_' + new Date().getTime() + '.wav');
          this.stopMedia();
          this.recorded$.next({ blob, title });
        } else {
          this.abortRecording();
          this.recordingFailed$.next('');
        }
      }, () => {
        this.stopMedia();
        this.recordingFailed$.next('');
      });
    }
  }

  private stopMedia() {
    if (this.recorder) {
      this.recorder = null;
      this.startTime = null;
      if (this.stream) {
        this.stream.getAudioTracks().forEach((track: any) => track.stop());
        this.stream = null;
      }
    }
  }
}
