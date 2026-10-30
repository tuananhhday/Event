import test from 'node:test';
import assert from 'node:assert/strict';
import {RemoteBrowser} from '../browser.mjs';

test('first frame survives a renderer detaching during navigation',async()=>{
 const browser=new RemoteBrowser({emit(){},validateURL:async url=>url});
 let attempts=0;
 browser.control={async send(){if(++attempts===1)throw new Error('Page.captureScreenshot: Not attached to an active page');return{data:'jpeg'};}};
 assert.equal((await browser.frame()).data,'jpeg');
 assert.equal(attempts,2);
});
test('screenshot failures other than navigation are surfaced',async()=>{
 const browser=new RemoteBrowser({emit(){},validateURL:async url=>url});
 browser.control={async send(){throw new Error('CDP connection is closed.');}};
 await assert.rejects(()=>browser.frame(),/CDP connection is closed/);
});
test('navigation failures are reported instead of showing a browser error page as success',async()=>{
 const browser=new RemoteBrowser({emit(){},validateURL:async url=>url});
 browser.control={async send(){return{errorText:'net::ERR_NAME_NOT_RESOLVED'};}};
 await assert.rejects(()=>browser.navigate('https://invalid.test'),/ERR_NAME_NOT_RESOLVED/);
});
