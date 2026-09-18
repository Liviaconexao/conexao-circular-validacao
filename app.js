// Preview QA — diagnóstico preliminar ICC
const endpoint=window.SURVEY_ENDPOINT;
let schema=null,currentProfile=null,currentIndex=-1,sessionId=null,answers={},contact={},schemaLoadFailed=false;
const modal=document.getElementById('surveyModal'),body=document.getElementById('surveyBody'),titleEl=document.getElementById('surveyTitle'),subtitleEl=document.getElementById('surveySubtitle'),progress=document.getElementById('progressBar'),backBtn=document.getElementById('backBtn'),nextBtn=document.getElementById('nextBtn');

fetch('questions.json')
  .then(r=>{
    if(!r.ok)throw new Error('Não foi possível carregar questions.json');
    return r.json();
  })
  .then(j=>{
    schema=j;
    schemaLoadFailed=false;
  })
  .catch(err=>{
    console.error('questions_load_error',err);
    schemaLoadFailed=true;
    toast('Não foi possível carregar a pesquisa. Atualize a página e tente novamente.');
  });

document.querySelectorAll('[data-scroll]').forEach(b=>{const go=()=>document.querySelector(b.dataset.scroll)?.scrollIntoView({behavior:'smooth'});b.addEventListener('click',go);b.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}});});
document.querySelectorAll('[data-profile]').forEach(b=>b.addEventListener('click',()=>openSurvey(b.dataset.profile)));
document.querySelector('.close').addEventListener('click',()=>modal.hidden=true);
backBtn.addEventListener('click',goBack);
nextBtn.addEventListener('click',goNext);

async function api(payload){
  const res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  if(!res.ok)throw new Error('Falha ao salvar');
  return res.json();
}

function trackEvent(eventName,eventData={}){
  if(!sessionId)return;
  api({action:'event',session_id:sessionId,event_name:eventName,event_data:eventData})
    .catch(err=>console.warn('analytics_event_error',eventName,err));
}

function toast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg;
  t.hidden=false;
  setTimeout(()=>t.hidden=true,2800);
}

function openSurvey(profile){
  if(schemaLoadFailed)return toast('A pesquisa não carregou corretamente. Atualize a página e tente novamente.');
  if(!schema)return toast('Carregando pesquisa…');
  if(!schema[profile])return toast('Perfil de pesquisa indisponível.');
  currentProfile=profile;
  currentIndex=-1;
  sessionId=null;
  answers={};
  contact={};
  titleEl.textContent=schema[profile].title;
  subtitleEl.textContent=schema[profile].subtitle;
  modal.hidden=false;
  nextBtn.style.display='inline-block';
  renderConsent();
}

function renderConsent(){
  progress.style.width='3%';
  backBtn.style.visibility='hidden';
  nextBtn.textContent='Começar';
  body.innerHTML=`
    <div class="q">
      <label class="title">Antes de começar</label>
      <div class="consent-box">
        <strong>Responda à pesquisa e conheça melhor suas práticas de circularidade e impacto.</strong>
        <br><br>
        Ao final, você poderá deixar seu contato para receber gratuitamente um <strong>Diagnóstico Preliminar Conexão Circular</strong>, com uma leitura do seu perfil, pontos fortes, oportunidades de evolução e possíveis conexões circulares que podem ajudar você ou sua organização a avançar.
        <br><br>
        Enquanto isso, suas respostas também nos ajudam a identificar problemas reais de conexão no território e construir uma linha de base sobre práticas circulares, compras inclusivas e indicadores de impacto.
        <br><br>
        As respostas serão analisadas de forma agregada. Nesta etapa, os dados representam informações declaradas pelos participantes e não serão tratados como impacto comprovado sem acompanhamento posterior.
        <br><br>
        Não pedimos endereço exato. O contato ao final é opcional. O diagnóstico é preliminar, baseado nas informações declaradas pelo participante e não constitui certificação, auditoria ou comprovação independente de impacto.
        <br><br>
        <label class="option"><input id="consent" type="checkbox"> <span>Li as informações acima e concordo voluntariamente em participar.</span></label>
      </div>
    </div>`;
}

