// Arma la carpeta SUBIR-A-NETLIFY/ con el sitio listo para arrastrar a https://app.netlify.com/drop
// Uso: npm run netlify:carpeta
//
// Ojo: una subida por arrastre publica solo la página. Las funciones de cobro (api/) no se instalan,
// así que el botón de pagar muestra un aviso. Para cobrar, conectá Netlify con el repo de GitHub.
import { cpSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'SUBIR-A-NETLIFY');

rmSync(out, { recursive: true, force: true });
cpSync(join(root, 'public'), out, { recursive: true });

// Rutas lindas (/gracias, /puerta), igual que en netlify.toml.
writeFileSync(join(out, '_redirects'), '/gracias  /gracias.html  200\n/puerta   /puerta.html   200\n');

console.log(`Listo: ${out}`);
console.log('Arrastrá esa carpeta a https://app.netlify.com/drop');
