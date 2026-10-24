/* A separate, static Pages demo. Never packages environment files or deployment keys. */
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||path.join(root,'preview-dist'));
if(out===root||!out.includes('preview'))throw Error('Use a dedicated preview output directory');
fs.mkdirSync(out,{recursive:true});
for(const name of ['assets','css','js','kor'])fs.cpSync(path.join(root,name),path.join(out,name),{recursive:true});
for(const name of ['favicon.ico','LICENSE','LICENSE-NONCOMMERCIAL.md','CREDITS.md','version.json'])fs.copyFileSync(path.join(root,name),path.join(out,name));
const html=fs.readFileSync(path.join(root,'dev.html'),'utf8');
const begin=html.indexOf('<!-- scripts:begin -->'),end=html.indexOf('<!-- scripts:end -->');
const files=[...html.slice(begin,end).matchAll(/<script[^>]*src="((?:js|kor)\/[^"?]+\.js)"/g)].map(m=>m[1]);
const joined=files.map(file=>{
  let code=fs.readFileSync(path.join(root,file),'utf8');
  if(file==='js/main.js'){
    code=code.replace("if ('serviceWorker' in navigator && location.protocol.startsWith('http'))",'if (false)');
    code=fs.readFileSync(path.join(root,'preview/public.js'),'utf8')+'\n;\n'+code;
  }
  return '/* '+file+' */\n'+code;
}).join('\n;\n');
const temp=path.join(out,'preview-source.js');fs.writeFileSync(temp,joined);
cp.execFileSync(path.join(root,'node_modules/.bin/terser'),[temp,'--compress','passes=1','--mangle','--ecma','2020','-o',path.join(out,'js/preview-game.js')],{stdio:'inherit'});
fs.unlinkSync(temp);
const revision=crypto.createHash('sha256').update(fs.readFileSync(path.join(out,'js/preview-game.js'))).digest('hex').slice(0,12);
let index=html.slice(0,begin)+'<script defer src="js/preview-game.js?v='+revision+'"></script>'+html.slice(end+'<!-- scripts:end -->'.length);
index=index.replace('<title>PokéSurvivor 한국어 독립판</title>','<title>아머드뮤츠 공개 테스트 · PokéSurvivor</title>')
 .replace('<link rel="manifest" href="manifest.webmanifest">','')
 .replace('<link rel="preconnect" href="https://www.gstatic.com" crossorigin>','')
 .replace('</head>','<link rel="stylesheet" href="preview.css"></head>')
 .replaceAll('https://pokesurvivor-kor.onrender.com/','https://guenoh.github.io/pokesurvivor-kor/')
 .replaceAll('content="PokéSurvivor 한국어 독립판"','content="아머드뮤츠 공개 테스트"');
fs.writeFileSync(path.join(out,'index.html'),index);
fs.copyFileSync(path.join(root,'preview/public.css'),path.join(out,'preview.css'));
fs.writeFileSync(path.join(out,'.nojekyll'),'');
fs.writeFileSync(path.join(out,'preview.json'),JSON.stringify({mode:'guest-only-public-test',productionAccounts:false,revision,balance:{soloHpAt28Minutes:123120,hpMultiplier:1.5,damageMultiplier:1.1,normalWaves:false},source:'https://github.com/guenoh/pokesurvivor-kor/tree/feature/armored-mewtwo-local'},null,2)+'\n');
for(const forbidden of ['.git','.env','node_modules','tools','.local'])if(fs.existsSync(path.join(out,forbidden)))throw Error('Unexpected private/development path: '+forbidden);
console.log('Public static event demo packaged: '+out);
