import {mkdir,readFile,writeFile} from 'node:fs/promises';
await mkdir('dist',{recursive:true});
for(const file of ['index.html','src.js','style.css'])await writeFile('dist/'+file,await readFile(file));
console.log('Built RAIDBOUND → dist/');
