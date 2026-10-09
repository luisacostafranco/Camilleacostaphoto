/** Shared browser and editor data utilities. No Supabase client or private state. */
export const centered = () => ({
  desktop_x:50,desktop_y:50,desktop_zoom:1,
  mobile_x:50,mobile_y:50,mobile_zoom:1
});
export const frameKeys = Object.keys(centered());
export const clone = item => JSON.parse(JSON.stringify(item));
export const clamp = (v,min,max) => Math.max(min,Math.min(max,v));
export const round = (v,places=1) => Math.round(v*10**places)/10**places;
export const imageIdentity = str => {
  try {return new URL(String(str||''),location.href).pathname;}
  catch {return String(str||'').trim();}
};
export const fresh = () => ({home:[],portfolio:[]});
export function importCMS(site,portfolio,frames=[]) {
  const result=fresh();
  const map=new Map(frames.map(row=>[row.target_key,row]));
  for(const [collection, items] of [
    ['home',(site?.homepage_photos||[]).slice(0,7)],
    ['portfolio',(portfolio?.items||[]).slice(0,150)]
  ]) {
    items.forEach((row,index)=>{
      if (!row?.image) return;
      const key=`${collection}:${index+1}`;
      const frame=map.get(key);
      const matches=frame && imageIdentity(frame.image_path)===imageIdentity(row.image);
      const crop=centered();
      if (matches) for(const field of frameKeys) crop[field]=Number(frame[field]??crop[field]);
      result[collection].push({
        id: crypto.randomUUID(), image: row.image, thumb:row.image,
        alt:row.alt||'',category:row.category||'portraits',categories:[row.category||'portraits'],layout:row.layout||'normal',
        ...crop
      });
    });
  }
  return result;
}
export function normalizeCatalogue(raw) {
  return {
    home:Array.isArray(raw?.home)?raw.home:[],
    portfolio:Array.isArray(raw?.portfolio)?raw.portfolio:[]
  };
}
export function moveItem(catalogue, collection, from, to) {
  const list=catalogue[collection];
  if(!Array.isArray(list) || from<0 || from>=list.length || to<0 || to>=list.length || from===to) return false;
  const [entry]=list.splice(from,1);
  list.splice(to,0,entry);
  return true;
}
export function photoPreview(photo) {
  return photo?.thumb || photo?.image || '';
}
