import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app/app.module';
import * as Sentry from '@sentry/angular-ivy';
import { environment } from './environments/environment';

if (environment.IS_PROD && !!environment.SENTRY_DSN) {
  Sentry.init({
    dsn: environment.SENTRY_DSN,
    integrations: [
      new Sentry.Replay(),
    ],
    enableTracing: false,
    beforeSend: (event, hint) => {
      const error = hint.originalException;

      if (isLogWorthy(error)) {
        return event;
      }

      return event;
    },
  });
}

function isLogWorthy(error: unknown) {
  return !(error as any).message.includes('play')
    && !(error as any).message.includes('processing interaction');
}

platformBrowserDynamic()
  .bootstrapModule(AppModule)
  .catch((err) => console.error(err));
