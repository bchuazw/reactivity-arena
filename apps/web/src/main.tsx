import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SomniaProvider } from './providers/SomniaProvider';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SomniaProvider>
      <App />
    </SomniaProvider>
  </StrictMode>,
);
