import test from 'node:test';
import assert from 'node:assert/strict';
import {createCloudApp} from '../server.mjs';
import {RemoteBrowser,findProxy} from '../browser.mjs';

test('real Chromium session starts, displays the demo and captures a search',{
 skip:process.env.EVENTQA_REAL_BROWSER!=='1',timeout:30000
},async()=>{
 let browser;
 class Browser extends RemoteBrowser{constructor(options){super(options);browser=this;}}
 const app=createCloudApp({Browser});
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const origin=`http://127.0.0.1:${app.server.address().port}`;
 let cookie='';
 async function api(route,data){
  const res=await fetch(origin+'/api/'+route,{method:data===undefined?'GET':'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)})});
  if(res.headers.get('set-cookie'))cookie=res.headers.get('set-cookie').split(';')[0];
  const result=await res.json();assert.equal(res.status,200,JSON.stringify(result));return result;
 }
 try{
  for(const mode of ['cdp',...(findProxy()?['proxy']:[])]){
   assert.equal((await api('start',{mode,demo:true})).active,true);
   assert.ok((await browser.frame()).data.length>1000);
   // Wait for the form, then perform the same action as the demo search button.
   let ready=false;
   for(let n=0;n<50;n++){
    ready=(await browser.control.send('Runtime.evaluate',{expression:'!!document.querySelector("#search")'})).result.value;
    if(ready)break;await new Promise(r=>setTimeout(r,100));
   }
   assert.ok(ready,'demo form loaded');
   await browser.control.send('Runtime.evaluate',{expression:'document.querySelector("#search").requestSubmit()'});
   let state;
   for(let n=0;n<50;n++){
    state=await api('state');
    if(state.events.some(e=>e.name==='search_submit'&&e.layer==='TRACKING_REQUEST'&&e.status===204))break;
    await new Promise(r=>setTimeout(r,100));
   }
   assert.ok(state.events.some(e=>e.name==='search_submit'&&e.layer==='TRACKING_REQUEST'&&e.status===204),`${mode}: search request received HTTP 204`);
   if(mode==='cdp')assert.ok(state.events.some(e=>e.name==='search_submit'&&e.layer==='JS_QUEUE'));
   assert.equal((await api('stop',{})).active,false);
  }
 }finally{await app.close();}
});

for(const mode of ['cdp',...(findProxy()?['proxy']:[])])test(`live UI ${mode}: clear expanded frames, typing and clicks survive lost SSE images and reload`,{
 skip:process.env.EVENTQA_REAL_BROWSER!=='1',timeout:45000
},async()=>{
 let remote;
 class Browser extends RemoteBrowser{constructor(options){super(options);remote=this;}}
 const app=createCloudApp({Browser});
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const origin=`http://127.0.0.1:${app.server.address().port}`;
 const viewer=new RemoteBrowser({emit(){},validateURL:async url=>url});
 const evaluate=async expression=>{
  const result=await viewer.control.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true}).catch(error=>{throw new Error(`UI evaluation ${expression.slice(0,140)}: ${error.message}`);});
  assert.equal(result.exceptionDetails,undefined,JSON.stringify(result.exceptionDetails));return result.result?.value;
 };
 const waitFor=async(expression,message)=>{
  for(let n=0;n<100;n++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}
  assert.fail(message);
 };
 try{
  await viewer.start();
  viewer.control.on('event',event=>{if(event.method==='Page.javascriptDialogOpening'&&event.params.type==='beforeunload')void viewer.control.send('Page.handleJavaScriptDialog',{accept:true});});
  // Model a connection that carries small state events but loses large images.
  await viewer.control.send('Page.addScriptToEvaluateOnNewDocument',{source:`
   const add=EventSource.prototype.addEventListener;
   EventSource.prototype.addEventListener=function(type,...args){if(type!=='frame')return add.call(this,type,...args);};
  `});
  await viewer.control.send('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false});
  await viewer.navigate(origin);
  await waitFor('document.querySelector("#connection")?.classList.contains("online") && !document.querySelector("#demo").disabled','UI ready');
  await evaluate(`document.querySelector('input[name=mode][value=${mode}]').click();document.querySelector('#demo').click()`);
  await waitFor('document.querySelector("#frame")?.naturalWidth===1280 && !document.querySelector("#frame").hidden','first image arrives over HTTP');
  await waitFor('document.querySelector("#session-title").textContent.includes("Đang thu thập")','session active');
  assert.ok(await evaluate('document.querySelector("#frame").getBoundingClientRect().width>1100'),'browser takes most of the desktop width');
  const normalWidth=await evaluate('document.querySelector("#frame").getBoundingClientRect().width');
  await evaluate('document.querySelector("#wide-screen").click()');
  assert.ok(await evaluate(`document.querySelector('#frame').getBoundingClientRect().width>${normalWidth}+200`),'expand gives the browser full width');
  assert.equal(await evaluate('document.querySelector("#wide-screen").getAttribute("aria-pressed")'),'true');
  const clickRemote=async point=>{
   await evaluate('document.querySelector("#screen").scrollIntoView({block:"center"})');
   const coords=await evaluate(`(()=>{const r=document.querySelector('#frame').getBoundingClientRect(),s=Math.min(r.width/1280,r.height/800);return{x:r.left+(r.width-1280*s)/2+${point.x}*s,y:r.top+(r.height-800*s)/2+${point.y}*s};})()`);
   await viewer.control.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...coords});
   await viewer.control.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...coords});
  };
  // Use physical pointer/key events in the UI so overlays and coordinate errors fail.
  let button;
  for(let n=0;n<100;n++){
   button=(await remote.control.send('Runtime.evaluate',{expression:'(()=>{const b=document.querySelector("#search button");if(!b)return null;const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()',returnByValue:true})).result?.value;
   if(button)break;await new Promise(r=>setTimeout(r,100));
  }
  assert.ok(button,'demo search loaded');
  const term=(await remote.control.send('Runtime.evaluate',{expression:'(()=>{const r=document.querySelector("#term").getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()',returnByValue:true})).result.value;
  await clickRemote(term);
  await viewer.control.send('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2});
  await viewer.control.send('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2});
  await evaluate('document.querySelector("#type-text").value="Hội An";document.querySelector("#type-form").requestSubmit()');
  const first=await evaluate('document.querySelector("#frame").src');
  await clickRemote(button);
  await waitFor('document.querySelector("#event-list").textContent.includes("search_submit")','remote click produces a visible search event');
  assert.equal((await remote.control.send('Runtime.evaluate',{expression:'document.querySelector("#term").value'})).result.value,'Hội An','typing reaches the selected remote input');
  await waitFor(`document.querySelector('#frame').src!==${JSON.stringify(first)}`,'HTTP fallback refreshes image after input');
  await evaluate('document.querySelector("#wide-screen").click()');
  assert.equal(await evaluate('document.querySelector("#wide-screen").getAttribute("aria-pressed")'),'false');
  await viewer.control.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,'mobile controls do not overflow');
  await viewer.control.send('Page.reload');
  await waitFor('document.querySelector("#frame")?.naturalWidth===1280 && !document.querySelector("#frame").hidden','reload restores active session image without SSE frames');
  assert.equal([...app.owners.values()].filter(o=>o.active).length,1,'reload reuses the same session');
 }finally{await viewer.stop();await app.close();}
});
