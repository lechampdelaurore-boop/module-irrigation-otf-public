/**
 * Le logo du module (D-302) : copie exacte de `public/favicon.svg` de
 * l'application, que ce Worker à part ne peut pas lire. Le test du site
 * vérifie que les deux restent identiques : changer le logo, c'est changer
 * les deux.
 */
export const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="88 90 340 340">
<defs>
<linearGradient id="eau" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9ad8ff"/><stop offset="1" stop-color="#2a86d0"/></linearGradient>
<clipPath id="g"><path d="M256 92 C300 158 380 226 380 304 A124 124 0 1 1 132 304 C132 226 212 158 256 92Z"/></clipPath>
</defs>

<g clip-path="url(#g)">
<rect width="512" height="512" fill="url(#eau)"/>
<path d="M100 300 C170 272 240 318 300 296 C350 278 390 286 420 294 V520 H100Z" fill="#5cbf7f"/>
<path d="M100 346 C170 318 240 364 300 342 C350 324 390 332 420 340 V520 H100Z" fill="#2e9a62"/>
<path d="M100 392 C170 364 240 410 300 388 C350 370 390 378 420 386 V520 H100Z" fill="#0b694d"/>
<g fill="#fff" fill-opacity=".9"><circle cx="170" cy="318" r="7"/><circle cx="226" cy="322" r="7"/><circle cx="282" cy="314" r="7"/><circle cx="338" cy="304" r="7"/>
<circle cx="170" cy="364" r="7"/><circle cx="226" cy="368" r="7"/><circle cx="282" cy="360" r="7"/><circle cx="338" cy="350" r="7"/></g>
</g>
<path d="M188 250 C178 216 194 186 212 172" stroke="#fff" stroke-opacity=".6" stroke-width="14" stroke-linecap="round" fill="none"/>
</svg>
`;
