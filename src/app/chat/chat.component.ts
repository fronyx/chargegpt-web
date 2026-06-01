import { ChangeDetectorRef, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { AudioRecordingService, RecordedAudioOutput } from '../services/audio-recording.service';
import { ChargeGptApiService } from '../services/chargegpt-api.service';
import { AnalyticsService } from '../services/analytics.service';
import { BehaviorSubject, Observable, OperatorFunction, Subject, catchError, concatMap, filter, of, switchMap, takeUntil, tap } from 'rxjs';
import { Address, Answer, Location, Point } from '../models/models';
import { TranslateService } from '@ngx-translate/core';
import { FormControl, Validators } from '@angular/forms';
import {} from 'googlemaps';
import { environment } from 'src/environments/environment';
import * as DOMPurify from 'dompurify';

interface Language {
  name: string;
  value: string;
  iconCode: string;
}

@Component({
  selector: 'chargegpt-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss'],
})
export class ChatComponent implements OnDestroy {
  @ViewChild('pollyAudio')
  pollyAudioElement?: ElementRef<HTMLAudioElement>;

  @ViewChild('pollyAudioSource')
  pollyAudioSourceElement?: ElementRef<HTMLSourceElement>;

  @ViewChild('input') myInputField: ElementRef;

  infoWindow: google.maps.InfoWindow;

  isAudioRecording = false;

  chatHistoryView: Array<any> = [];

  resultsList: Location[] = [];

  conversationId$: BehaviorSubject<string> = new BehaviorSubject(null as any);

  languages: Language[] = [
    { name: 'German', value: 'de', iconCode: 'fi fi-de' },
    { name: 'English', value: 'en', iconCode: 'fi fi-gb' },
    { name: 'Spanish', value: 'es', iconCode: 'fi fi-es' },
    { name: 'French', value: 'fr', iconCode: 'fi fi-fr' },
    { name: 'Portuguese', value: 'pt', iconCode: 'fi fi-pt' },
    { name: 'Czech', value: 'cs', iconCode: 'fi fi-cz' },
  ];

  selectedLanguage: string = this.languages[0].name;
  selectedIcon: string = this.languages[0].iconCode;

  isLoading$: BehaviorSubject<boolean> = new BehaviorSubject(false);

  isRequestOutOfScope$: BehaviorSubject<boolean> = new BehaviorSubject(false);

  navigationLink: string | undefined = undefined;

  textFormControl = new FormControl('', [Validators.maxLength(280)]);

  isShowFeedback$: BehaviorSubject<boolean> = new BehaviorSubject(false);

  // @ts-ignore
  submittedFeedbackValue$: BehaviorSubject<string | null> = new BehaviorSubject(null);

  playSuccessfulSound: Boolean = false;

  mapCount: number = 0;

  menuOpen: boolean = false;

  enableShareUserLocationFeatures = environment.ENABLE_USER_LOCATION;

  isAlwaysShareUserLocation: boolean = false;

  showFiller = false;

  showFirstSuggestions = true;

  showSuggestions = true;

  private readonly currentLocationStatusCode$: BehaviorSubject<number> = new BehaviorSubject(0);
  private readonly conversationContext$: Subject<{
    currentCoordinates: { lat: string; lng: string };
  }> = new Subject();
  private readonly destroyed$: Subject<null> = new Subject();

  constructor(
    private audioRecordingService: AudioRecordingService,
    private chargeGptAPI: ChargeGptApiService,
    private analyticsService: AnalyticsService,
    private readonly translate: TranslateService,
    private changeDetectorRef: ChangeDetectorRef
  ) {
    this.shuffleSuggestions();
    this.startEventListeners();
    this.startConversation();

    this.listenToConversationContextChanges();
    this.initializeCurrentLocationStatusCode();

    if (window.innerWidth <= 600) {
      this.showSuggestions = false;
    }
  }

  triggerMenu() {
    this.menuOpen = !this.menuOpen;
  }

  listenToConversationContextChanges(): void {
    this.conversationContext$
      .pipe(
        filter((val) => !!val),
        takeUntil(this.destroyed$)
      )
      .subscribe();
  }

