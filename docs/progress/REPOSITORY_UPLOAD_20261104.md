# 2026-11-04 完整儲存庫整合與資安查核

## 範圍與基準

依使用者最新指示使用既有私人 repo `coyotewolf/minecraft-architecture-studio`，沒有建立新 GitHub repo。既有 `main` 是早期規劃文件；完整實作已在 `codex/full-campus-models`，基準為 `82796db82044394bc7b0d232118fb3a69767aeb5`。此次保留其完整歷史，將最新建築工作台整合至 `main`，並補上本機尚未保存的研究文件與歷史驗證資料。

本機與開發分支共有的主要檔案內容一致（比較時忽略 Windows 換行差異）。完整來源包含 `src/`、`server/`、`e2e/`、`scripts/`、`vendor/`、規格／里程碑文件、設定與 lockfile。金葉塔、完整基地及本機建築產生器由原始碼模型生成，不依賴本機匯出檔才能重建。

不納入私人參考照片、瀏覽器 IndexedDB／個人專案、真實 `.env`、憑證、快取、編譯輸出與原始瀏覽器 trace／日誌。歷史 `evidence/` 及舊里程碑數字不代表此次重新驗收了所有舊流程。

## 修正

- 將未錨定的 `build/` Git 排除規則改為根目錄 `/build/`，避免 `src/features/build/` 的七個原始碼檔案被新檔案盤點或日後提交遺漏；它們原本已在遠端開發分支，此次保留。
- 增加部署秘密、登入加密檔、日誌、瀏覽器 trace 與 Python 快取排除規則。新增憑證掃描工具、含 `STUDIO_AI_KEY` 的四項測試及 GitHub CI。
- Vite `7.3.6` → `7.3.7`、Vitest `3.2.4` → `4.1.12`，並更新相容範圍內的間接依賴；沒有使用 `npm audit fix --force`。同主版 Vitest 修補仍留下受影響的間接依賴，因此升級到已修補的 4.x。
- 原本未設 `STUDIO_PUBLIC_ORIGIN` 時由請求 `Host` 推算可信 Origin，會信任可被操控的主機名稱。新增共用 Host allowlist，保護 AI API 及靜態入口；僅接受 loopback 或精確設定的主機／連接埠。新增真實 HTTP 拒絕測試、合法本機請求與 allowlist 回歸。
- Three.js 四份上游檔案與 MIT 授權的 Git blob 雜湊完全一致。新增 `.gitattributes` 避免 Windows checkout 的換行轉換破壞官方位元組；沒有替換第三方程式內容。

## 已執行驗證

Windows 主機，Node `24.16.0`、npm `11.13.0`，獨立 Git clone：

- `npm run check`：typecheck、lint、40 檔／1,435 項測試與前後端正式建置全部通過。
- `npm run verify:vendor`：四份上游檔案通過固定雜湊查核。
- `python -m unittest discover -s scripts -p scan_secrets_test.py`：4 項通過。
- `python scripts/scan_secrets.py --history`：工作檔及所有可達 Git 歷史掃描無命中；辨識式掃描不保證找出任意格式或任意編碼的秘密。
- 已安裝 Chrome／軟體 WebGL 的正式建置流程：`generator.spec.ts` 桌面整棟生成／預覽／復原／碰撞拒絕／保存匯出／收藏往返、手機尺寸拒絕與版面、`safe-entry.spec.ts` 輕量首頁，共 3／3 通過（12.9 秒）。AI URL／金鑰明確留空，只使用隔離瀏覽器資料。
- 兩次唯讀子代理審查涵蓋後端、AI 提案入口、版本固定與授權。Lead 實作修正並執行測試；子代理沒有修改檔案或宣稱跑過未執行的測試。

初次沙箱執行因 Vitest 暫存檔 `EPERM` 而未執行測試，改在主機執行後取得上述結果。瀏覽器啟動先遇到環境 `cmd.exe ENOENT`，再發現臨時設定放在會被清理的測試輸出目錄；改為獨立本機服務及輸出目錄外設定後通過，沒有削弱斷言。CI 執行同一套型別、lint、單元測試、建置、官方檔案與憑證檢查；本機 Chrome 三案例不計入 CI 執行聲明。

## 依賴風險與驗收界線

後續狀態：下列中度告警為本次首次上傳的歷史結果；已由 [minimatch 安全修補](MINIMATCH_SECURITY_20261104.md)解決，完整開發／正式依賴 audit 均為 0。

初始 npm audit 回報 22 個受影響依賴節點：14 moderate、6 high、2 critical。修補後 high／critical 均為 0；正式執行依賴 `npm audit --omit=dev` 為 0。

開發依賴仍有 [minimatch glob 模式擴張造成資源耗用的中度告警](https://github.com/isaacs/minimatch/security/advisories/GHSA-g3hv-75wg-m249)，牽連 ESLint／TypeScript ESLint 的 11 個依賴節點，並非 11 個獨立漏洞。當前套件宣告的相容範圍尚未涵蓋公告修補版 11.0.1；未強制覆寫不相容的主版本或降級 lint 工具以取得零告警。這些套件只供開發檢查，未由應用程式匯入；仍應在上游更新後重新處理，且不應對開發工具輸入不可信的 glob 設定。CI 以 high 作為阻擋門檻，並沒有忽略或刪除這項 audit 結果。

此次是原始碼保存、整合及本機安全修補，沒有新公開網站部署、付費 AI 呼叫、照片重建品質、實體手機或 Minecraft 遊戲內驗收。正式伺服器維持 loopback；若未來對外開放 AI，需要額外身分驗證及費用授權，Host／Origin 檢查不取代使用者認證。
