import {mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import path from 'node:path';
async function copy(source,target) {
  await mkdir(target,{recursive:true});
  for(const file of await readdir(source,{withFileTypes:true})) {
    const from=path.join(source,file.name),to=path.join(target,file.name);
    if(file.isDirectory())await copy(from,to);
    else await writeFile(to,await readFile(from));
  }
}
await mkdir('dist',{recursive:true});
for(const file of ['index.html','src.js','battle-view.js','style.css'])await writeFile('dist/'+file,await readFile(file));
await copy('vendor','dist/vendor');
await copy('assets/models','dist/assets/models');
// Portrait art is used in the UI; the battlefield is rendered entirely in Three.js.
await mkdir('dist/assets',{recursive:true});
for(const asset of ['characters-v2.webp','stone-v3.webp'])await writeFile('dist/assets/'+asset,await readFile('assets/'+asset));
console.log('Built RAIDBOUND 3D → dist/');