  initializeCurrentLocationStatusCode(): void {
    const statusCode = localStorage.getItem('currentLocationStatusCode');
    if (statusCode === null) {
      this.currentLocationStatusCode$.next(0);
    } else {
      this.currentLocationStatusCode$.next(Number(statusCode));
    }
  }

  attemptCurrentCoordinatesRetrievalProcess(text?: string): void {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position: GeolocationPosition) => {
          const currentCoordinates = {
            lat: position.coords.latitude.toString(),
            lng: position.coords.longitude.toString(),
          };

          localStorage.setItem('currentLocationStatusCode', '5');
          this.currentLocationStatusCode$.next(5);

          if (this.isAlwaysShareUserLocation) {
            this.submitUserResponse({ text, currentCoordinates }).subscribe((answer) => {
              this.handleConversationApiSuccessRequest(answer);
            });
          } else {
            this.submitCoordinates(currentCoordinates).subscribe((answer) => {
              this.handleConversationApiSuccessRequest(answer);
            });
          }
        },
        (error: GeolocationPositionError) => {
          localStorage.setItem('currentLocationStatusCode', error.code.toString());
          this.currentLocationStatusCode$.next(error.code);
          this.handleExtraContextRequest();
        },
        {
          timeout: 45000,
          enableHighAccuracy: true,
        }
      );
    } else {
      localStorage.setItem('currentLocationStatusCode', '4');
      this.currentLocationStatusCode$.next(4);
      this.handleExtraContextRequest();
    }
  }

  async initMap(args: {
    locationsDetails: any[];
    destination: any | undefined;
    origin: any | undefined;
    poi: any | undefined;
    route: Point[];
  }): Promise<void> {
    this.changeDetectorRef.detectChanges();
    let locations: any[] = [];

    const map = new google.maps.Map(
      document.getElementById(`mapContainer${this.mapCount}`) as HTMLElement,
      {
        mapId: environment.MAP_ID,
        zoom: 13,
        disableDefaultUI: true,
      } as google.maps.MapOptions
    );

    map.addListener('click', () => {
      if (this.infoWindow) {
        this.infoWindow.close();
      }
    });
    const bounds = new google.maps.LatLngBounds();

    if (args.route.length > 0) {
      const legs = args.route.map((stop: any) => {
        return {
          lat: Number(stop.latitude),
          lng: Number(stop.longitude),
        };
      });

      await this.createRouteMarker(map, legs);
    }

    for (const location of args.locationsDetails) {
      const isDuplicate = locations.find((obj) => obj.lat === location.lat && obj.lng === location.lng);
      const filteredLocations = args.locationsDetails.filter((obj) => obj.lat === location.lat && obj.lng === location.lng);

      if (!isDuplicate) {
        bounds.extend({ lat: Number(location.lat), lng: Number(location.lng) });

        locations.push({
          ...location,
          locationIds: filteredLocations.map((location) => location.locationId),
          recommendation: filteredLocations.filter((obj) => !!obj.recommendation).map((obj) => obj.recommendation),
        });
      }
    }

    if (args.destination && !args.origin) {
      bounds.extend({
        lat: Number(args.destination.coordinates.lat),
        lng: Number(args.destination.coordinates.lng),
      });
    }

    const locationsWithoutRecommendation = locations.filter((location) => {
      return location.recommendation.length < 1;
    });
    const locationsWithRecommendation = locations.filter((location) => {
      return location.recommendation.length > 0;
    });

    for (let i = 0; i < locationsWithoutRecommendation.length; i++) {
      const chargingStation = locationsWithoutRecommendation[i];
      await this.createPinMarker(map, chargingStation);
    }

    for (let i = 0; i < locationsWithRecommendation.length; i++) {
      const chargingStation = locationsWithRecommendation[i];
      await this.createLabelMarker(map, chargingStation);
    }

    if (args.destination) {
      await this.createDestinationMarker(map, args.destination);
    }

    if (args.origin) {
      await this.createDestinationMarker(map, args.origin);
    }

    if (args.poi) {
      bounds.extend({
        lat: Number(args.poi.coordinates.lat),
        lng: Number(args.poi.coordinates.lng),
      });

      await this.createDestinationMarker(map, args.poi);
    }

    if (locations.length > 1) {
      map.fitBounds(bounds);
    }
    map.setCenter(bounds.getCenter());
  }

  async createPinMarker(map: google.maps.Map, chargingStation: any): Promise<void> {
    // @ts-ignore
    const { AdvancedMarkerElement } = (await google.maps.importLibrary('marker')) as any;
    // @ts-ignore
    const { PinElement } = (await google.maps.importLibrary('marker')) as any;

    const pinBackground = new PinElement({
      background: '#FD9103FF',
      borderColor: '#0E1014',
      glyphColor: '#D07600FF',
      scale: 0.9,
    });

    const pinMarker = new AdvancedMarkerElement({
      map,
      position: {
        lat: Number(chargingStation.lat),
        lng: Number(chargingStation.lng),
      },
      content: pinBackground.element,
      title: chargingStation.locationIds.toString(),
    });

    this.infoWindow = new google.maps.InfoWindow({
      content: '',
    });

    pinMarker.addListener('click', () => {
      const content =
        '<span>Charging ID: ' +
        chargingStation.locationIds.toString() +
        '<br>Power Type: ' +
        chargingStation.powerType +
        '<br>Power Value: ' +
        chargingStation.powerKw +
        'kW' +
        '<br>Connector Type: ' +
        chargingStation.connectorTypes.toString() +
        '<br><a href="' +
        chargingStation.link +
        '" target="_blank" style="color: rgb(66, 127, 237)">View on Google Maps</a>' +
        '</span>';
      this.infoWindow.setContent(content);
      this.infoWindow.setOptions({ maxWidth: 240 });
      this.infoWindow.open(map, pinMarker);
      return pinMarker;
    });
  }

  async createLabelMarker(map: google.maps.Map, chargingStation: any): Promise<void> {
    // @ts-ignore
    const { AdvancedMarkerElement } = (await google.maps.importLibrary('marker')) as any;
    const recommendationTag = document.createElement('div');

    recommendationTag.classList.add('c-label-marker');
    recommendationTag.textContent = chargingStation.recommendation[0];

    const labelMarker = new AdvancedMarkerElement({
      map,
      position: {
        lat: Number(chargingStation.lat),
        lng: Number(chargingStation.lng),
      },
      content: recommendationTag,
      title: chargingStation.locationIds.toString(),
      collisionBehavior: 'OPTIONAL_AND_HIDES_LOWER_PRIORITY',
    });

    this.infoWindow = new google.maps.InfoWindow({
      content: '',
    });

    labelMarker.addListener('click', () => {
      const content =
        '<span>Charging ID: ' +
        chargingStation.locationIds.toString() +
        '<br>Power Type: ' +
        chargingStation.powerType +
        '<br>Power Value: ' +
        chargingStation.powerKw +
        'kW' +
        '<br>Connector Type: ' +
        chargingStation.connectorTypes.toString() +
        '<br><a href="' +
        chargingStation.link +
        '" target="_blank" style="color: rgb(66, 127, 237)">View on Google Maps</a>' +
        '</span>';
      this.infoWindow.setContent(content);
      this.infoWindow.setOptions({ maxWidth: 240 });
      this.infoWindow.open(map, labelMarker);
      return labelMarker;
    });
  }

  async createDestinationMarker(map: google.maps.Map, destinationDetails: Address): Promise<void> {
    this.infoWindow = new google.maps.InfoWindow({
      content: '',
    });

    // @ts-ignore
    const { AdvancedMarkerElement } = (await google.maps.importLibrary('marker')) as any;
    const destinationTag = document.createElement('div');
    destinationTag.classList.add('c-dot-marker');

    const dotMarker = new AdvancedMarkerElement({
      map,
      position: {
        lat: Number(destinationDetails.coordinates.lat),
        lng: Number(destinationDetails.coordinates.lng),
      },
      content: destinationTag,
      title: destinationDetails.address,
    });

    dotMarker.addListener('click', () => {
      const content =
        '<span>' +
        destinationDetails.address +
        '<br/><a href="https://www.google.com/maps/search/?api=1&query=' +
        destinationDetails.coordinates.lat +
        ',' +
        destinationDetails.coordinates.lng +
        '" target="_blank" style="color: rgb(66, 127, 237)">View on Google Maps</a>' +
        '</span>';
      this.infoWindow.setContent(content);
      this.infoWindow.open(map, dotMarker);
      return dotMarker;
    });
  }

  async createRouteMarker(
    map: google.maps.Map,
    routePoint: {
      lat: number;
      lng: number;
    }[]
  ): Promise<void> {
    const path = new google.maps.Polyline({
      path: routePoint,
      geodesic: true,
      strokeColor: '#fd9103',
      strokeOpacity: 0.5,
      strokeWeight: 2,
    });

    path.setMap(map);
  }

  startEventListeners(): void {
    this.audioRecordingService
      .recordingFailed()
      .pipe(takeUntil(this.destroyed$))
      .subscribe(() => {
        this.isAudioRecording = false;
        this.chatHistoryView.push({
          role: 'assistant',
          content: this.translate.instant('record.errorAudio'),
          isRequestOutOfScope: false,
        });
      });

    this.audioRecordingService
      .getRecordedBlob()
      .pipe(
        concatMap((data) => this.processInteraction(data)),
        takeUntil(this.destroyed$)
      )
      .subscribe();
  }

  changeLanguage(language: Language): void {
    this.selectedLanguage = language.name;
    this.selectedIcon = language.iconCode;
    this.translate
      .use(language.value)
      .pipe(takeUntil(this.destroyed$))
      .subscribe(() => this.resetChargeGPT());
  }

  /**
   * Step 1: Starting the conversation by getting the conversation ID
   */
  startConversation(): void {
    this.isLoading$.next(true);

    this.chargeGptAPI
      .getConversationId(this.translate.currentLang)
      .pipe(
        takeUntil(this.destroyed$),
        catchError((error) => {
          this.chatHistoryView.push({
            role: 'assistant',
            content: this.translate.instant('record.error'),
            isRequestOutOfScope: false,
          });

          this.handleError('').then();
          throw Error(`Error while processing interaction ConversationID ${this.conversationId$.getValue()} : ${JSON.stringify(error)}`);
        })
      )
      .subscribe((answer: Answer) => {
        this.conversationId$.next(answer.conversationId);
        this.chatHistoryView.push({
          role: answer.role,
          content: answer.prompt,
          isRequestOutOfScope: false,
        });

        this.isLoading$.next(false);

        if (this.analyticsService.initGoogleAnalytics()) {
          this.analyticsService.sendPageView(environment.PUBLIC_APP_URL, answer.conversationId);
        }

        return this.speak(answer.audioUrl);
      });
  }

  private submitCoordinates(currentCoordinates: { lat: string; lng: string }): Observable<Answer> {
    return this.submitUserResponse({ currentCoordinates });
  }

  private denyContext(context: { deniedContext: string }): Observable<Answer> {
    return this.submitUserResponse({ context });
  }

  private handleConversationApiRequestError(): OperatorFunction<any, any> {
    return catchError((error) => {
      if (error?.error?.message?.includes('Data access to country')) {
        this.chatHistoryView.push({
          role: 'assistant',
          content: this.translate.instant('record.errorCountry'),
          isRequestOutOfScope: false,
        });
      } else if (error?.error?.message?.includes('Unsupported media length') && error.error.statusCode === 400) {
        this.chatHistoryView.push({
          role: 'assistant',
          content: this.translate.instant('record.errorAudioLength'),
          isRequestOutOfScope: false,
        });
      } else {
        this.chatHistoryView.push({
          role: 'assistant',
          content: this.translate.instant('record.error'),
          isRequestOutOfScope: false,
        });
      }

      this.handleError('');

      throw Error(`Error while processing interaction ConversationID ${this.conversationId$.getValue()} : ${JSON.stringify(error)}`);
    });
  }

  private submitUserResponse(body: {
    text?: string | null;
    currentCoordinates?: { lat: string; lng: string };
    context?: { deniedContext: string };
  }): Observable<Answer> {
    this.isLoading$.next(true);

    this.stopPlayAudio();

    return this.chargeGptAPI.askChargeGpt(this.conversationId$.value, body).pipe(
      filter((val: any) => val !== null),
      takeUntil(this.destroyed$),
      this.handleConversationApiRequestError()
    );
  }

  /**
   *
   * @param answer The response from the API in the form of an Answer object
   */
  private handleConversationApiSuccessRequest(answer: Answer): void {
    const { results, isRequestOutOfScope } = answer;
    this.isRequestOutOfScope$.next(isRequestOutOfScope ?? false);

    if (answer?.provideContext === 'Location' && !results) {
      this.handleExtraContextRequest();
    } else {
      this.isLoading$.next(false);
      if (results) {
        this.displayLocationResults(answer);

        setTimeout(() => {
          this.speak(answer.audioUrl);
        }, 1000);
      } else {
        if (answer.isClosed) {
          this.resetChargeGPT();
        } else {
          const formattedContent = answer.prompt.replace(/(\d\.\))/g, '\n$1');

          this.chatHistoryView.push({
            role: answer.role,
            content: formattedContent,
            isRequestOutOfScope: answer.isRequestOutOfScope,
          });

          this.speak(answer.audioUrl);
        }
      }
    }
  }

  private handleExtraContextRequest(text?: string): void {
    switch (this.currentLocationStatusCode$.value) {
      case 1:
        this.sendEmptyContextToChargegpt();
        break;
      case 2:
        this.sendEmptyContextToChargegpt();
        break;
      case 4:
        this.sendEmptyContextToChargegpt();
        break;
      default:
        this.attemptCurrentCoordinatesRetrievalProcess(text);
    }
  }

  sendEmptyContextToChargegpt(): void {
    this.denyContext({ deniedContext: 'Location' }).subscribe((answer) => {
      this.handleConversationApiSuccessRequest(answer);
    });
  }

  submitText(text: string | null): void {
    this.textFormControl.setValue('');
    this.showFirstSuggestions = false;

    if (text) {
      const sanitizeText = DOMPurify.sanitize(text);

      if (!!sanitizeText) {
        this.chatHistoryView.push({ role: 'user', content: sanitizeText });
        this.isLoading$.next(true);

        if (this.isAlwaysShareUserLocation) {
          this.handleExtraContextRequest(text);
        } else {
          this.submitUserResponse({ text: sanitizeText }).subscribe((answer) => this.handleConversationApiSuccessRequest(answer));
        }
      } else {
        // TODO show error?
      }
    }
  }

  /**
   * @param audioData
   *
   * Step 2: Convert the recorded audio to text and send it to the API
   */
  async processInteraction(audioData: RecordedAudioOutput) {
    this.isLoading$.next(true);

    // send finished recording event to google analytics
    this.analyticsService.triggerEvent('Recording', 'RecordingStopped', this.conversationId$.value);

    // Upload the audio file to the server
    this.chargeGptAPI
      .convertSpeechToText(this.conversationId$.value, audioData.blob)
      .pipe(
        takeUntil(this.destroyed$),
        this.handleConversationApiRequestError(),
        switchMap(({ text }) => {
          this.chatHistoryView.push({ role: 'user', content: text });

          if (this.isAlwaysShareUserLocation) {
            this.handleExtraContextRequest(text);

            return of(null);
          } else {
            // Step 3: Submit the text to the API
            return this.submitUserResponse({ text }).pipe(
              tap((answer: Answer) =>
                // Step 4: Handle the response from the API
                this.handleConversationApiSuccessRequest(answer)
              )
            );
          }
        }),
        filter((val: any) => val !== null)
      )
      .subscribe();
  }

  async handleError(audioUrl: string): Promise<void> {
    this.isLoading$.next(false);
    this.isShowFeedback$.next(false);
    this.submittedFeedbackValue$.next(null);
    await this.speak(audioUrl);
  }

  async displayLocationResults(answer: Answer): Promise<Answer> {
    const locationsDetails = answer.results!.data!;

    if (locationsDetails.length > 0) {
      this.playSuccessfulSound = true;

      if (this.resultsList.length > 0) {
        this.mapCount = this.mapCount + 1;
      }

      this.chatHistoryView.push({
        role: answer.role,
        content: answer.prompt,
        mapCount: this.mapCount,
        isRequestOutOfScope: answer.isRequestOutOfScope,
      });

      this.resultsList = locationsDetails;

      await this.initMap({
        locationsDetails,
        destination: answer?.results?.destination,
        origin: answer.results?.origin,
        poi: answer.results?.poi,
        route: answer.results?.routes?.[0]?.legs?.[0]?.points ?? [],
      });

      setTimeout(() => {
        this.isShowFeedback$.next(true);
        this.playSuccessfulSound = false;
      }, 1000);
    }

    return answer;
  }

  resetChargeGPT() {
    // send reset event to google analytics
    this.analyticsService.triggerEvent('Reset', 'ResetTriggered', this.conversationId$.value);

    this.resultsList = [];
    this.navigationLink = undefined;
    this.chatHistoryView = [];
    this.isShowFeedback$.next(false);
    this.submittedFeedbackValue$.next(null);

    this.shuffleSuggestions();

    this.stopPlayAudio();

    this.abortAudioRecording();
    this.startConversation();

    this.showFirstSuggestions = true;
  }

  async speak(audioUrl: string): Promise<void> {
    return new Promise(async (resolve) => {
      if (!audioUrl) {
        return resolve();
      }

      this.pollyAudioSourceElement!.nativeElement.setAttribute('src', audioUrl as unknown as string);
      this.pollyAudioElement!.nativeElement.load();
      this.pollyAudioElement!.nativeElement.playbackRate = 1.3;

      try {
        await this.pollyAudioElement!.nativeElement.play();
      } catch {
        // NOOP
      }

      this.pollyAudioElement!.nativeElement.onended = async () => {
        this.pollyAudioElement!.nativeElement.onended = () => {};
        resolve();
      };
    });
  }

  startAudioRecording() {
    this.textFormControl.disable();

    if (!this.isAudioRecording) {
      this.stopPlayAudio();

      this.audioRecordingService.startRecording();
      this.audioRecordingService.getAudioRecording().subscribe((value) => {
        this.isAudioRecording = value;
      });
    }
  }

  abortAudioRecording() {
    this.textFormControl.enable();

    if (this.isAudioRecording) {
      this.isAudioRecording = false;
      this.audioRecordingService.abortRecording();
    }
  }

  stopAudioRecording() {
    this.textFormControl.enable();

    if (this.isAudioRecording) {
      this.audioRecordingService.stopRecording();
      this.isAudioRecording = false;
    }
  }

  stopPlayAudio() {
    if (this.pollyAudioElement?.nativeElement) {
      this.pollyAudioElement.nativeElement.pause();
    }
  }

  openLink(link: string) {
    window.open(link);
  }

  ngOnDestroy(): void {
    this.destroyed$.next(null);
    this.conversationId$.complete();
    this.abortAudioRecording();
  }

  submitFeedback(feedback: string): void {
    this.chargeGptAPI
      .submitFeedback(feedback, this.conversationId$.value)
      .pipe(
        takeUntil(this.destroyed$),
        catchError((error) => {
          this.handleError('');

          throw Error(`Error while submitting feedback ConversationID ${this.conversationId$.getValue()} : ${JSON.stringify(error)}`);
        })
      )
      .subscribe(() => {
        this.submittedFeedbackValue$.next(feedback);
      });
  }

  setSuggestionText(text: string) {
    this.textFormControl.setValue(text);
    this.showFirstSuggestions = false;
    this.myInputField.nativeElement.focus();
    this.submitText(text);
  }

  shuffleSuggestions() {
    this.translate.instant('suggestionTexts').sort(() => Math.random() - 0.5);
  };
}
