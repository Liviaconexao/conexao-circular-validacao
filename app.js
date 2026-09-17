
const endpoint=window.SURVEY_ENDPOINT;
let schema=null,currentProfile=null,currentIndex=-1,sessionId=null,answers={},contact={};
const modal=document.getElementById('surveyModal'),body=document.getElementById('surveyBody'),titleEl=document.getElementById('surveyTitle'),subtitleEl=document.getElementById('surveySubtitle'),progress=document.getElementById('progressBar'),backBtn=document.getElementById('backBtn'),nextBtn=document.getElementById('nextBtn');

fetch('questions.json').then(r=>r.json()).then(j=>schema=j);

document.querySelectorAll('[data-scroll]').forEach(b=>b.addEventListener('click',()=>document.querySelector(b.dataset.scroll)?.scrollIntoView({behavior:'smooth'})));
document.querySelectorAll('[data-profile]').forEach(b=>b.addEventListener('click',()=>openSurvey(b.dataset.profile)));
document.querySelector('.close').addEventListener('click',()=>modal.hidden=true);
backBtn.addEventListener('click',goBack);
nextBtn.addEventListener('click',goNext);

async function api(payload){
  const res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  if(!res.ok) throw new Error('Falha ao salvar');
  return res.json();
}
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.hidden=false;setTimeout(()=>t.hidden=true,2600)}
function openSurvey(profile){
  if(!schema)return toast('Carregando pesquisa…');
  currentProfile=profile;currentIndex=-1;sessionId=null;answers={};contact={};
  titleEl.textContent=schema[profile].title;subtitleEl.textContent=schema[profile].subtitle;
  modal.hidden=false;nextBtn.style.display='inline-block';renderConsent();
}
function renderConsent(){
  progress.style.width='3%';backBtn.style.visibility='hidden';nextBtn.textContent='Começar';
  body.innerHTML='<div class="q"><label class="title">Antes de começar</label><div class="consent-box">Esta é uma pesquisa de validação do Conexão Circular. As respostas serão usadas para compreender necessidades e estruturar o piloto. Dados de contato são opcionais. Não pedimos endereço exato.<br><br><label class="option"><input id="consent" type="checkbox"> <span>Li as informações acima e concordo voluntariamente em participar.</span></label></div></div>';
}
async function goNext(){
  try{
    if(currentIndex===-1){
      if(!document.getElementById('consent').checked)return toast('Marque o consentimento para continuar.');
      const p=new URLSearchParams(location.search);
      const d=await api({action:'start',profile:currentProfile,consent:true,source:p.get('utm_source')||'site',campaign:p.get('utm_campaign')||null,referrer:document.referrer||null,user_agent:navigator.userAgent});
      sessionId=d.session_id;currentIndex=0;backBtn.style.visibility='visible';renderQuestion();return;
    }
    const total=schema[currentProfile].questions.length;
    if(currentIndex<total){
      if(!captureCurrent())return;
      await api({action:'save',session_id:sessionId,answers});
      currentIndex++;
      if(currentIndex<total)renderQuestion();else renderContact();
      return;
    }
    if(currentIndex===total){
      captureContact();
      if(contact.name||contact.email||contact.phone||contact.pilot_interest)await api({action:'contact',session_id:sessionId,...contact});
      await api({action:'complete',session_id:sessionId,contact_allowed:document.getElementById('contact_allowed')?.checked||false});
      renderSuccess();
    }
  }catch(e){console.error(e);toast('Não foi possível salvar agora. Tente novamente.')}
}
function goBack(){
  const total=schema[currentProfile].questions.length;
  if(currentIndex<=0){currentIndex=-1;renderConsent();return}
  if(currentIndex===total){currentIndex--;renderQuestion();return}
  captureCurrent(true);currentIndex--;renderQuestion();
}
function renderQuestion(){
  const qs=schema[currentProfile].questions,q=qs[currentIndex],val=answers[q.key];
  progress.style.width=((currentIndex+1)/(qs.length+2)*100)+'%';
  nextBtn.textContent='Continuar';
  let input='';
  if(q.type==='text')input=`<input class="field" id="answer" value="${esc(val||'')}">`;
  if(q.type==='textarea')input=`<textarea id="answer">${esc(val||'')}</textarea>`;
  if(q.type==='radio')input=`<div class="options">${q.options.map(o=>`<label class="option"><input type="radio" name="answer" value="${esc(o)}" ${val===o?'checked':''}> <span>${esc(o)}</span></label>`).join('')}</div>`;
  if(q.type==='checkbox'){const arr=Array.isArray(val)?val:[];input=`<div class="options">${q.options.map(o=>`<label class="option"><input type="checkbox" name="answer" value="${esc(o)}" ${arr.includes(o)?'checked':''}> <span>${esc(o)}</span></label>`).join('')}</div>`}
  if(q.type==='scale')input=`<div class="scale">${[1,2,3,4,5].map(n=>`<label><input type="radio" name="answer" value="${n}" ${String(val)===String(n)?'checked':''}><br><b>${n}</b></label>`).join('')}</div>`;
  body.innerHTML=`<div class="q"><label class="title">${esc(q.label)} ${q.required?'<span class="req">*</span>':''}</label>${input}</div>`;
}
function captureCurrent(silent=false){
  const q=schema[currentProfile].questions[currentIndex];if(!q)return true;
  let value='';
  if(q.type==='text'||q.type==='textarea')value=document.getElementById('answer')?.value.trim()||'';
  if(q.type==='radio'||q.type==='scale')value=document.querySelector('input[name="answer"]:checked')?.value||'';
  if(q.type==='checkbox')value=[...document.querySelectorAll('input[name="answer"]:checked')].map(x=>x.value);
  const empty=Array.isArray(value)?value.length===0:!value;
  if(q.required&&empty&&!silent){toast('Responda esta pergunta para continuar.');return false}
  answers[q.key]=value;return true;
}
function renderContact(){
  progress.style.width='94%';nextBtn.textContent='Enviar pesquisa';
  const pi=answers.pilot_interest;let norm=pi==='Sim'?'yes':pi==='Não'?'no':'maybe';
  body.innerHTML=`<div class="q"><label class="title">Quer participar do piloto ou receber contato?</label><p class="helper">Contato é opcional.</p><div class="contact-grid"><input class="field" id="contact_name" placeholder="Nome"><input class="field" id="contact_phone" placeholder="WhatsApp com DDD"><input class="field" id="contact_email" placeholder="E-mail"><select class="field" id="pilot_interest"><option value="${norm}">${norm==='yes'?'Tenho interesse':norm==='no'?'Não tenho interesse':'Talvez'}</option><option value="yes">Tenho interesse</option><option value="maybe">Talvez</option><option value="no">Não tenho interesse</option></select></div><br><label class="option"><input id="contact_allowed" type="checkbox"> <span>Autorizo o Conexão Circular a entrar em contato sobre esta pesquisa ou sobre o piloto.</span></label></div>`;
}
function captureContact(){
  contact={name:document.getElementById('contact_name')?.value.trim()||null,phone:document.getElementById('contact_phone')?.value.trim()||null,email:document.getElementById('contact_email')?.value.trim()||null,pilot_interest:document.getElementById('pilot_interest')?.value||null};
}
function renderSuccess(){
  progress.style.width='100%';backBtn.style.visibility='hidden';nextBtn.style.display='none';
  body.innerHTML='<div class="success"><div class="big">✓</div><h3>Resposta registrada.</h3><p>Obrigado por ajudar a construir uma economia circular mais conectada no Rio de Janeiro.</p><button class="primary" onclick="document.getElementById(\\'surveyModal\\').hidden=true">Concluir</button></div>';
}
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
