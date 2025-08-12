export function loadTeam(){
  try{ return JSON.parse(localStorage.getItem('team')||'[]'); }catch{ return []; }
}
export function saveTeam(team){
  try{ localStorage.setItem('team', JSON.stringify(team)); }catch{}
}
