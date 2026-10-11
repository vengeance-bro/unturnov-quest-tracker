const { test, expect } = require('@playwright/test');
const url='https://vengeance-bro.github.io/unturnov-quest-tracker/';
test('private sign-in gate keeps the dashboard hidden',async({page})=>{
 await page.goto(url);
 await expect(page.locator('#authGate')).toBeVisible();
 await expect(page.locator('#mainNav')).toBeHidden();
 await expect(page.locator('#appMain')).toBeHidden();
 await expect(page.locator('#accountPanel')).toBeVisible();
});
async function fakeSignedIn(page){
 await page.addInitScript(()=>{
  localStorage.setItem('unturnov-supabase-session-v1',JSON.stringify({
   access_token:'mocked-token',refresh_token:'mocked-refresh',expires_at:Date.now()+7200000,
   email:'nolanrabehl@gmail.com'
  }));
  const original=window.fetch.bind(window);
  window.fetch=(input,options)=>{
   if(String(input).includes('.supabase.co')){
    return Promise.resolve(new Response('[]',{status:200,headers:{'content-type':'application/json'}}));
   }
   return original(input,options);
  };
 });
}
test('four-player overview and all six work areas open without frontend errors',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await fakeSignedIn(page);await page.goto(url);
 await expect(page.locator('#dashboardView')).toBeVisible();
 await expect(page.locator('#dashboardPlayers .dashboard-player')).toHaveCount(4);
 const sections=[
  ['quests','#questDetail'],['team','#teamSection'],['airdrop','#airdropSection'],
  ['sell','#sellSection'],['activity','#activitySection'],['settings','#accountPanel']
 ];
 for(const [tab,section] of sections){
  await page.locator('#mainNav [data-view="'+tab+'"]').click();
  await expect(page.locator(section)).toBeVisible();
 }
 await page.locator('#mainNav [data-view="sell"]').click();
 await expect(page.locator('#sellList tr').first()).toBeVisible();
 await expect(page.locator('#iconBulkUpload')).toBeAttached();
 expect(errors).toEqual([]);
});
test('mobile view keeps navigation usable and item columns readable',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await fakeSignedIn(page);await page.goto(url);
 await page.locator('#mainNav [data-view="sell"]').click();
 await expect(page.locator('#sellSection')).toBeVisible();
 await expect(page.locator('#sellList tr').first()).toBeVisible();
 expect(await page.locator('#sellList').evaluate(el=>el.closest('table').classList.contains('mobile-cards'))).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+4)).toBe(true);
});
test('sign-out clears cached progress and reveals sign-in gate',async({page})=>{
 await fakeSignedIn(page);await page.goto(url);
 await page.evaluate(()=>localStorage.setItem('unturnov-v3-events','[]'));
 await page.locator('#mainNav [data-view="settings"]').click();
 page.on('dialog',dlg=>dlg.accept());
 await page.locator('#quickLogout').click();
 await expect(page.locator('#authGate')).toBeVisible();
 await expect(page.locator('#mainNav')).toBeHidden();
 expect(await page.evaluate(()=>localStorage.getItem('unturnov-v3-events'))).toBeNull();
});
