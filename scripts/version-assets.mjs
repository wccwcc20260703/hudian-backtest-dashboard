import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'../docs'),versions=new Map(),visiting=new Set();
const hash=text=>createHash('sha256').update(text).digest('hex').slice(0,12);
function version(file){
 if(versions.has(file))return versions.get(file);
 if(visiting.has(file))throw Error(`Circular module import: ${file}`);
 visiting.add(file);
 const original=readFileSync(file,'utf8');
 const updated=original.replace(/(from\s*['"])(\.\.?\/[^'"?]+\.js)(?:\?v=[^'"]+)?(['"])/g,
  (_,prefix,path,suffix)=>`${prefix}${path}?v=${version(resolve(dirname(file),path))}${suffix}`);
 if(updated!==original)writeFileSync(file,updated);
 visiting.delete(file);versions.set(file,hash(updated));return versions.get(file);
}
const app=version(resolve(root,'app.js')),css=hash(readFileSync(resolve(root,'style.css')));
const path=resolve(root,'index.html'),original=readFileSync(path,'utf8');
let html=original.replace(/src="app\.js(?:\?v=[^"]+)?"/,`src="app.js?v=${app}"`)
 .replace(/href="style\.css(?:\?v=[^"]+)?"/,`href="style.css?v=${css}"`);
const label=`<span id="page-version">页面版本 ${app}</span>`;
html=html.includes('id="page-version"')?html.replace(/<span id="page-version">[^<]*<\/span>/,label):html.replace('</footer>',`${label}</footer>`);
if(html!==original)writeFileSync(path,html);
console.log(`Versioned ${versions.size} modules and stylesheet; page version ${app}.`);

const starApp=version(resolve(root,'star50/app.js')),starPath=resolve(root,'star50/index.html');
const starHtml=readFileSync(starPath,'utf8').replace(/src="app\.js(?:\?v=[^"]+)?"/,`src="app.js?v=${starApp}"`);
writeFileSync(starPath,starHtml);console.log(`STAR50 page version ${starApp}.`);

const bandApp=version(resolve(root,'research/band-overlay.js')),bandPath=resolve(root,'research/band-overlay.html');
writeFileSync(bandPath,readFileSync(bandPath,'utf8').replace(/src="band-overlay\.js(?:\?v=[^"]+)?"/,`src="band-overlay.js?v=${bandApp}"`));console.log(`Experimental page version ${bandApp}.`);
