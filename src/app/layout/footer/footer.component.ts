import { Component } from '@angular/core';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'chargegpt-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss']
})
export class FooterComponent {
  environment = environment;
  year = 0;
  constructor() {
    this.year = new Date().getFullYear();
  }
}
