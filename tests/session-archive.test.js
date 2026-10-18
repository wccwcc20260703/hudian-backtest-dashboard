import assert from 'node:assert/strict';
import fs from 'node:fs';
import {evidenceSessions,replayDates,freshnessText} from '../docs/session-archive.js';
const data=JSON.parse(fs.readFileSync(new URL('../docs/data.json',import.meta.url))),allArchive=JSON.parse(fs.readFileSync(new URL('../docs/session-archive.json',import.meta.url))),archive={sessions:Object.fromEntries(Object.entries(allArchive.sessions).filter(([d])=>d<='2026-10-12'))};
const before=JSON.stringify(data),live={quote:{date:'2026-10-12',time:'15:06:15',price:109.62}};
assert.equal(data.dates.at(-1),'2026-10-08');
assert.deepEqual(evidenceSessions(data,archive,live).map(([d])=>d),['2026-10-09','2026-10-12']);
assert.deepEqual(replayDates(data,0,data.dates.length,archive,live).slice(-3),['2026-10-08','2026-10-09','2026-10-12']);
assert.equal(replayDates(data,0,data.dates.length-1,archive,live).at(-1),'2026-09-30');
assert.equal(evidenceSessions(data,archive,live).at(-1)[1].market,live);
assert.ok(evidenceSessions(data,archive,null).every(([,s])=>s.market.minutes.points.length>0));
assert.match(freshnessText(data,0,data.dates.length,archive),/完整回测数据截至 2026-10-08/);
assert.equal(JSON.stringify(data),before,'Market-only days must not alter accounting input');
const app=fs.readFileSync(new URL('../docs/app.js',import.meta.url),'utf8');assert.match(app,/showMaxLabel:true/);assert.match(app,/renderArchivedDay/);
console.log('Retained Oct9/Oct12 timeline, live dedupe, selected-range isolation and accounting boundary passed.');

for(const day of ['2026-10-13','2026-10-14','2026-10-15'])assert(replayDates(data,0,data.dates.length,allArchive,null).includes(day));