async function goNext(){
  try{
    if(currentIndex===-1){
      if(!document.getElementById('consent').checked)return toast('Marque o consentimento para continuar.');
      const p=new URLSearchParams(location.search);
      const d=await api({
        action:'start',
        profile:currentProfile,
        consent:true,
        source:p.get('utm_source')||'site',
        campaign:p.get('utm_campaign')||null,
        referrer:document.referrer||null,
        user_agent:navigator.userAgent
      });
      sessionId=d.session_id;
      trackEvent('profile_selected',{profile:currentProfile});
      trackEvent('survey_started',{profile:currentProfile});
      currentIndex=0;
      backBtn.style.visibility='visible';
      renderQuestion();
      return;
    }

    const total=schema[currentProfile].questions.length;

    if(currentIndex<total){
      if(!captureCurrent())return;
      await api({action:'save',session_id:sessionId,answers});
      currentIndex++;
      if(currentIndex<total)renderQuestion();
      else renderContact();
      return;
    }

    if(currentIndex===total){
      const contactState=captureContact();
      if(!contactState.ok)return;

      let emailSent=false;
      if(contactState.hasContact){
        const result=await api({action:'contact',session_id:sessionId,...contact});
        emailSent=Boolean(result.confirmation_email_sent);
      }
      await api({action:'complete',session_id:sessionId,contact_allowed:contactState.hasContact});
      trackEvent('survey_completed',{
        profile:currentProfile,
        contact_provided:contactState.hasContact,
        pilot_interest:answers.pilot_interest||null
      });
      renderSuccess(emailSent,contactState.hasContact);
    }
  }catch(e){
    console.error(e);
    toast('Não foi possível salvar agora. Tente novamente.');
  }
}

function goBack(){
  const total=schema[currentProfile].questions.length;
  if(currentIndex<=0){
    currentIndex=-1;
    renderConsent();
    return;
  }
  if(currentIndex===total){
    currentIndex--;
    renderQuestion();
    return;
  }
  captureCurrent(true);
  currentIndex--;
  renderQuestion();
}

function renderQuestion(){
  const qs=schema[currentProfile].questions;
  const q=qs[currentIndex];
  const val=answers[q.key];
  progress.style.width=((currentIndex+1)/(qs.length+2)*100)+'%';
  nextBtn.textContent='Continuar';

  let input='';
  if(q.type==='text')input=`<input class="field" id="answer" value="${esc(val||'')}">`;
  if(q.type==='textarea')input=`<textarea id="answer">${esc(val||'')}</textarea>`;
  if(q.type==='radio'){
    input=`<div class="options">${q.options.map(o=>`<label class="option"><input type="radio" name="answer" value="${esc(o)}" ${val===o?'checked':''}> <span>${esc(o)}</span></label>`).join('')}</div>`;
  }
  if(q.type==='checkbox'){
    const arr=Array.isArray(val)?val:[];
    input=`<div class="options">${q.options.map(o=>`<label class="option"><input type="checkbox" name="answer" value="${esc(o)}" ${arr.includes(o)?'checked':''}> <span>${esc(o)}</span></label>`).join('')}</div>`;
  }

  body.innerHTML=`<div class="q"><label class="title">${esc(q.label)} ${q.required?'<span class="req">*</span>':''}</label>${input}</div>`;
}

function captureCurrent(silent=false){
  const q=schema[currentProfile].questions[currentIndex];
  if(!q)return true;

  let value='';
  if(q.type==='text'||q.type==='textarea')value=document.getElementById('answer')?.value.trim()||'';
  if(q.type==='radio')value=document.querySelector('input[name="answer"]:checked')?.value||'';
  if(q.type==='checkbox')value=[...document.querySelectorAll('input[name="answer"]:checked')].map(x=>x.value);

  const empty=Array.isArray(value)?value.length===0:!value;
  if(q.required&&empty&&!silent){
    toast('Responda esta pergunta para continuar.');
    return false;
  }
  answers[q.key]=value;
  return true;
}

