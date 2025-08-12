import { GEN_SEGMENTS } from './constants.js';

export const util = {
  idFromUrl(url){ const m=String(url).match(/\/(\d+)\/?$/); return m?Number(m[1]):null; },
  cap(s){ return s.charAt(0).toUpperCase()+s.slice(1); },
  title(s){ return String(s).replace(/[-_]/g,' ').split(' ').filter(Boolean).map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(' '); },
  pad3(n){ return String(n).padStart(3,'0'); },
  artworkUrlById(id, shiny=false){
    const base='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/';
    return shiny?`${base}shiny/${id}.png`:`${base}${id}.png`;
  },
  spriteUrlById(id){ return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`; },
  genFromId(id){ return GEN_SEGMENTS.find(g => id>=g.start && id<=g.end) || null; },
};

export function evoDetailsToText(details){
  if(!details || !details.length) return '';
  const d = details[0]; const parts=[];
  if(d.trigger?.name === 'level-up' && d.min_level != null) parts.push(`Level ${d.min_level}`);
  else if(d.trigger?.name === 'trade') parts.push('Trade');
  if(d.item?.name) parts.push('Use ' + util.title(d.item.name));
  if(d.held_item?.name) parts.push('Hold ' + util.title(d.held_item.name));
  if(d.min_happiness != null) parts.push(`Friendship ${d.min_happiness}+`);
  if(d.min_beauty != null) parts.push(`Beauty ${d.min_beauty}+`);
  if(d.min_affection != null) parts.push(`Affection ${d.min_affection}+`);
  if(d.time_of_day) parts.push(util.title(d.time_of_day));
  if(d.location?.name) parts.push('At ' + util.title(d.location.name));
  if(d.known_move?.name) parts.push('Know ' + util.title(d.known_move.name));
  if(d.known_move_type?.name) parts.push('Know ' + util.title(d.known_move_type.name) + ' Move');
  if(d.needs_overworld_rain) parts.push('Raining');
  if(d.party_type?.name) parts.push('Party ' + util.title(d.party_type.name));
  if(d.party_species?.name) parts.push('With ' + util.title(d.party_species.name));
  if(d.relative_physical_stats != null){ parts.push(d.relative_physical_stats===1?'Atk>Def': d.relative_physical_stats===-1?'Def>Atk':'Atk=Def'); }
  if(d.turn_upside_down) parts.push('Hold Console Upside Down');
  if(d.gender != null) parts.push(d.gender===1?'Female':'Male');
  if(parts.length===0 && d.trigger?.name){ parts.push(util.title(d.trigger.name)); }
  return parts.join(' · ');
}

export function parseEvolutionPaths(root){
  const results = [];
  const start = { name: root.species.name, id: util.idFromUrl(root.species.url) };
  function dfs(node, nodesAcc, condsAcc){
    const curr = { name: node.species.name, id: util.idFromUrl(node.species.url) };
    const nodesNext = nodesAcc.length ? [...nodesAcc, curr] : [curr];
    if(!node.evolves_to || node.evolves_to.length===0){
      results.push({nodes: nodesNext, conds: condsAcc}); return;
    }
    node.evolves_to.forEach(edge=>{
      const label = evoDetailsToText(edge.evolution_details || []);
      dfs(edge, nodesNext, [...condsAcc, label || '—']);
    });
  }
  dfs(root, [], []);
  return results.map(p=>{ if(p.nodes[0].name !== start.name) p.nodes.unshift(start); return p; });
}
