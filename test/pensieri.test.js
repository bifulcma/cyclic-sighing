// Test dei pensieri della notte: dati e rotazione per data. Nessuna dipendenza.
// Uso:  node test/pensieri.test.js      (meglio anche con TZ=Europe/Monaco e un altro fuso)
const fs=require('fs'),path=require('path'),vm=require('vm');
const DIR=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(DIR,'index.html'),'utf8');
const m=html.match(/\/\* ─+ PENSIERI: inizio ─+ \*\/([\s\S]*?)\/\* ─+ PENSIERI: fine ─+ \*\//);
let passati=0,falliti=0;
const ok=(c,msg)=>{if(c){passati++;console.log('  ✓',msg);}else{falliti++;console.log('  ✗',msg);}};
if(!m){console.log('  ✗ blocco PENSIERI non trovato in index.html');process.exit(1);}
const {PENSIERI,giornoNotte,indicePensiero,CAMBIO_NOTTE}=vm.runInNewContext(m[1]+';({PENSIERI,giornoNotte,indicePensiero,CAMBIO_NOTTE})');
const N=PENSIERI.length;

console.log('\nDati');
ok(N>=60,`${N} pensieri (minimo 60)`);
const CAMPI=['id','autore','fonte','tipo','testo','notte'];
const vuoti=PENSIERI.flatMap((p,i)=>CAMPI.filter(k=>typeof p[k]!=='string'||!p[k].trim()).map(k=>`#${i+1}.${k}`));
ok(!vuoti.length,'nessun campo vuoto'+(vuoti.length?': '+vuoti.join(', '):''));
const ignoti=PENSIERI.flatMap((p,i)=>Object.keys(p).filter(k=>!CAMPI.includes(k)&&k!=='audio').map(k=>`#${i+1}.${k}`));
ok(!ignoti.length,'solo campi previsti (più audio facoltativo)'+(ignoti.length?': '+ignoti.join(', '):''));
const audioMale=PENSIERI.filter(p=>'audio'in p&&(typeof p.audio!=='string'||!/^[\w.-]+\.mp3$/.test(p.audio)));
ok(!audioMale.length,'campo audio, se c’è, è un nome di file .mp3');
const ids=PENSIERI.map(p=>p.id),dup=ids.filter((x,i)=>ids.indexOf(x)!==i);
ok(!dup.length,'nessun id duplicato'+(dup.length?': '+dup.join(', '):''));
ok(ids.every(x=>/^[a-z0-9-]+$/.test(x)),'id in minuscolo, senza spazi');
const tipi=PENSIERI.filter(p=>p.tipo!=='citazione'&&p.tipo!=='parafrasi');
ok(!tipi.length,'tipo sempre "citazione" o "parafrasi"');
const lunghi=PENSIERI.filter(p=>p.testo.length>330||p.notte.length>110);
ok(!lunghi.length,'testi entro 330 caratteri, consegne entro 110'+(lunghi.length?': '+lunghi.map(p=>p.id).join(', '):''));
const virgolette=PENSIERI.filter(p=>/^[«"“]|[»"”]$/.test(p.testo));
ok(!virgolette.length,'niente virgolette attorno al testo (le aggiunge la schermata alle citazioni)');
const nCit=PENSIERI.filter(p=>p.tipo==='citazione').length;
console.log(`     ${nCit} citazioni, ${N-nCit} parafrasi, ${new Set(PENSIERI.map(p=>p.autore)).size} autori o fonti`);

console.log('\ndocs/FONTI.md');
const md=fs.readFileSync(path.join(DIR,'docs','FONTI.md'),'utf8');
const righe=md.split('\n').filter(r=>/^\|\s*\d+\s*\|/.test(r)).map(r=>r.split('|').slice(1,-1).map(c=>c.trim()));
ok(righe.length===N,`una riga per pensiero (${righe.length} righe, ${N} pensieri)`);
const diverse=PENSIERI.map((p,i)=>{const r=righe[i];return !r||+r[0]!==i+1||r[1]!=='`'+p.id+'`'||r[4]!==p.tipo||!r[5]?`#${i+1} ${p.id}`:null;}).filter(Boolean);
ok(!diverse.length,'numero, id e tipo coincidono con index.html, verifica sempre compilata'+(diverse.length?': '+diverse.slice(0,5).join(', '):''));

console.log('\nRotazione per data locale (fuso '+(Intl.DateTimeFormat().resolvedOptions().timeZone||'?')+')');
const alle=(y,mo,d,h,mi=0)=>new Date(y,mo-1,d,h,mi);
let stessa=true,cambia=true;
for(let k=0;k<400;k++){
 const d=new Date(2026,0,1+k),y=d.getFullYear(),mo=d.getMonth()+1,g=d.getDate(),i=indicePensiero(alle(y,mo,g,12));
 const sera=[alle(y,mo,g,CAMBIO_NOTTE),alle(y,mo,g,8),alle(y,mo,g,19),alle(y,mo,g,23,59),alle(y,mo,g+1,0,30),alle(y,mo,g+1,CAMBIO_NOTTE-1,59)];
 if(!sera.every(t=>indicePensiero(t)===i))stessa=false;
 if(indicePensiero(alle(y,mo,g+1,CAMBIO_NOTTE))===i)cambia=false;
}
ok(stessa,`stesso giorno, stesso pensiero: dalle ${CAMBIO_NOTTE}:00 alle ${CAMBIO_NOTTE-1}:59 del mattino dopo (400 giorni)`);
ok(cambia,`alle ${CAMBIO_NOTTE}:00 arriva il pensiero nuovo`);
let consecutivi=true,salti=true,gapMin=Infinity;const ult=new Map();
for(let k=0;k<1200;k++){
 const d=new Date(2025,11,1+k,12);
 if(giornoNotte(d)-giornoNotte(new Date(2025,11,k,12))!==1)salti=false;   // anche nei giorni del cambio d'ora
 const fin=new Set();for(let j=0;j<14;j++)fin.add(indicePensiero(new Date(2025,11,1+k+j,21)));
 if(fin.size!==14)consecutivi=false;
 const i=indicePensiero(d);if(ult.has(i))gapMin=Math.min(gapMin,k-ult.get(i));ult.set(i,k);
}
ok(consecutivi,'14 giorni consecutivi danno sempre 14 pensieri diversi (1200 finestre, Capodanno e cambi d’ora compresi)');
ok(salti,'ogni giorno avanza di uno, anche col cambio dell’ora legale');
ok(gapMin===N,`un pensiero torna solo dopo ${gapMin} giorni (= numero dei pensieri)`);
const stessoAutore=PENSIERI.map((p,i)=>p.autore===PENSIERI[(i+1)%N].autore?`${i+1}→${(i+1)%N+1}`:null).filter(Boolean);
ok(!stessoAutore.length,'due notti di fila mai con lo stesso autore'+(stessoAutore.length?': '+stessoAutore.join(', '):''));

console.log(`\nRisultato: ${passati} ok, ${falliti} falliti`);
if(!falliti)console.log('PENSIERI_OK');
process.exit(falliti?1:0);
