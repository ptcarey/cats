import './styles.css';
import { registerSW } from 'virtual:pwa-register';
import { mountApp } from './ui/app';

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app root element.');

// A game does not want the browser text menu or pinch zoom getting in the way.
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener(
  'dblclick',
  (e) => {
    e.preventDefault();
  },
  { passive: false },
);

mountApp(root);

// Picks up a new build on the next visit without prompting a child to update.
registerSW({ immediate: true });
