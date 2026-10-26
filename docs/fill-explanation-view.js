export const explanationText=e=>(e.explanation?.lines??[e.reason||'原始触发依据未留存，不能推定原因。']).join('\n');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const explanationHTML=e=>esc(explanationText(e)).replace(/\n/g,'<br>');
export const explanationDetails=e=>`<details><summary>查看触发条件与数量依据</summary><div style="min-width:260px;max-width:680px;white-space:normal;text-align:left">${explanationHTML(e)}</div></details>`;
