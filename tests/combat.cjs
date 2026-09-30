const fs=require('fs'),vm=require('vm');
const seededMath=Object.create(Math);let seed=1226;seededMath.random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
const elements=new Map();const context=new Proxy({createRadialGradient:()=>({addColorStop(){}})}, {get:(o,k)=>o[k]||(()=>{})});
function el(s){if(!elements.has(s))elements.set(s,{innerHTML:'',textContent:'',style:{},classList:{toggle(){}},getBoundingClientRect:()=>({width:700,height:505,left:0,top:0}),getContext:()=>context});return elements.get(s)}
const sandbox={createBattleView:()=>({draw(){},center(){},inspect(){return{}},moveDirection(x,y){return{x,y}}}),Math:seededMath,console,performance:{now:()=>0},document:{querySelector:s=>s==='.overlay'?null:el(s),querySelectorAll:()=>[]},window:{devicePixelRatio:1,addEventListener(){},scrollTo(){}},requestAnimationFrame(){}};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync('src.js','utf8').replace(/^import .*;\n/,''),sandbox);
vm.runInContext(`
function assert(v,msg){if(!v)throw Error(msg)}
assert(party.length===5,'five heroes');draw();
for(let boss=0;boss<3;boss++){
bi=boss;reset();eventIndex=0;running=true;
let seenPhase=0;
for(let k=0;k<2400&&running;k++){
if(cast&&cool[0]===0)command(0);
if(party.some(p=>p.debuff>0)&&cool[1]===0)command(1);
if(adds.length&&cool[3]===0)command(3);
if(phase===2&&cool[2]===0)command(2);
if(!adds.length&&cool[3]===0)command(3);
if(zones.length)dodge();
update(.1);seenPhase=Math.max(seenPhase,phase);
}
assert(won,'boss '+boss+' should be defeatable with correct commands');assert(seenPhase===2,'three phases');console.log('PASS boss',boss+1,'victory',fmt(time));
}
reset();running=true;paused=true;update(2);assert(time===0,'pause freezes battle');paused=false;cast={t:4,max:4};command(0);assert(cast===null&&cool[0]>0,'interrupt');party[1].debuff=8;command(1);assert(party[1].debuff===0,'cleanse');command(2);assert(shield===8,'protection');console.log('PASS pause, interrupt, cleanse, shield');
`,sandbox);
