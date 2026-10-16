/* Shared prospecting rules: WhatsApp is a phone-format hint, never verified availability. */
(function (root) {
  'use strict';
  const whatsapp = phone => { let d=String(phone||'').replace(/\D/g,''); if(d.startsWith('55')&&d.length>=12)d=d.slice(2); return d.length===11&&d[2]==='9'; };
  function matches(row, filters) {
    for (const key of ['phone','website','whatsapp','email']) {
      const value = key==='whatsapp' ? whatsapp(row.phone) : key==='email' ? /@/.test(row.emails||'') : !!String(row[key]||'').trim();
      if(filters[key]==='yes'&&!value || filters[key]==='no'&&value)return false;
    }
    if(filters.rating) { const rating=Number(row.review_rating); if(!rating || rating>=Number(filters.rating))return false; }
    return true;
  }
  async function enrichment(job, rows) {
    const r=await fetch('/enrichment/'+job,{cache:'no-store'});
    if(!r.ok)throw Error('Não foi possível carregar os e-mails salvos.');
    const data=await r.json();
    rows.forEach((row,i)=> { if(data.rows[String(i)]) { row.emails=data.rows[String(i)].emails; row.email_status=data.rows[String(i)].status; } });
    return data;
  }
  function locationDefault(apply) {
    const input=document.querySelector('#location'), hint=document.querySelector('#geo-status');
    let generation=0;
    input.placeholder='Sua cidade ou outro local';
    const button=document.createElement('button'); button.type='button';button.className='location-button';button.textContent='Usar minha localização';(input.closest('.search-group') || input).after(button);
    const tip=document.createElement('small');tip.className='location-tip';tip.textContent='Cidade, bairro, CEP ou código do aeroporto (ex.: VIX).';button.after(tip);
    input.addEventListener('input',()=>generation++);
    async function locate() {
      const version=++generation;
      if(!isSecureContext || !navigator.geolocation) { hint.textContent='Para usar sua localização, abra o endereço HTTPS privado. Você também pode digitar qualquer local.';return; }
      button.disabled=true;hint.textContent='Aguardando localização do navegador…';
      navigator.geolocation.getCurrentPosition(async position=> {
        try {
          const lat=position.coords.latitude.toFixed(4),lon=position.coords.longitude.toFixed(4);
          let label=lat+', '+lon;
          try {
            const r=await fetch('https://nominatim.openstreetmap.org/reverse?format=json&zoom=14&accept-language=pt-BR&lat='+lat+'&lon='+lon);
            if(r.ok) { const a=(await r.json()).address||{};label=[a.suburb||a.neighbourhood,a.city||a.town||a.village,a.state].filter(Boolean).join(', ')||label; }
          } catch {}
          if(version!==generation)return;
          input.value=label;const g={lat,lon,label};localStorage.setItem('ms:home',JSON.stringify(g));apply(g);hint.textContent='📍 '+label+' · Você pode alterar o local.';
        } finally {button.disabled=false;}
      },()=> { button.disabled=false;if(version===generation)hint.textContent='Localização indisponível ou não autorizada. Digite o local desejado.'; },{enableHighAccuracy:false,timeout:10000,maximumAge:300000});
    }
    button.addEventListener('click',locate);
    try {const saved=JSON.parse(localStorage.getItem('ms:home'));if(saved&&!input.value){input.value=saved.label;apply(saved);}}catch{}

  }
  const api={matches,whatsapp,enrichment,locationDefault};
  if(typeof module!=='undefined')module.exports=api;else root.Prospecting=api;
})(typeof window==='undefined'?globalThis:window);


