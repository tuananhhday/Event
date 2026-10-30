import net from 'node:net';
import dns from 'node:dns/promises';
export function publicIP(ip){
 if(net.isIP(ip)===4){const[a,b]=ip.split('.').map(Number);return ![0,10,127].includes(a)&&!(a===169&&b===254)&&!(a===172&&b>=16&&b<=31)&&!(a===192&&b===168)&&!(a===100&&b>=64&&b<=127)&&a<224;}
 if(net.isIP(ip)===6)return !/^(::|::1|::ffff:|f[cd]|fe[89ab])/i.test(ip);
 return false;
}
export async function validateTarget(value,{allowedHosts=[],lookup=dns.lookup,demoOrigin}={}){
 let u;try{u=new URL(value);}catch{throw new Error('Nhập URL đầy đủ, ví dụ https://example.com.');}
 if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw new Error('Chỉ hỗ trợ URL HTTP/HTTPS không kèm tài khoản trong địa chỉ.');
 if(demoOrigin&&u.origin===demoOrigin&&/^\/demo(?:\/|$)/.test(u.pathname))return u.href;
 if(u.port&&!['80','443'].includes(u.port))throw new Error('Chỉ hỗ trợ website trên cổng HTTP/HTTPS tiêu chuẩn.');
 const host=u.hostname.replace(/^\[|\]$/g,'');
 if(allowedHosts.length&&!allowedHosts.some(x=>host===x||host.endsWith('.'+x)))throw new Error('Website chưa nằm trong danh sách website được quản trị viên cho phép.');
 const addresses=net.isIP(host)?[{address:host}]:await lookup(host,{all:true});
 if(!addresses.length||addresses.some(x=>!publicIP(x.address)))throw new Error('Địa chỉ này không truy cập được từ môi trường cloud hoặc là địa chỉ nội bộ.');
 u.hash='';return u.href;
}
export const safeOwnerCookie = header => /(?:^|;\s*)eventqa_owner=([a-f0-9]{64})(?:;|$)/.exec(header??'')?.[1];
