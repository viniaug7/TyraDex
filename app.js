import { GEN_SEGMENTS } from './constants.js';
import { util, parseEvolutionPaths } from './util.js';
import { api } from './api.js';
import { loadTeam, saveTeam } from './team.js';

const els = {
  gen: document.getElementById('gen'),
  type: document.getElementById('type'),
  q: document.getElementById('q'),
  list: document.getElementById('list'),
  status: document.getElementById('status'),
  statusText: document.getElementById('statusText'),
  art: document.getElementById('art'),
  placeholder: document.getElementById('placeholder'),
  metaName: document.getElementById('metaName'),
  metaId: document.getElementById('metaId'),
  metaGen: document.getElementById('metaGen'),
  metaTypes: document.getElementById('metaTypes'),
  shinyToggle: document.getElementById('shinyToggle'),
  abilitiesBox: document.getElementById('abilitiesBox'),
  statsBox: document.getElementById('statsBox'),
  toggleListBtn: document.getElementById('toggleListBtn'),
  rangeIndicator: document.getElementById('rangeIndicator'),
  evoBox: document.getElementById('evoBox'),
  // nav (topo)
  navPokedex: document.getElementById('navPokedex'),
  navTeam: document.getElementById('navTeam'),
  pokedexPanel: document.getElementById('pokedexPanel'),
  teamPanel: document.getElementById('teamPanel'),
  teamGrid: document.getElementById('teamGrid'),
  teamCount: document.getElementById('teamCount'),
  clearTeamBtn: document.getElementById('clearTeamBtn'),
  listPanel: document.getElementById('listPanel'),
};

let current = { species:null };
let mode = 'pokedex';
let team = loadTeam();

const isShiny = () => !!els.shinyToggle.checked;

/* ========== Init controls ========== */
async function initControls(){
  const gens = await api.listGenerations();
  els.gen.innerHTML = `<option value="any-gen">Qualquer Gen</option>` +
    gens.map(g=>`<option value="${g.name}">Geração ${g.id}</option>`).join('');

  const types = await api.listTypes();
  els.type.innerHTML = ['<option value="any">Qualquer tipo</option>']
    .concat(types.map(t=>`<option value="${t.name}">${util.cap(t.name)}</option>`)).join('');

  els.gen.value='any-gen'; els.type.value='any';
}

function setStatus(t){ els.status.classList.remove('hidden'); els.statusText.textContent=t; }
function clearStatus(){ els.status.classList.add('hidden'); }

/* ========== Lista ========== */
async function loadList(){
  setStatus('Carregando lista…');
  const genName = els.gen.value, typeName = els.type.value, q = els.q.value.trim().toLowerCase();

  let species = [];
  if(genName==='any-gen') species = await api.getAllSpecies();
  else species = await api.getGeneration(genName);

  let names = new Set(species.map(s=>s.name));
  if(typeName!=='any'){
    const typeSet = await api.getTypeSet(typeName);
    names = new Set([...names].filter(n=>typeSet.has(n)));
  }
  if(q){ names = new Set([...names].filter(n=>n.includes(q))); }

  const items = species.filter(s=>names.has(s.name)).sort((a,b)=>a.id-b.id);

  updateRangeIndicator(items);
  renderList(items);
  clearStatus();
}

function updateRangeIndicator(items){
  els.rangeIndicator.innerHTML='';
  const counts = GEN_SEGMENTS.map(()=>0);
  for(const it of items){
    const idx = GEN_SEGMENTS.findIndex(g=> it.id>=g.start && it.id<=g.end);
    if(idx>=0) counts[idx]++;
  }
  GEN_SEGMENTS.forEach((g,i)=>{
    const seg=document.createElement('span');
    seg.className='seg'+(counts[i]>0?' active':'');
    seg.textContent=`${util.pad3(g.start)}-${util.pad3(g.end)}`;
    seg.title=`Ir para Geração ${g.num} (${counts[i]} resultados)`;
    seg.setAttribute('role','button'); seg.tabIndex=0;
    seg.addEventListener('click',()=>{ els.gen.value=g.key; loadList(); });
    seg.addEventListener('keydown',(ev)=>{ if(ev.key==='Enter'||ev.key===' '){ ev.preventDefault(); els.gen.value=g.key; loadList(); }});
    els.rangeIndicator.appendChild(seg);
    if(i<GEN_SEGMENTS.length-1){ const sep=document.createElement('span'); sep.className='sep'; sep.textContent='|'; els.rangeIndicator.appendChild(sep); }
  });
}

