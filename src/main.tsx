import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { cssVariables, font } from './ui/tokens';
import './ui/styles.css';

const style = document.createElement('style');
style.textContent = `:root {\n${cssVariables()}\n--font: ${font};\n}`;
document.head.appendChild(style);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
