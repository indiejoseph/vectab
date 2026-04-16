import { Vectab } from './index';

// Expose to browser globals
(globalThis as unknown as Record<string, unknown>).Vectab = Vectab;