function renderList(items){
  els.list.innerHTML='';
  if(items.length===0){ els.list.innerHTML = `<div class="pill">Nenhum Pokémon encontrado.</div>`; return; }
  const frag = document.createDocumentFragment();
  items.forEach(s=>{
    const li=document.createElement('button');
    li.className='poke-item';
    li.setAttribute('data-name',s.name);
    li.setAttribute('data-id',s.id);
    if(team.some(t=>t.id===s.id)) li.classList.add('team-selected');
    li.innerHTML = `
      <img class="thumb" loading="lazy" src="${util.spriteUrlById(s.id)}" alt="">
      <span class="pill">#${util.pad3(s.id)}</span>
      <span style="font-weight:600; color: var(--text)">${util.cap(s.name)}</span>
    `;
    li.addEventListener('click',()=> onListItemClick(s, li));
    frag.appendChild(li);
  });
  els.list.appendChild(frag);
}

function onListItemClick(species, li){
  if(mode==='pokedex'){ selectPokemon(species, li); }
  else { toggleTeam(species, li); }
}

/* ========== Pokédex ========== */
function showArt(species){
  const url = util.artworkUrlById(species.id, isShiny());
  els.art.classList.add('fading');
  els.art.onerror = null;
  if(isShiny()){
    els.art.onerror = () => { els.art.onerror=null; els.art.src = util.artworkUrlById(species.id,false); els.art.alt = `Official artwork de ${util.cap(species.name)}`; };
  }
  els.art.onload = () => { els.art.onload=null; els.art.classList.remove('fading'); };
  els.art.src = url;
  els.art.alt = `Official artwork${isShiny()?' (Shiny)':''} de ${util.cap(species.name)}`;
  els.placeholder.classList.add('hidden'); els.art.classList.remove('hidden');
}

async function selectPokemon(species, li){
  document.querySelectorAll('.poke-item.active').forEach(el=>el.classList.remove('active'));
  if(li) li.classList.add('active');

  current = {species};
  showArt(species);

  const gInfo = util.genFromId(species.id);
  els.metaName.textContent = util.cap(species.name);
  els.metaId.textContent = '#'+util.pad3(species.id);
  els.metaGen.textContent = gInfo ? ('Gen '+gInfo.roman) : 'Gen —';

  try{
    const p = await api.getPokemon(species.name);
    const primaryType = p.types?.[0]?.type?.name || null;

    // badges de tipo logo abaixo da imagem
    renderMetaTypes(p.types);

    // cor dos stats segue a do tipo primário
    els.statsBox.style.setProperty('--stat-color', `var(--type-${primaryType})`);
    renderAbilities(p.abilities);
    renderStats(p.stats);
  }catch(err){
    els.abilitiesBox.innerHTML = els.statsBox.innerHTML = '';
    els.metaTypes.innerHTML = '';
    console.error(err);
  }

  try{ await renderEvolution(species.name); }catch(e){ console.error(e); els.evoBox.innerHTML='<div class="pill">Não foi possível carregar a linha evolutiva.</div>'; }
}

function renderMetaTypes(types){
  els.metaTypes.innerHTML = '';
  types.forEach(t=>{
    const n = t.type.name;
    const span = document.createElement('span');
    span.className = `badge type-badge type-${n}`;
    span.textContent = util.cap(n);
    els.metaTypes.appendChild(span);
  });
}

