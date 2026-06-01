import { Component } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'chargegpt-web-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'chargegpt-web';

  constructor(
    private readonly translate: TranslateService
  ) {
    this.translate.addLangs(['en', 'de', 'es', 'fr', 'pt']);
    this.translate.setDefaultLang('de');
    this.translate.use('de');
  }
}
