// The reader that runs on Simania's inventory page. Kept free of other imports, because the site
// also serves it as a script (/simania-reader.js) that the bookmarklet loads, so changes here
// reach the bookmark without dragging it to the bookmarks bar again.
import type { SimaniaRaw } from './simania';

export const SITE_ORIGIN = 'https://haayal-kore.codata-io.app';
export const SIMANIA_ORIGIN = 'https://simania.co.il';
export const SIMANIA_INVENTORY = `${SIMANIA_ORIGIN}/sellers/inventory`;
export const MESSAGE_KIND = 'simania-items';

const FIELDS: (keyof SimaniaRaw)[] = [
  'ownedId', 'bookId', 'bookTitle', 'bookAuthor', 'publisher', 'year', 'price', 'conditionText',
  'categoryName', 'subcategoryName', 'hasImage', 'coverImage', 'updatedAt', 'sellerCount',
  'isCheapest', 'isMostExpensive', 'hasDemand', 'isExclusive', 'isStale',
  'marketMinPrice', 'marketMaxPrice', 'marketAvgPrice', 'viewsCount',
];

/** Which copies to read: those updated on Simania within this period (newest first). Passed to the reader in the address. */
export type TimeLimit = 'day' | 'week' | 'month' | 'all';
export const TIME_LIMITS: TimeLimit[] = ['day', 'week', 'month', 'all'];
export const DEFAULT_LIMIT: TimeLimit = 'week';
const LIMIT_DAYS: Record<TimeLimit, number> = { day: 1, week: 7, month: 30, all: 0 };
export const HASH_KEY = 'haayal-since';

/** Runs on Simania's inventory page: reads the store's list, most recently updated first
 *  (100 per request, paced), and stops at the first copy updated before the period in the address.
 *  Sends the list to the site tab that opened it, or saves it as a file when there is no such tab. */
export const READER = `(async()=>{
const O=${JSON.stringify(SITE_ORIGIN)},F=${JSON.stringify(FIELDS)};
const box=document.createElement('div');
box.style.cssText='position:fixed;top:12px;left:12px;z-index:2147483647;background:#5b4636;color:#fff;padding:14px 18px;border-radius:10px;font:16px/1.5 Arial,sans-serif;direction:rtl;box-shadow:0 4px 16px rgba(0,0,0,.3);max-width:360px';
document.body.appendChild(box);
if(location.hostname!=='simania.co.il'||!location.pathname.startsWith('/sellers/inventory')){box.textContent='יש להפעיל את הסימנייה בעמוד "המלאי שלי" בסימניה.';return}
const D=${JSON.stringify(LIMIT_DAYS)},m=location.hash.match(/${HASH_KEY}=(day|week|month|all)/),since=m?m[1]:${JSON.stringify(DEFAULT_LIMIT)};
const cut=D[since]?Date.now()-D[since]*864e5:0;
const items=[];let pages=0,total=0,done=false;
try{for(let p=1;;p++){let j=null;
for(let a=0;a<3&&!j;a++){const r=await fetch('/api/sellers/inventory?page='+p+'&pageSize=100&scope=store&filter=all&sort=updated-desc',{credentials:'include'});
if(r.ok)j=await r.json();else await new Promise(s=>setTimeout(s,2000))}
if(!j)throw new Error('לא הצלחתי לקרוא את עמוד '+p);
for(const i of j.items){if(cut&&!(Date.parse(i.updatedAt)>=cut)){done=true;break}items.push(Object.fromEntries(F.map(k=>[k,i[k]??null])))}
pages=p;total=j.totalPages;
box.textContent='קורא את המלאי מסימניה: '+items.length+' עותקים'+(cut?'':' ('+p+' מתוך '+j.totalPages+' עמודים)');
if(done||p>=j.totalPages)break;await new Promise(s=>setTimeout(s,250))}
const data={kind:${JSON.stringify(MESSAGE_KIND)},fetchedAt:new Date().toISOString(),since,pages,totalPages:total,items};
if(window.opener){window.opener.postMessage(data,O);box.textContent='נקראו '+items.length+' עותקים ונשלחו לאתר. אפשר לסגור את הלשונית הזו ולחזור לאתר.'}
else{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'}));a.download='simania-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();
box.textContent='נקראו '+items.length+' עותקים ונשמרו לקובץ. העלו את הקובץ בלשונית "סימניה" באתר.'}}
catch(e){box.textContent='שגיאה: '+(e&&e.message||e)}})();`;

/** The reader's code, served at /simania-reader.js. */
export const READER_SCRIPT = READER;

/** The bookmark itself: loads the current reader from the site, so it never needs replacing. */
export const BOOKMARKLET = `javascript:${encodeURIComponent(
  `(()=>{const s=document.createElement('script');s.src=${JSON.stringify(`${SITE_ORIGIN}/simania-reader.js`)}+'?t='+Date.now();document.body.appendChild(s)})();`,
)}`;

