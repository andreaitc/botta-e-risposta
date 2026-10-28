import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global error handler to suppress benign abort errors
window.addEventListener('unhandledrejection', (event) => {
  const error = event.reason;
  if (
    error?.name === 'AbortError' || 
    error?.message === 'Aborted' || 
    error?.message?.includes('user aborted') ||
    error?.message?.includes('signal is aborted') ||
    error?.message?.includes('The user aborted a request') ||
    error?.message?.includes('signal is aborted without reason')
  ) {
    event.preventDefault();
    // Silent ignore
  }
});

window.addEventListener('error', (event) => {
  const error = event.error;
  if (
    error?.name === 'AbortError' || 
    error?.message === 'Aborted' || 
    error?.message?.includes('user aborted') ||
    error?.message?.includes('signal is aborted') ||
    error?.message?.includes('The user aborted a request') ||
    error?.message?.includes('signal is aborted without reason')
  ) {
    event.preventDefault();
    // Silent ignore
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
