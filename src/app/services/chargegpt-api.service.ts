import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { map, switchMap } from 'rxjs/operators';
import { Answer, Coordinates } from '../models/models';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ChargeGptApiService {
  private readonly apiUrl = `${environment.BACKEND_API}/api`;
  private readonly headers: any = {
    headers: {
      'Content-Type': 'application/json',
      'x-api-token': environment.API_TOKEN
    }
  };

  constructor(
    private readonly http: HttpClient
  ) {
  }

  getConversationId(language: string): Observable<Answer> {
    const url = `${this.apiUrl}/charge-gpt/conversation?currentTimestamp=${Date.now()}&language=${language}&timezoneOffset=${new Date().getTimezoneOffset()}`;
    return this.http.get<any>(url, this.headers)
      .pipe(
        map((val: any) => val)
      );
  }

  convertSpeechToText(conversationId: string, audio: Blob): Observable<{
    text: string;
    isSuccessful: boolean;
    audioUrl?: string;
  }> {
    return this.uploadAudio(conversationId, audio)
      .pipe(
        switchMap(fileId => {
          const url = `${this.apiUrl}/charge-gpt/conversation/${conversationId}/speech-to-text?fileId=${fileId}`;
          return this.http.get<any>(url, this.headers);
        }),
        map((res: any) => res)
      );
  }

  convertTextToSpeech(conversationId: string, text: string): Observable<{ audioUrl: string; }> {
    const url = `${this.apiUrl}/charge-gpt/conversation/${conversationId}text-to-speech`;
    return this.http.get<any>(url, {
      ...this.headers,
      params: {
        text
      }
    })
      .pipe(
        map((res: any) => res)
      );
  }

  askChargeGpt(
    conversationId: string, 
    body: { 
      text?: string | null, 
      currentCoordinates?: { lat: string; lng: string; }, 
      context?: { deniedContext: string }
    }
  ): Observable<Answer> {
    const url = `${this.apiUrl}/charge-gpt/conversation/${conversationId}/recommendations`;
    return this.http.post<any>(url, body, this.headers)
      .pipe(
        map((val: any) => val)
      );
  }

  uploadAudio(conversationId: string, audio: Blob): Observable<string> {
    const getFileUrlUrl = `${this.apiUrl}/charge-gpt/conversation/${conversationId}/upload-url`;
    let audioFileId = '';
    return this.http.get<any>(getFileUrlUrl, this.headers)
      .pipe(
        switchMap(({ url, fileId }: any) => {
          audioFileId = fileId;

          return this.http.put(url, audio);
        }),
        map(() => audioFileId)
      );
  }

  submitFeedback(feedback: string, conversationId: string): Observable<any> {
    const feedbackUrl = `${this.apiUrl}/charge-gpt/conversation/${conversationId}/feedback`;
    return this.http.post<any>(feedbackUrl, { rating: feedback }, this.headers);
  }
}
