import { createRoot } from 'react-dom/client';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import '@fontsource/roboto-serif/400.css';
import '@fontsource/roboto-serif/600.css';
import '@fontsource/roboto-serif/700.css';
import 'material-symbols/rounded.css';
import './styles/tokens.css';
import './styles/app.css';
import './styles/draft.css';
import { App } from './components/App';

createRoot(document.getElementById('root')!).render(<App />);
