export interface Location {
  locationId: string;
  link: string;
  distance: number;
  probability?: number;
  primaryIds?: string[];
  lat: number;
  lng: number;
  powerType: string;
  powerKw: number;
  connectorType: string;
  recommendation?: string;
}
interface Route {
  legs: Leg[];
}

interface Leg {
  points: Point[];
}

export interface Point {
  latitude: number;
  longitude: number;
}

export interface Answer {
  conversationId: string;
  role: 'system' | 'user' | 'assistant';
  prompt: string;
  results?: {
    type: 'Destination' | 'Route';
    destination?: Address;
    data?: Location[];
    navigationLink?: string;
    origin?: Address;
    dateTime?: string;
    powerType?: string;
    operatorName?: string;
    poi?: Address;
    routes?: Route[];
  };
  metaData?: MetaData;
  isClosed: boolean;
  audioUrl: string;
  responseId: string;
  isRequestOutOfScope: boolean;
  lastUserInput?: string;
  provideContext?: string;
  versionNumber?: string;
}
export interface Address {
  address: string;
  city?: string;
  countryCode?: string;
  coordinates: Coordinates;
}

export interface Coordinates {
  lat?: string;
  lng?: string;
}

export interface MetaData {
  dateTime?: string;
  powerType?: string;
  destination?: Address;
  operatorName?: string;
  isCharacterLimitReached?: boolean,
  isContainsBlockedTerm?: boolean,
  helpLevel?: string;
}