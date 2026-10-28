# 模組研究整合驗收（2026-10-26）

## 已完成

下載官方 0.7.1 / Forge / Minecraft 1.20.1 JAR（666,852 bytes），SHA-256 `933eb655103fc7c30a2bdbd608d87f57e65472d24e895957430373154a8b996f` 與官方 release API 相符。使用本機 Vineflower 1.12.0 靜態反編譯，共 119 個 Java 檔；沒有啟動模組或安裝至 Minecraft。原始 JAR、網頁觀察資料及反編譯結果保留在工作區外層 `work/creeper-study/`，未提交到網站原始碼。

來源：https://www.creeper.net.cn/mods 、https://www.creeper.net.cn/guide 、https://www.creeper.net.cn/api/v1/mod/releases 。授權為 All Rights Reserved。分析詳見 CREEPER_MOD_ANALYSIS.md；不包含原碼或素材的複製。

## 實作對應

| 觀察到的設計 | 本次原創實作 |
| --- | --- |
| 先找作品再看預覽 | 收藏名稱／筆記搜尋，最近加入／名稱／格數排序，查無結果提示，保留目前建築 |
| 明確尺寸與圖紙對位 | 本機生成器輸入寬深、層數、層高、原點；北向入口；整棟預覽自動取景 |
| 預覽後確認放置，能撤銷 | 不修改原模型的 proposal；套用後是一個 atomic command；碰撞連內部空間一起檢查 |
| 預覽結果避免過期 | 修改參數立即取消舊預覽；結果綁定 project revision |
| 方塊資料與圖片分離 | 原創參數式基礎樓閣產生 XYZ + states，包含地基、樓板、窗戶、入口及連層樓梯；不是靜態圖片 |

三種材質方案：木石、石磚、現代石英。現代屋頂是真下半部平滑石英半磚。高度不超過 100 格、單次不超過 5,000 格；拒絕過量而非截斷建築。材料數來自實際生成的方塊，整棟與舊設計同屬一個 Project／JSON。新增入口在首頁與收藏庫的「建立新建築」。

沒有取得對方後端 AI 模型／生成演算法。本機生成器是獨立實作的基本結構工具，沒有照片復刻、對方 AI、Schematic 匯入或遊戲自動放置能力。同狀態列壓縮與分時工作排程是研究建議，並未宣稱本輪已實作。既有 AI 無金鑰停用與費用同意機制不變，本輪零付費服務呼叫。

## 執行驗證

- `npm run build`：PASS（client/server TypeScript 與 production build）。既有大 bundle、library 混合 import 警告保留。
- `vitest run --maxWorkers=2`：40 檔／1,432 測試 PASS；新增 16 生成器測試、5 收藏探索測試。
- 變更範圍 ESLint：PASS。
- `playwright test --config=e2e/generator.production.config.ts`：2 PASS。實際操作尺寸／材質、預覽無修改、改值取消、套用、undo/redo、重疊拒絕、JSON 與收藏保存重開一致；手機無橫向溢出及過高輸入拒絕。
- 既有 CAD 與收藏正式版回歸：7 PASS，含框選、軸向拖移、右鍵防誤修改、完整收藏往返與手機預覽。
- 檢視 `evidence/offline-generated-building.png`：真實可編輯體素樓閣；基礎模板外觀，無原參考圖還原宣稱。
- 匯出順序差異以 UID 排序後逐一比較完整 records，沒有忽略座標、state 或 provenance。
- 未做 Minecraft 遊戲內驗收。幾何淨空測試不是遊戲引擎物理保證。

分工：Astra medium 靜態分析與生成器；Astra low 收藏探索；主代理整合、瀏覽器測試、畫面檢查。研究資料與私人金葉參考圖未發布。