const STAT_LABEL = { hp:'HP', attack:'Atk', defense:'Def', 'special-attack':'SpA', 'special-defense':'SpD', speed:'Spe' };
const STAT_MAX = 255;

function renderAbilities(abilities){
  els.abilitiesBox.innerHTML='';
  abilities.forEach(a=>{
    const span=document.createElement('span');
    span.className='badge neutral';
    const label = a.ability?.name ? util.title(a.ability.name) : '—';
    span.textContent = label + (a.is_hidden?' (Hidden)':'');
    els.abilitiesBox.appendChild(span);
  });
}
function renderStats(stats){
  els.statsBox.innerHTML='';
  stats.forEach(s=>{
    const row=document.createElement('div'); row.className='stat-row';
    const name=STAT_LABEL[s.stat.name]||s.stat.name;
    const v=s.base_stat; const pct=Math.min(100, Math.round((v/STAT_MAX)*100));
    row.innerHTML = `
      <div class="stat-name">${name}</div>
      <div class="stat-bar"><div class="stat-fill" style="width:${pct}%"></div></div>
      <div class="stat-val">${v}</div>
    `;
    els.statsBox.appendChild(row);
  });
}

/* ========== Evoluções ========== */
async function renderEvolution(pokemonName){
  els.evoBox.innerHTML = '<div class="pill">Carregando…</div>';
  const species = await api.getSpecies(pokemonName);
  const chainUrl = species?.evolution_chain?.url;
  if(!chainUrl){ els.evoBox.innerHTML = '<div class="pill">Sem dados de evolução.</div>'; return; }
  const chain = await api.getEvolutionChainByUrl(chainUrl);
  const paths = parseEvolutionPaths(chain.chain);
  els.evoBox.innerHTML = '';
  if(!paths.length){
    const only = [{name: species.name, id: util.idFromUrl(species.url)}];
    els.evoBox.appendChild(buildPathRow(only, []));
    return;
  }
  paths.forEach(({nodes,conds})=>{
    els.evoBox.appendChild(buildPathRow(nodes, conds));
  });
}
function buildPathRow(nodes, conds){
  const row = document.createElement('div');
  row.className = 'evo-path';
  nodes.forEach((node, idx)=>{
    const btn = document.createElement('button');
    btn.className = 'evo-node';
    btn.innerHTML = `
      <img class="evo-sprite" src="${util.spriteUrlById(node.id)}" alt="${util.title(node.name)}">
      <span class="evo-name">${util.title(node.name)}</span>
    `;
    btn.addEventListener('click', ()=>{
      const species = { name: node.name, id: node.id, url: `https://pokeapi.co/api/v2/pokemon-species/${node.id}/` };
      selectPokemon(species, null);
    });
    row.appendChild(btn);
    if(idx < nodes.length - 1){
      const arrow = document.createElement('div');
      arrow.className = 'evo-arrow';
      arrow.innerHTML = `<span>➜</span><span class="evo-cond">${conds[idx] || '—'}</span>`;
      row.appendChild(arrow);
    }
  });
  return row;
}

/* ========== Team Builder ========== */
function renderTeam(){
  els.teamGrid.innerHTML = '';
  els.teamCount.textContent = team.length;

  for(let i=0;i<6;i++){
    const slot = document.createElement('div');
    slot.className = 'slot';
    const member = team[i];
    if(member){
      slot.innerHTML = `
        <img src="${util.artworkUrlById(member.id, false)}" alt="${util.title(member.name)}">
        <div class="info">
          <div class="name">${util.title(member.name)} <span class="small">#${util.pad3(member.id)}</span></div>
          <div class="sub">Clique para remover</div>
        </div>
        <button class="remove" title="Remover">✕</button>
      `;
      slot.addEventListener('click', ()=> removeFromTeam(member.id));
      slot.querySelector('.remove').addEventListener('click', (e)=>{ e.stopPropagation(); removeFromTeam(member.id); });
    }else{
      slot.innerHTML = `<img src="${util.spriteUrlById(25)}" style="opacity:.15" alt="">
                        <div class="info"><div class="name" style="opacity:.5">Vago</div><div class="sub">Selecione na lista</div></div>`;
    }
    els.teamGrid.appendChild(slot);
  }

  document.querySelectorAll('.poke-item').forEach(li=>{
    const id = Number(li.getAttribute('data-id'));
    li.classList.toggle('team-selected', team.some(t=>t.id===id));
  });

  saveTeam(team);
}

