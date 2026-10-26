import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { I18nProvider } from './i18n';
import { StoreProvider } from './store';
import { AccessGate } from './components/AccessGate';
import './styles.css';

registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <AccessGate>
        <StoreProvider>
          <App />
        </StoreProvider>
      </AccessGate>
    </I18nProvider>
  </StrictMode>,
);
