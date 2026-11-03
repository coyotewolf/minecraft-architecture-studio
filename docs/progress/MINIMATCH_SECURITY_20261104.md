# minimatch 中度告警修復與公開前查核

日期：2026-11-04（Asia/Singapore）。基準：`950e73141682995c6b037faa236a975e185df96f`。

## 問題與修補決策

首次整合尚有 [GHSA-g3hv-75wg-m249](https://github.com/isaacs/minimatch/security/advisories/GHSA-g3hv-75wg-m249)，牽連 11 個 ESLint／TypeScript ESLint 開發依賴節點。官方修補版為 minimatch 11.0.1；其匹配實作有主版本變更，不能直接替代舊 ESLint 所依賴的舊式預設函式介面。

升級至 ESLint 10.14.0、`@eslint/js` 10.0.1、TypeScript ESLint 8.72.1，並以 npm `overrides` 精確鎖定 minimatch 11.0.1。三個實際消費者使用具名 `Minimatch`／`minimatch` 介面；沒有使用已移除的 regexp 建立介面。這是針對本專案實際用途驗證的跨主版 override，並非宣稱所有第三方用途都相容。應在後續升級時保留回歸驗證，待上游正式採用 11.x 再移除 override。

Node 需求同步改為 `^22.13.0 || >=24.0.0`，符合 [ESLint 10 的官方需求](https://eslint.org/docs/latest/use/migrate-to-10.0.0)。CI 保持 Node 24。未停用 lint 規則、略過 peer 檢查、刪除 audit 項目或使用 `--force`。舊 lockfile 造成 peer 解析衝突，因此在乾淨隔離目錄由精確 manifest 重新解析，再以 `npm ci --ignore-scripts` 驗證安裝。

## 本次實際驗證

- 完整與正式依賴的 `npm audit`：均為 0 info／low／moderate／high／critical。
- `npm ls minimatch`：ESLint、config-array、typescript-estree 都解析至 11.0.1，沒有殘留舊版。
- `npm run verify:lint-toolchain`：實際 ESLint 接受合法 TypeScript、拒絕未使用的 TS 變數和未宣告 JS 變數；`src/features/build/model.ts` 仍會被檢查，vendor／dist／node_modules 仍被排除。與公告相同類型的 globstar／父目錄擴張模式放在 3 秒硬逾時的子程序中完成，沒有掛住檢查。
- `npm run check`：typecheck、lint、40 檔／1,435 項測試，以及前後端正式建置通過。新增驗證腳本最初漏匯入 `URL`，被 lint 拒絕；補齊 Node 匯入後完整重跑通過，沒有放寬規則。
- `npm run verify:vendor`：4 份上游檔案雜湊通過。
- `python -m unittest discover -s scripts -p scan_secrets_test.py`：4 項通過。
- `python scripts/scan_secrets.py --history`：工作檔及所有下載分支／標籤的可達歷史無命中。

CI 新增 matcher／lint 相容性驗證，audit 阻擋門檻從 high 降至 low，讓後續任何等級的已知告警都會阻擋整合。未變更網站功能或後端執行程式；此次未重跑先前的 Chrome 流程，也未呼叫正式／付費 AI。

## 公開前檢查與界線

使用者明確要求將既有 `coyotewolf/minecraft-architecture-studio` 改為 public；先完成修補、測試及上傳，再變更 GitHub 可見性。這不代表對外啟動 Node／AI 服務，也不把專案發布到 npm。

除了正式憑證掃描，唯讀子代理另檢查當時所有下載分支／歷史：1,044 個 objects、591 blobs、329 個歷史路徑，未發現私人照片／內嵌影像、真實登入／玩家資料、帶憑證的下載 URL 或應阻止公開的第三方遊戲資產。Three.js MIT 授權及 registry 來源聲明保留。Higgsfield 記錄只有 scene／project／artifact ID、圖像尺寸／雜湊與開發測試紀錄，沒有原始照片或 bearer 憑證。另核對 GitHub 上的 6 個 PR 描述無敏感內容、沒有 issue comments 或 release 附件。

檢查不能證明任意格式的秘密都不存在，不涵蓋已刪除且不可達的遠端 objects，也不是獨立法律授權認定。歷史中的 Windows 路徑與既有開發結果保留，不將舊測試數字當成本次驗證。網站公開部署、實體手機與 Minecraft 遊戲內驗收不在此次範圍。
