import {spawn} from 'node:child_process';
import {mkdir,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {createRequire} from 'node:module';
import path from 'node:path';
const WebSocketClient=globalThis.WebSocket||createRequire(import.meta.url)('undici').WebSocket;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const port=Number(process.env.TEST_PORT||5187),debugPort=Number(process.env.TEST_DEBUG_PORT||9237);
const profile=await mkdtemp(path.join(tmpdir(),'raidbound-chrome-'));
const cleanEnv={...process.env};delete cleanEnv.DISPLAY;delete cleanEnv.WAYLAND_DISPLAY;
const server=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:String(port)},stdio:'ignore'});
const browser=spawn(process.env.CHROME_BIN||'google-chrome',['--headless=new','--disable-background-timer-throttling','--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding','--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ozone-platform=headless',`--user-data-dir=${profile}`,`--remote-debugging-port=${debugPort}`,'--window-size=1440,1100','about:blank'],{env:cleanEnv,stdio:'ignore'});
let socket;let launchError;browser.on('error',e=>launchError=e);server.on('error',e=>launchError=e);
const assert=(condition,message)=>{if(!condition)throw Error(message)};
try {
 let tabs;
 for(let i=0;i<60;i++){if(launchError)throw launchError;try{tabs=await fetch(`http://127.0.0.1:${debugPort}/json/list`).then(r=>r.json());await fetch(`http://127.0.0.1:${port}/`);break}catch{await sleep(250)}}
 assert(tabs,'Chrome did not start');socket=new WebSocketClient(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve);socket.addEventListener('error',reject)});
 let id=0;const pending=new Map(),errors=[];
 socket.addEventListener('message',e=>{const d=JSON.parse(e.data);if(d.id){const p=pending.get(d.id);if(p){pending.delete(d.id);clearTimeout(p.timer);d.error?p.reject(Error(JSON.stringify(d.error))):p.resolve(d.result)}}else if(d.method==='Runtime.exceptionThrown')errors.push(JSON.stringify(d.params.exceptionDetails));else if(d.method==='Runtime.consoleAPICalled'&&d.params.type==='error')errors.push(d.params.args.map(a=>a.description||a.value).join(' '));});
 const call=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;const timer=setTimeout(()=>{pending.delete(n);reject(Error('Timeout: '+method))},30000);pending.set(n,{resolve,reject,timer});socket.send(JSON.stringify({id:n,method,params}))});
 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value};
 const state=()=>evaluate('window.__raidbound.inspect()');
 const waitFor=async(predicate,message)=>{for(let i=0;i<100;i++){const s=await state();if(predicate(s))return s;await sleep(200)}throw Error(message+'; state='+JSON.stringify(await state()))};
 const screenshot=async file=>{const r=await call('Page.captureScreenshot',{format:'png'});await writeFile('test-artifacts/'+file,Buffer.from(r.data,'base64'))};
 await mkdir('test-artifacts',{recursive:true});await call('Runtime.enable');await call('Page.enable');await call('Page.navigate',{url:`http://127.0.0.1:${port}/`});await call('Page.bringToFront');
 for(let i=0;i<80;i++){if(await evaluate('!!window.__raidbound?.inspect()?.renderer'))break;await sleep(250)}
 assert((await state()).renderer==='Three.js','Three.js renderer must initialize');assert((await state()).models===5,'Five 3D hero models');for(let i=0;i<80;i++){if((await state()).authoredModels===5)break;await sleep(250)}assert((await state()).authoredModels===5,'Five animated model assets must load');await sleep(1000);await screenshot('desktop.png');
 const before=await state();await evaluate('document.querySelector("[data-member=\\"2\\"]").click()');const mage=await waitFor(s=>s.selected===2&&s.hero===2&&Math.abs(s.camera[0]-before.camera[0])>.5,'Selected hero camera did not settle');
 assert(mage.selected===2&&mage.hero===2,'Selection must switch follow camera');assert(Math.abs(mage.camera[0]-before.camera[0])>.5,'Camera must move to selected hero');
 const pick=await evaluate('(()=>{const r=document.querySelector("#arena").getBoundingClientRect(),p=window.__raidbound.screenPosition(4);return{x:r.left+p.x,y:r.top+p.y}})()');
 await call('Input.dispatchMouseEvent',{type:'mousePressed',x:pick.x,y:pick.y,button:'left',clickCount:1});await call('Input.dispatchMouseEvent',{type:'mouseReleased',x:pick.x,y:pick.y,button:'left',clickCount:1});await waitFor(s=>s.selected===4&&s.hero===4,'Raycasting must select a 3D hero');
 await evaluate('document.querySelector("#start").click()');await waitFor(s=>s.running&&s.time>0,'Combat must start');const previousX=(await state()).party[4].x;
 await call('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowLeft',code:'ArrowLeft',windowsVirtualKeyCode:37});await waitFor(s=>s.party[4].x<previousX-.002,'Selected hero must move with arrow keys');await call('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowLeft',code:'ArrowLeft',windowsVirtualKeyCode:37});
 console.log('Movement check',previousX,(await state()).party[4].x);assert((await state()).party[4].x<previousX,'Arrow keys must move selected hero');
 await evaluate('document.querySelector("#pause").click()');const t=(await state()).time;await sleep(400);assert((await state()).time===t,'Tactical pause must freeze combat');
 await evaluate('document.querySelector("#camera-mode").click()');await sleep(500);assert((await state()).overview,'Overview button');await evaluate('document.querySelector("#camera-reset").click()');await sleep(500);assert(!(await state()).overview,'Camera reset restores follow mode');
 await screenshot('battle.png');await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await sleep(500);assert(!await evaluate('document.documentElement.scrollWidth>innerWidth'),'No mobile horizontal overflow');await screenshot('mobile.png');
 assert(errors.length===0,errors.join('\n'));console.log('PASS Three.js rendering, five hero models, follow camera, raycast selection, movement, pause, overview, mobile layout');
} finally {socket?.close();browser.kill();server.kill();await sleep(200);await rm(profile,{recursive:true,force:true})}
