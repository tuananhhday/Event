import fs from 'node:fs/promises';
const html=await fs.readFile(new URL('../dist/index.html',import.meta.url),'utf8');
const css=await fs.readFile(new URL('../dist/styles.css',import.meta.url),'utf8');
const modules=await Promise.all(['core','sheets','demo','app'].map(async name=>(await fs.readFile(new URL(`../dist/${name}.mjs`,import.meta.url),'utf8')).replace(/^import .*?;\s*$/gm,'').replace(/^export /gm,'')));
const script=[modules[0],modules[1],modules[2],'const h = escapeHtml;',modules[3]].join('\n');
// Imported aliases are explicit so the standalone file needs no network imports.
const bundled=html.replace('<link rel="icon" href="./favicon.svg" type="image/svg+xml">','').replace('<link rel="stylesheet" href="./styles.css">',`<style>${css}</style>`).replace('<script type="module" src="./app.mjs"></script>',`<script type="module">\n${script}\n</script>`);
await fs.writeFile(new URL('../Event_Tracking_QA_Standalone.html',import.meta.url),bundled);
await fs.writeFile(new URL('../dist/Event_Tracking_QA_Standalone.html',import.meta.url),bundled);
console.log('Created standalone HTML in project root and dist/');
