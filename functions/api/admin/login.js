const json=(d,s=200,headers={})=>new Response(JSON.stringify(d),{status:s,headers:{'content-type':'application/json','cache-control':'no-store',...headers}});
export async function onRequestPost({request,env}) {
  if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) return json({error:'Yönetim paneli henüz yapılandırılmadı.'},503);
  const origin=request.headers.get('Origin'); if(origin && origin!==new URL(request.url).origin) return json({error:'Kaynak doğrulanamadı.'},403);
  const body=await request.json().catch(()=>null); if(!body || typeof body.password!=='string') return json({error:'Şifre gerekli.'},400);
  if(!constantTimeEqual(body.password,env.ADMIN_PASSWORD)) return json({error:'Şifre hatalı.'},401);
  const payload=btoa(JSON.stringify({exp:Date.now()+8*60*60*1000,sub:'admin'})).replace(/=/g,'');
  const sig=await sign(payload,env.SESSION_SECRET);
  return json({ok:true},200,{'set-cookie':`he_admin=${payload}.${sig}; HttpOnly; Secure; SameSite=Strict; Path=/api/admin; Max-Age=28800`});
}
async function sign(v,s){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(s),{name:'HMAC',hash:'SHA-256'},false,['sign']);const out=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(v));return btoa(String.fromCharCode(...new Uint8Array(out))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');}
function constantTimeEqual(a,b){if(a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0;}
