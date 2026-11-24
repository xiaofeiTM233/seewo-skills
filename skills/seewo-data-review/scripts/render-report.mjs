/** 维护固定外观；生成运行只组装已有数据，不取数、不复核、不登记产物。 */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const list=v=>Array.isArray(v)?v:[];
const bullets=v=>`<ul>${list(v).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`;
const paragraphs=v=>list(v).map(x=>`<p>${esc(x)}</p>`).join('');
export function renderReport(data){
 const css=['report-base.css','report-hero.css','report.css'].map(f=>readFileSync(resolve(ROOT,'assets',f),'utf8')).join('\n');
 const sections=[];let n=0;
 const section=(id,title,lead,body)=>{sections.push(`<section id="${id}" class="chapter"><div class="chapter-head"><span class="chapter-no">${String(++n).padStart(2,'0')}</span><div><h2>${esc(title)}</h2>${lead?`<p class="lead">${esc(lead)}</p>`:''}</div></div>${body}</section>`);};
 if(data.memory?.theme&&list(data.memory.points).length){section('memory','这些年的回望','',`<div class="memory-visual"><div class="memory-theme">${esc(data.memory.theme)}</div><div class="memory-points">${list(data.memory.points).map(p=>`<p class="memory-point">${esc(p)}</p>`).join('')}</div></div>`);}
 const metrics=items=>`<div class="numbers">${list(items).map(x=>`<div class="num-card"><div class="num-label">${esc(x.label)}</div><div class="value"><span class="v">${esc(x.value??'—')}</span><span class="u">${esc(x.unit)}</span></div>${x.note?`<p class="num-note">${esc(x.note)}</p>`:''}</div>`).join('')}</div>`;
 if(list(data.metrics).length)section('numbers','我留下的数字','',metrics(data.metrics));
 if(list(data.timeline).length)section('timeline','我一路做过的事',data.timelineNote,`<div class="timeline">${data.timeline.map(x=>`<div class="node"><div class="node-inner"><h3 class="when">${esc(x.when)}</h3><div class="what">${bullets(x.facts)}</div></div></div>`).join('')}</div>`);
 if(list(data.assets).length)section('assets','我的家底',data.assetsNote,`<div class="archive-grid">${data.assets.map(x=>`<div class="archive-card"><div class="archive-top"><div>${x.type?`<div class="archive-type">${esc(x.type)}</div>`:''}<h3>${esc(x.title)}</h3></div>${x.value!=null?`<div class="archive-count">${esc(x.value)}</div>`:''}</div><div class="archive-body">${paragraphs(x.paragraphs)}</div></div>`).join('')}</div>`);
 if(data.recent){const x=data.recent;let body=`<div class="recent-layout">${x.metrics?metrics(x.metrics):''}`;
  if(list(x.works).length)body+=`<div><h3>最近更新的作品</h3><div class="works">${x.works.map(w=>`<div class="work"><span class="work-name">${esc(w.name)}</span><time>${esc(w.date)}</time></div>`).join('')}</div></div>`;
  // 只有采集结果完整时呈现分月图；不从样本推导完整半年总量。
  if(x.complete===true&&list(x.months).length){const max=Math.max(1,...x.months.map(m=>Number(m.value)||0));body+=`<div><h3>按最近更新时间分月</h3><div class="chart-bars">${x.months.map(m=>`<div class="chart-col"><div class="chart-track"><div class="chart-bar" style="height:${Math.max(0,(Number(m.value)||0)/max*100)}%"><div class="chart-value">${esc(m.value)}</div></div></div><div class="chart-label">${esc(m.label)}</div></div>`).join('')}</div></div>`;}
  if(list(x.themes).length)body+=`<div><h3>近期主题</h3><div class="archive-body works">${bullets(x.themes)}</div></div>`;
  section('recent','近半年更新的课件',x.summary,body+'</div>');
 }
 if(data.focus?.summary)section('focus','我的工作重心','',`<div class="focus-layout"><div class="focus-quote">${esc(data.focus.summary)}</div><div class="evidence-list">${list(data.focus.evidence).map((x,i)=>`<div class="evidence"><span class="evidence-no">${String(i+1).padStart(2,'0')}</span><p>${esc(x)}</p></div>`).join('')}</div></div>`);
 if(list(data.todos).length)section('next','我接下来先做什么','',`<div class="todos">${data.todos.map((x,i)=>`<div class="todo"><div class="todo-no">${String(i+1).padStart(2,'0')}</div><h3 class="t">${esc(x.title)}</h3><p class="why">${esc(x.why)}</p></div>`).join('')}</div>`);
 const values={css,meta:list(data.meta).map(x=>`<span>${esc(x)}</span>`).join(''),intro:esc(data.intro),content:sections.join('\n')};
 return readFileSync(resolve(ROOT,'assets/h5-template.html'),'utf8').replace(/\{\{(css|meta|intro|content)\}\}/g,(_,k)=>values[k]);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),value=k=>args[args.indexOf(k)+1];
 if(!args.includes('--data')||!args.includes('--out')){console.error('用法: node scripts/render-report.mjs --data content.json --out "希沃一刻 · 我的沉淀.html"');process.exit(2);}
 const out=resolve(value('--out'));mkdirSync(dirname(out),{recursive:true});writeFileSync(out,renderReport(JSON.parse(readFileSync(value('--data'),'utf8'))));console.log('已生成 HTML：'+out);
}
