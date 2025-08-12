import { API, NATIONAL_DEX_MAX } from './constants.js';
import { util } from './util.js';

const cache = {
  generation: new Map(), type: new Map(),
  pokemonData: new Map(), speciesData: new Map(),
  allSpecies: null, evoChainById: new Map(),
};

async function json(u){
  const r = await fetch(u);
  if(!r.ok) throw new Error('HTTP '+r.status);
  return r.json();
}

export const api = {
  async listGenerations(){
    const gens = await json(API + 'generation');
    return gens.results.map(g=>({...g, id: util.idFromUrl(g.url)})).sort((a,b)=>a.id-b.id);
  },
  async listTypes(){
    const types = await json(API + 'type');
    return types.results.filter(t=>!['unknown','shadow'].includes(t.name));
  },
  async getGeneration(genName){
    if(cache.generation.has(genName)) return cache.generation.get(genName).species;
    const g = await json(API + 'generation/' + genName);
    const species = g.pokemon_species.map(s => ({ name:s.name, url:s.url, id: util.idFromUrl(s.url) }));
    cache.generation.set(genName, { species });
    return species;
  },
  async getAllSpecies(){
    if(cache.allSpecies) return cache.allSpecies;
    const data = await json(API + 'pokemon-species?limit=20000');
    cache.allSpecies = data.results
      .map(s=>({name:s.name, url:s.url, id: util.idFromUrl(s.url)}))
      .filter(s=>s.id && s.id<=NATIONAL_DEX_MAX).sort((a,b)=>a.id-b.id);
    return cache.allSpecies;
  },
  async getTypeSet(typeName){
    if(cache.type.has(typeName)) return cache.type.get(typeName);
    const t = await json(API + 'type/' + typeName);
    const set = new Set(t.pokemon.map(p=>p.pokemon.name));
    cache.type.set(typeName, set);
    return set;
  },
  async getPokemon(name){
    if(cache.pokemonData.has(name)) return cache.pokemonData.get(name);
    const data = await json(API + 'pokemon/' + name);
    cache.pokemonData.set(name, data);
    return data;
  },
  async getSpecies(name){
    if(cache.speciesData.has(name)) return cache.speciesData.get(name);
    const data = await json(API + 'pokemon-species/' + name);
    cache.speciesData.set(name, data);
    return data;
  },
  async getEvolutionChainByUrl(url){
    const id = util.idFromUrl(url);
    if(id && cache.evoChainById.has(id)) return cache.evoChainById.get(id);
    const data = await json(url);
    if(id) cache.evoChainById.set(id, data);
    return data;
  }
};
