# Creeper 0.7.1 方法研究

日期：2026-10-26。這是本機反編譯產物的靜態閱讀，沒有安裝或執行模組、連接其 AI 服務、付費生成或遊戲驗收。本文是原創行為分析，不包含反編譯原始碼。

## 來源與使用邊界

- 官方來源：[苦力怕模組下載頁](https://www.creeper.net.cn/mods)。研究檔案：`../work/creeper-study/creeper-0.7.1-forge-1.20.1.jar`。
- 本次 `Get-FileHash -Algorithm SHA256` 實測：`933eb655103fc7c30a2bdbd608d87f57e65472d24e895957430373154a8b996f`。
- `META-INF/mods.toml:1–9`：JavaFML、Forge loader 47+、mod ID `minecraftbuildings`、版本 `0.7.1`、授權標記 **All Rights Reserved**。Minecraft dependency 宣告 `[1.20.1,1.21)`，不等於每個版本均經本次實測。
- 沒有將 Java 實作、貼圖、介面素材或其他受保護內容搬入網站。以下建議只描述可自行實作的通用設計。不得把可下載／可反編譯誤認成開源授權。

以下路徑均相對於 `../work/creeper-study/decompiled/cn/minecraftbuildings/`；反編譯仍含 Minecraft 混淆方法名，無法確認的語意不作確定結論。

## 已確認的流程與可學習方法

| 面向 | 靜態證據 | 對網頁編輯器的意義 |
| --- | --- | --- |
| 選區改造 | `client/AiStudio.java` 的 `submit()`（約 969 起）以兩端點的最小值作原點、差值加一作 XYZ 尺寸；有選區時請求選區資料，序列化為 baseline。已有 seed 時則傳 run ID 與 round。 | 改造請求應明確綁定選區、尺寸、原點和設計版本，而非只有文字描述。 |
| 緊湊方塊描述 | `client/SelectionExporter.java:12` 的 `serializeForAi()` 依 Y、Z 掃描，合併同一 X 列連續且 palette index 相同的非空氣格，產生含 `from`、`to`、`block` 的 fill 操作；保留完整 palette 字串。 | 可自行實作「同狀態連續列」壓縮，降低既有建築 context 大小。相同 ID 但不同 state 不可合併；空氣省略表示背景未描述，不應默認成刪除指令。 |
| AI 任務是遠端工作 | `network/PlatformClient.java:277–303` 的 `aiCreate()` POST `/ai/runs`，payload 包含 prompt、rounds、可選 seed、baseline、size；`aiStatus()`、`aiCancel()`、`aiSave()` 分別查詢、取消與保存。`send()` 約 401 起將 `/api/v1` 接到設定網址。 | 可參考非同步任務生命週期；不能聲稱反編譯得到生成模型、提示詞模板、訓練資料或伺服器建築演算法。 |
| 輪次與改造版本 | `client/AiStudio.java` 的 `create()` 實際傳 rounds=1；`continueModify()` 使用目前 run/round 作 seed。`PlatformClient.aiFile()`（338 起）只允許 round-1 至 round-5 的指定 PNG／building.schem 路徑。 | 「再修改一次」可建立新 proposal 並保留來源版本；路徑白名單不是後端生成輪數保證。 |
| 有上限的狀態查詢 | `client/AiSessionManager.java:19–21` 與 `tick()`：每 3 秒、最多 200 次或 10 分鐘；連續五次失敗停止查詢。`cancel()` 也處理遠端取消失敗，提示任務可能仍在執行。 | 任務應有明確 timeout、可恢復查詢、錯誤狀態；停止本機輪詢不能標成遠端已取消。 |
| 實際結果是方塊圖紙 | `AiSessionManager.downloadAndPlace()` 下載 `round-N/building.schem?target=1.20.1`，讀取缺失方塊數，解包 segments，向遊戲伺服器送 `AiPlaceRequestPacket`。`PlatformClient.aiSchemaFile()`（346 起）讀 `X-Missing-Blocks`。 | 視覺預覽與可建造資料要分開驗證；版本轉換遺失須明示。網頁先進 canonical validator，再提供預覽與套用。 |
| 放置是分批工作 | `game/BuildingService.java:673–817` 的 `Placement.step()` 同時限制 batch size 與 nanoTime deadline，另有 deferred pass；`place()` 從線性 index 還原 XYZ，再旋轉位置。`SegmentedPlacement.step()`（820 起）逐段處理佇列。 | 可借鑑有時間預算的預處理／工作排程，避免大建築凍結 UI。網頁仍須維持一次 atomic command 的歷史語意。deferred 分類依混淆方法判斷，本次不斷言其完整支撐規則。 |
| 座標與 block state 分開處理 | `BuildingService.buildFromSite()`（315 起）先透過 `WorldAdapter.palette(..., rotation(t), ...)` 取得旋轉 palette；`Placement.place()` 再呼叫 `schematic.rotatePosition()`。 | 必須同時轉換座標和方向狀態；不能只旋轉視覺模型。與本專案既有 canonical transform 契約一致。 |
| 圖紙有格式與資源限制 | `schematic/SchematicCodec.java:23–26` 定義 16 MiB 檔案限制、總邊長 1024、總高度 384、segment size 256；`fromNbt()`（362 起）讀 Version、DataVersion、Width/Height/Length，檢查單段尺寸和體積。 | 外部輸入應先限制位元組、尺寸、展開體積，再檢查 palette／座標／狀態。這些是該模組限制，不可直接當成網站或 Minecraft 通用限制。 |
| 動畫不等於生成證據 | `client/Live3D.java` 的 `model()` 將 reveal 重設為零，`draw()` 隨時間遞增 reveal／yaw，以背景執行緒約每 100 ms 產生預覽貼圖；完成時檢查模型 identity 防止套入舊影像。 | 可借鑑預覽生命週期與 stale-result 防護，但 reveal 動畫本身不證明模型正逐格生成。應清楚顯示真實任務狀態。 |

## 前端／遊戲伺服器／AI 後端的界線

可直接觀察的是：Minecraft 客戶端準備選區與請求、輪詢服務、顯示預覽、下載圖紙並發送放置封包；遊戲端 `BuildingService` 處理方塊放置工作。AI 生成、渲染、審閱與 target 版本轉換的服務端內部實作不在上述客戶端 API 呼叫中。前端狀態字串 `generating/rendering/reviewing` 只是協定表現，不能證明其內部用了哪個模型或確實如何審閱。

這份研究不能使網站離線取得對方的 AI 能力，也不授權使用對方登入憑證、私有服務或付費額度。網站的既有供應商設定與無金鑰停用行為應維持。

## 建議實作優先序與驗收

1. **選區 baseline 與同狀態列壓縮**：以網站 canonical model 自行寫 serializer；附相對原點、XYZ 尺寸、設計版本，保留 block state。測試負座標、單格、空選區、同 ID 不同 state、往返重建與輸入上限。
2. **可審核的結構化編輯提案**：新增／覆蓋／刪除的語意分明；展開 fill 前限制工作量，跑現有 Java 1.20.1 registry 與多格方塊驗證，先顯示 diff，再透過現有 atomic command 套用並支援 undo。不得讓 AI 直接改 canonical store。
3. **版本綁定與非同步結果隔離**：proposal 保存來源 revision；等待期間使用者編輯後拒絕直接套用舊結果。分開「本機停止等待」、「取消請求中」、「遠端已取消」；保留已完成輪次。
4. **大型預覽排程**：用工作執行緒或有預算的分批預處理產生 derived preview，丟棄舊 revision 的回傳；套用仍是完整交易。依實測再選預算，不移植模組常數。
5. **圖紙匯入列為獨立後續工作**：Sponge schematic／NBT 相容、block entities、DataVersion 及缺失方塊處理需單獨設計與驗收；這份反編譯分析不等於網站已支援這些格式。

## 本次驗證狀態

- 已執行：JAR SHA-256、metadata 授權與版本讀取、上述方法的靜態閱讀。
- 未執行：原模組 game tests、模組啟動／Minecraft 放置、遠端 AI、付款、圖紙實際轉版、此分析建議的網頁功能測試。
- 本文件不宣告任何網站功能完成；具體實作及測試由後續變更報告提供。
