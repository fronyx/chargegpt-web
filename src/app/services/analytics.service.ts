import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  private ga: any;
  
  constructor() {
    this.initGoogleAnalytics();
  }

  initGoogleAnalytics(): boolean {
    if (!this.ga) {
      this.ga = (window as any).ga;
    }
    
    return !!this.ga;
  }

  sendPageView(url: string, conversationId: string): void {
    if (!this.isCookieConsented() || !this.initGoogleAnalytics()) {
      return;
    }
    this.ga('set', 'page', url);
    this.ga('send', 'pageview');
    this.ga('conversationId', conversationId);
  }
  
  triggerEvent(category: string, action: string, conversationId: string): void {
    if (!this.isCookieConsented() || !this.initGoogleAnalytics()) {  
      return;
    }  
    this.ga('send', 'event', category, action);
    this.ga('conversationId', conversationId);
  }

  getCookie(name: string): string {
    const re = new RegExp(name + "=([^;]+)");
    const value = re.exec(document.cookie);
    return (value != null) ? unescape(value[1]) : 'no';
  }

  isCookieConsented(): boolean {
    const consented = this.getCookie('cky-consent') === 'yes' && this.getCookie('cookieyes-analytics') === 'yes';
    if (consented) {
      document.cookie = `viewed_cookie_policy=yes;path=/;domain=${environment.COOKIE_DOMAIN}`;
    }
    return consented;
  }
}