function renderContact(){
  progress.style.width='94%';
  nextBtn.textContent='Concluir pesquisa';

  const pi=answers.pilot_interest;
  const norm=pi==='Sim'?'yes':pi==='Não'?'no':'maybe';

  body.innerHTML=`
    <div class="q">
      <label class="title">Receba seu Diagnóstico Preliminar Conexão Circular</label>
      <p class="helper">Deixe seu e-mail ou WhatsApp para receber gratuitamente uma leitura preliminar do seu perfil, com pontos fortes, oportunidades de evolução e possíveis conexões circulares. O contato é opcional e não condiciona sua participação na pesquisa.</p>
      <div class="contact-grid">
        <input class="field" id="contact_name" placeholder="Nome">
        <input class="field" id="contact_company" placeholder="Empresa / organização">
        <input class="field" id="contact_phone" placeholder="Telefone / WhatsApp">
        <input class="field" id="contact_email" type="email" placeholder="E-mail">
        <select class="field" id="pilot_interest">
          <option value="${norm}">${norm==='yes'?'Tenho interesse no piloto':norm==='no'?'Não tenho interesse':'Talvez tenha interesse'}</option>
          <option value="yes">Tenho interesse no piloto</option>
          <option value="maybe">Talvez tenha interesse</option>
          <option value="no">Não tenho interesse</option>
        </select>
      </div>
      <br>
      <label class="option"><input id="contact_allowed" type="checkbox"> <span>Se eu deixar contato, autorizo seu uso para envio do diagnóstico preliminar, resultados da pesquisa e comunicações sobre eventual convite para o piloto Conexão Circular.</span></label>
    </div>`;
}

function captureContact(){
  const name=document.getElementById('contact_name')?.value.trim()||'';
  const company=document.getElementById('contact_company')?.value.trim()||'';
  const phone=document.getElementById('contact_phone')?.value.trim()||'';
  const email=document.getElementById('contact_email')?.value.trim()||'';
  const allowed=document.getElementById('contact_allowed')?.checked||false;
  const hasContact=Boolean(name||company||phone||email);

  if(!hasContact){
    contact={};
    return {ok:true,hasContact:false};
  }

  if(!name){
    toast('Se quiser deixar contato, informe seu nome.');
    return {ok:false,hasContact:true};
  }
  if(!email&&!phone){
    toast('Informe pelo menos e-mail ou WhatsApp.');
    return {ok:false,hasContact:true};
  }
  if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
    toast('Informe um e-mail válido.');
    return {ok:false,hasContact:true};
  }
  if(!allowed){
    toast('Autorize o contato para salvar seus dados pessoais.');
    return {ok:false,hasContact:true};
  }

  contact={
    name,
    company:company||null,
    phone:phone||null,
    email:email||null,
    pilot_interest:document.getElementById('pilot_interest')?.value||null
  };
  return {ok:true,hasContact:true};
}

function renderSuccess(emailSent,hasContact){
  progress.style.width='100%';
  backBtn.style.visibility='hidden';
  nextBtn.style.display='none';

  const surveyUrl=location.origin+location.pathname;
  const shareText='Estou participando de uma pesquisa do Conexão Circular sobre conexões locais, economia circular, negócios de impacto e indicadores. Se esse tema também faz sentido para você ou sua organização, participe: '+surveyUrl;
  const wa='https://wa.me/?text='+encodeURIComponent(shareText);

  body.innerHTML=`
    <div class="success">
      <div class="big">✓</div>
      <h3>Resposta registrada.</h3>
      <p>Obrigada por participar do Diagnóstico Conexão Circular.</p>
      <p>${hasContact?(emailSent?'Enviamos um e-mail de confirmação. Seu contato ficou registrado para o diagnóstico preliminar.':'Seu contato foi registrado para o diagnóstico preliminar.'): 'Sua resposta foi registrada sem dados de contato.'}</p>

      <div class="consent-box" style="text-align:left;margin-top:18px">
        <strong>O diagnóstico é um ponto de partida.</strong>
        <p>Quando houver aderência, o Conexão Circular poderá transformar a oportunidade identificada em uma conexão possível: quem pode ajudar, qual ação pode ser testada e qual indicador pode acompanhar a evolução.</p>
      </div>

      <div class="consent-box" style="text-align:left;margin-top:18px">
        <strong>Ajude a ampliar esta escuta.</strong>
        <p>Se você conhece alguém interessado em negócios de impacto, economia circular, compras inclusivas, sustentabilidade ou desenvolvimento local, compartilhe esta pesquisa.</p>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <a class="primary" href="${wa}" target="_blank" rel="noopener noreferrer" style="text-decoration:none">Compartilhar no WhatsApp</a>
          <button class="secondary darkbtn" type="button" onclick="copySurveyLink('${escAttr(surveyUrl)}')">Copiar link</button>
        </div>
      </div>

      <button class="primary" style="margin-top:18px" onclick="document.getElementById('surveyModal').hidden=true">Concluir</button>
    </div>`;
}

async function copySurveyLink(url){
  try{
    await navigator.clipboard.writeText(url);
    toast('Link copiado.');
  }catch(e){
    prompt('Copie o link da pesquisa:',url);
  }
}

function esc(v){
  return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}
function escAttr(v){
  return String(v??'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
}
