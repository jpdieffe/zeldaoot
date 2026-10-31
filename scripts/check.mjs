import {readdirSync,readFileSync} from 'node:fs';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';
for(const directory of ['site','scripts','tests'])for(const file of readdirSync(directory)){if(!/\.(m?js)$/.test(file))continue;const check=spawnSync(process.execPath,['--check',directory+'/'+file],{stdio:'inherit'});if(check.status)process.exit(check.status);}
for(const file of ['index.html','play.html','credits.html']){const html=readFileSync('site/'+file,'utf8');for(const[,asset]of html.matchAll(/(?:src|href)="\.\/([^"#]+)"/g))readFileSync('site/'+asset);}
const engine=JSON.parse(readFileSync('site/engine-manifest.json','utf8'));
if(!/^[a-f0-9]{40}$/.test(engine.projectBuildCommit))throw Error('Install a completed custom native engine before publishing.');
const native=readFileSync('site/engine/soh.js','utf8');for(const name of ['_together_state','_together_restart','_together_meet','_together_debug'])if(!native.includes(name))throw Error('Missing native multiplayer export: '+name);
for(const[name,pin]of Object.entries(engine.files)){const bytes=readFileSync('site/engine/'+name);if(bytes.length!==pin.bytes||createHash('sha256').update(bytes).digest('hex')!==pin.sha256)throw Error('Engine mismatch: '+name);}
const game=JSON.parse(readFileSync('site/game-manifest.json','utf8')),archive=Buffer.concat(game.archive.parts.map(p=>readFileSync('site/'+p)));if(archive.length!==game.archive.bytes||createHash('sha256').update(archive).digest('hex')!==game.archive.sha256)throw Error('Game archive mismatch');
console.log('Syntax, page assets, engine pins and game archive verified.');
