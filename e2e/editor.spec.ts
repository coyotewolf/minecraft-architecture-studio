import { test,expect } from '@playwright/test';
import { clickWorld, coordinate } from './helpers.ts';
test.beforeEach(async({page})=>{await page.goto('/');await page.getByRole('button',{name:'空白專案',exact:true}).click();await page.getByText('編輯工具與方塊',{exact:true}).click();});
test('place against real workplane and selected face, preview/cancel, undo/redo',async({page})=>{
 await page.getByRole('radio',{name:'放置',exact:true}).check();await page.getByRole('button',{name:'俯視',exact:true}).click();
 await clickWorld(page,[.5,0,.5]);await expect(page.getByTestId('cell-count')).toHaveText('0');await expect(page.getByRole('region',{name:'變更預覽'})).toContainText('預覽有效');await page.getByRole('button',{name:'取消預覽'}).click();await expect(page.getByTestId('cell-count')).toHaveText('0');
 await clickWorld(page,[.5,0,.5]);await page.getByRole('button',{name:'套用變更',exact:true}).click();await expect(page.getByTestId('cell-count')).toHaveText('1');
 await clickWorld(page,[.5,1,.5]);await page.getByRole('button',{name:'套用變更',exact:true}).click();await expect(page.getByTestId('cell-count')).toHaveText('2');
 await page.getByRole('button',{name:'復原',exact:true}).click();await expect(page.getByTestId('cell-count')).toHaveText('1');await page.getByRole('button',{name:'重做',exact:true}).click();await expect(page.getByTestId('cell-count')).toHaveText('2');
 await page.getByRole('radio',{name:'吸取',exact:true}).check();await clickWorld(page,[.5,2,.5]);await expect(page.getByRole('combobox',{name:'方塊種類',exact:true})).toHaveValue('minecraft:stone');
});
test('logical door remove/replace is atomic and collision leaves model intact',async({page})=>{
 await page.getByRole('radio',{name:'放置',exact:true}).check();await page.getByRole('combobox',{name:'方塊種類',exact:true}).selectOption('minecraft:oak_door');await coordinate(page,-2,0,-1);await page.getByRole('button',{name:'套用變更',exact:true}).click();await expect(page.getByTestId('cell-count')).toHaveText('2');
 await coordinate(page,-2,0,-1);await expect(page.getByRole('button',{name:'套用變更',exact:true})).toBeDisabled();await expect(page.getByTestId('cell-count')).toHaveText('2');
 await page.getByRole('radio',{name:'移除',exact:true}).check();await coordinate(page,-2,1,-1);await page.getByRole('button',{name:'套用變更',exact:true}).click();await expect(page.getByTestId('cell-count')).toHaveText('0');await page.getByRole('button',{name:'復原',exact:true}).click();await expect(page.getByTestId('cell-count')).toHaveText('2');
 await page.getByRole('radio',{name:'替換',exact:true}).check();await page.getByRole('combobox',{name:'方塊種類',exact:true}).selectOption('minecraft:glass');await coordinate(page,-2,1,-1);await page.getByRole('button',{name:'套用變更',exact:true}).click();await expect(page.getByTestId('cell-count')).toHaveText('1');
});
test('dragging in placement mode does not commit or create a click preview',async({page})=>{
 await page.getByRole('radio',{name:'放置',exact:true}).check();await page.locator('canvas.viewer-canvas').scrollIntoViewIfNeeded();const r=(await page.locator('canvas.viewer-canvas').boundingBox())!;await page.mouse.move(r.x+r.width*.4,r.y+r.height*.5);await page.mouse.down();await page.mouse.move(r.x+r.width*.6,r.y+r.height*.55,{steps:8});await page.mouse.up();await expect(page.getByRole('region',{name:'變更預覽'})).toHaveCount(0);await expect(page.getByTestId('cell-count')).toHaveText('0');
});

