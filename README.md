# AI Minecraft Architecture Studio

Minecraft Java Edition **1.20.1 Vanilla** 的本機優先建築工作台。以同一份 Canonical Block Model 驅動 3D、2D 藍圖、材料、施工與匯出，支援實際編輯及保存；目前不是完整 MASTER_SPEC 的所有功能交付。

**目前狀態：M0–M10 的限定手動工作流程 gate 已完成。** 此驗收包含通用 AI 服務介面與未設定時的停用流程，不代表完整照片重建產品或全部 MASTER_SPEC 已完成；最終證據見 [M10 報告](docs/progress/M10.md)。 開發分支：codex/m3-m10-studio；[PR #3](https://github.com/coyotewolf/minecraft-architecture-studio/pull/3)。詳見 [里程碑報告](docs/progress/)、[發布範圍](docs/RELEASE_SCOPE.md)與[完整產品規格](docs/MASTER_SPEC.md)。

## 可使用的手動流程

- 建立空白專案或載入示範木屋，在 3D 旋轉／平移／縮放，拾取真實方塊座標並查看狀態與來源。
- 放置、移除、替換、吸取與修改狀態；先看預覽，再確認套用。支援復原／重做、成對門／床及明確碰撞策略。
- 範圍直線、牆、盒體、填滿、複製／移動、旋轉／鏡像、擠出及複製樓層；逐層藍圖與 3D 共用設計資料。
- 檢查材料需求、堆疊、準備數與尚缺數；查看獨立的樓層／施工進度、半透明與分解視圖，記錄完成狀態並核對設計變更。
- 自動保存、專案清單、命名／副本／刪除、版本快照、備份與匯入。常用方塊可中文搜尋、分類、收藏及從最近使用選取。

方塊材質使用示意色；未支援的特殊幾何會明確標示。合法 ID／狀態與材料統計不代表完整遊戲物理、生存可取得性或放置順序保證。

## 本機啟動

需要 Node.js **22.12 或以上**及 npm；使用已鎖定的相依版本。

~~~sh
npm ci
npm run check
npm run build
npm start
~~~

開啟 http://127.0.0.1:5174。正式建置由同一個本機伺服器提供頁面及 AI API；未設定 provider 時 AI 停用，手動工作流程仍可使用。

開發頁面使用：

~~~sh
npm run dev
~~~

Vite 預設顯示 http://127.0.0.1:5173。AI API 的完整整合應使用建置後的伺服器驗證，不能因開發頁面可開啟就宣稱 provider 可用。

## AI 與照片

通用伺服器端 provider API 已整合，無內建付費服務帳號。以伺服器環境變數設定 STUDIO_AI_URL、STUDIO_AI_KEY、STUDIO_AI_MODEL；金鑰不得放進瀏覽器程式或版本控制。設定方法、JSON 協定、限制與同意流程見 [API_PROVIDER.md](docs/API_PROVIDER.md)。

照片只在使用者明確同意並送出時傳送。分析屬估計；提案必須驗證、預覽並再次確認才會修改模型。原始 AI 設計保留為獨立基準，後續編輯不得覆寫該原始快照。**尚無真實付費 provider 生成、指定模型執行或照片重建品質的驗收證據。** ChatGPT 的 connector 連線不等於此應用已取得服務金鑰。

## 保存與交換格式

- **完整工作區 JSON 備份**：設計、原始設計、版本快照、施工核對基準、材料準備量、完成標記、部分檢視設定與修訂紀錄。
- **模型 JSON／完整 XYZ CSV**：canonical 設計、每個方塊的狀態／來源及邏輯結構；不包含完整工作區施工狀態。
- **材料 JSON／CSV**：已知放置物品需求與未解析資訊；不將佔用格數冒充物品數。

資料保存在目前瀏覽器 origin 的 IndexedDB；不同裝置、瀏覽器或網址不會自動同步。請下載完整備份以便移轉或避免清除瀏覽器資料造成遺失。復原／重做堆疊僅在目前執行程序內，重新載入後不還原；版本快照與備份可持久保存。未知未來版本格式會拒絕，並未假稱已有跨版本遷移。

## 驗證與效能界線

最終 npm run check 通過，包括型別、lint、**1,240 個單元測試／18 個檔案**及前後端建置；Chrome 155／SwiftShader 完整瀏覽器套件 **36／36 通過，耗時約 3.1 分鐘**。其中 AI 有 4 個瀏覽器案例，AI 歷史另有 5 個純 Vitest 案例；後者不是瀏覽器測試。原始 AI 快照與持久化 originalAi 標記已實作，修訂紀錄裁切或第二次 AI 提案均不應覆寫原始基準。

Playwright 可使用已安裝的瀏覽器；Windows 可將 BROWSER_EXECUTABLE_PATH 設為實際 Chrome 執行檔路徑。未設定時使用 Playwright 管理的 Chromium，CI 須先安裝瀏覽器與所需系統相依套件。

~~~sh
npx playwright install chromium
npm run test:e2e -- --grep-invert @profile
~~~

三種規模的量測案例均已執行；下列環境使用 Chrome／SwiftShader 軟體繪圖，不能推廣為所有裝置保證。

| 方塊數 | 匯入 | 拾取 | 旋轉 p95 | 移除 | 復原 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1,000 | 548 ms | 284 ms | 64.8 ms |
| 10,000 | 1,922 ms | 482 ms | 260.9 ms |
| 50,000 | 8,362 ms | 1,782 ms | 1145.5 ms |

**50,000 格不流暢**。M9 gate 的量測與限制揭露已完成；案例通過代表量測完成，不代表此規模達到流暢互動標準。

## 尚未完成的完整規格

自由筆刷／拖曳連續繪製、自訂可重用元件、完整特殊方塊幾何、完整世界物理與遊戲內驗收仍有缺口。原生 Structure NBT／Litematica 匯出延後；JSON／CSV 不能當作這些遊戲格式。雲端同步與多人協作不在首版範圍。

請以 [RELEASE_SCOPE.md](docs/RELEASE_SCOPE.md)核對交付範圍；[ROADMAP.md](docs/ROADMAP.md)定義里程碑，[TEST_PLAN.md](docs/TEST_PLAN.md)定義驗收，[ARCHITECTURE.md](docs/ARCHITECTURE.md)記錄資料與安全邊界。這個 repository 不是已部署網站，沒有在本次工作中授權公開部署或付費生成。
