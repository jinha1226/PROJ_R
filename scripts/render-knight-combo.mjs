import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
const page=await browser.newPage({viewport:{width:512,height:512},deviceScaleFactor:1});
page.on('console',m=>console.log('browser:',m.text()));page.on('pageerror',e=>console.error('page error:',e.message));
await page.goto('http://127.0.0.1:4173/knight-combo.html');await page.waitForFunction(()=>window.comboReady===true,{timeout:60000});
const duration=await page.evaluate(()=>window.comboDuration);console.log('combo duration',duration);
mkdirSync('tmp/knight-combo-frames',{recursive:true});
const fps=16,frameCount=Math.ceil(duration*fps);for(let i=0;i<frameCount;i++){await page.evaluate(t=>window.renderComboFrame(t),i/fps);await page.locator('canvas').screenshot({path:'tmp/knight-combo-frames/frame-'+String(i).padStart(4,'0')+'.png'});}
await browser.close();
