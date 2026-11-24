import test from 'node:test';
import assert from 'node:assert/strict';
import {renderReport} from '../scripts/render-report.mjs';
test('业务文本转义且待办原文与数字默认可读',()=>{
 const html=renderReport({meta:['数学 <教研>'],metrics:[{label:'课件',value:428,unit:'份'}],todos:[{title:'整理 <几何>',why:'A&B'}]});
 assert.ok(html.includes('数学 &lt;教研&gt;'));assert.ok(html.includes('整理 &lt;几何&gt;'));assert.ok(html.includes('A&amp;B'));
 assert.ok(html.includes('class="v">428</span>'));assert.ok(!html.includes('<script'));
 assert.ok(!/(?:src|href)=["']https?:/.test(html));
});
test('不完整半年样本不生成分月趋势，缺省章节不留空位',()=>{
 const html=renderReport({recent:{summary:'已读取20份样本',complete:false,months:[{label:'2026.10',value:20}]},todos:[{title:'整理作品',why:'已有材料'}]});
 assert.ok(!html.includes('id="timeline"'));assert.ok(!html.includes('class="chart-col"'));
 assert.ok(html.includes('class="chapter-no">01</span>'));assert.ok(html.includes('class="chapter-no">02</span>'));
});
test('完整半年数据渲染图表，内容中的模板字符保持为业务文本',()=>{
 const html=renderReport({intro:'{{content}}',recent:{complete:true,months:[{label:'2026.10',value:5}]}});
 assert.ok(html.includes('class="intro">{{content}}</p>'));assert.ok(html.includes('class="chart-col"'));assert.ok(!html.includes('NaN'));
});