function toggleTeam(species, li){
  const idx = team.findIndex(m=>m.id===species.id);
  if(idx >= 0){ team.splice(idx,1); }
  else{
    if(team.length >= 6){
      els.teamCount.animate([{backgroundColor:'transparent'},{backgroundColor:'rgba(239,68,68,.35)'},{backgroundColor:'transparent'}],{duration:600});
      return;
    }
    team.push({ id: species.id, name: species.name });
  }
  if(li) li.classList.toggle('team-selected');
  renderTeam();
}
function removeFromTeam(id){
  team = team.filter(m=>m.id!==id);
  renderTeam();
}
function clearTeam(){
  team = [];
  renderTeam();
}

/* ========== Navegação (tabs do topo) ========== */
function setMode(next){
  mode = next;
  els.navPokedex.classList.toggle('active', mode==='pokedex');
  els.navTeam.classList.toggle('active', mode==='team');
  els.pokedexPanel.classList.toggle('hidden', mode!=='pokedex');
  els.teamPanel.classList.toggle('hidden', mode!=='team');
}

/* recolher lista */
function toggleList(){
  els.listPanel.classList.toggle('collapsed');
  const expanded = !els.listPanel.classList.contains('collapsed');
  els.toggleListBtn.textContent = expanded ? 'Recolher' : 'Expandir';
  els.toggleListBtn.setAttribute('aria-expanded', String(expanded));
  els.toggleListBtn.dataset.userToggled = '1';
}

/* ===== Responsivo: colapsar lista por padrão em portrait ===== */
function isPortraitish(){
  return window.matchMedia('(max-aspect-ratio: 3/4)').matches || window.innerWidth <= 760;
}
let resizeTimer;
function onResize(){
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(()=>{
    if(isPortraitish()){
      if(!els.toggleListBtn.dataset.userToggled){
        els.listPanel.classList.add('collapsed');
        els.toggleListBtn.textContent = 'Expandir';
        els.toggleListBtn.setAttribute('aria-expanded','false');
      }
    }
  }, 120);
}

/* ========== Listeners ========== */
let qTimer; 
els.q.addEventListener('input',()=>{ clearTimeout(qTimer); qTimer=setTimeout(loadList,180); });
els.gen.addEventListener('change', loadList);
els.type.addEventListener('change', loadList);
els.shinyToggle.addEventListener('change', ()=>{ if(current.species) showArt(current.species); });
els.toggleListBtn.addEventListener('click', toggleList);
els.navPokedex.addEventListener('click', ()=> setMode('pokedex'));
els.navTeam.addEventListener('click', ()=> { setMode('team'); renderTeam(); });
els.clearTeamBtn.addEventListener('click', clearTeam);
window.addEventListener('resize', onResize);

/* ========== Boot ========== */
(async function(){
  try{
    await initControls();
    // primeira carga: se portrait, começa com a lista recolhida
    if(isPortraitish()){
      els.listPanel.classList.add('collapsed');
      els.toggleListBtn.textContent = 'Expandir';
      els.toggleListBtn.setAttribute('aria-expanded','false');
    }
    await loadList();
    renderTeam();
  }catch(err){
    els.statusText.textContent = 'Falha ao carregar dados.'; 
    els.status.classList.remove('hidden');
    console.error(err);
  }finally{
    clearStatus();
  }
})();