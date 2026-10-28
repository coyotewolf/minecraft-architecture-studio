import {test,expect} from '@playwright/test';

test('default entry remains lightweight until a building view is chosen',async({page})=>{
 const requests:string[]=[];
 page.on('request',request=>requests.push(request.url()));
 await page.goto('/');
 await expect(page.getByRole('heading',{name:'從一棟建築開始'})).toBeVisible();
 await expect(page.getByRole('button',{name:'載入完整基地',exact:true})).toBeVisible();
 await expect(page.locator('canvas')).toHaveCount(0);
 expect(requests.some(url=>/CampusPanel[-.]|\/features\/campus\/CampusPanel/.test(url))).toBe(false);
 await page.screenshot({path:'evidence/safe-home.png',fullPage:true});
 await page.getByRole('button',{name:'開啟建築庫',exact:true}).click();
 await expect(page).toHaveURL(/view=collection/);
 await expect(page.locator('.collection-page')).toBeVisible();
 expect(requests.some(url=>/CampusPanel[-.]|\/features\/campus\/CampusPanel/.test(url))).toBe(false);
});
