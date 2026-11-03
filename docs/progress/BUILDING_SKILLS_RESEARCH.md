# 公開 Minecraft 建築 Skills 研究與專案採用準則

研究日期：2026-10-26。此文件是來源分析與後續建模工作準則，不代表網站已新增下列工具，也不是第三方程式的實測認證。本輪只讀公開文件與部分原碼，未安裝 skill、啟動遊戲、修改存檔或呼叫付費服務。資料可能隨上游分支更新。

## 篩選結果

### 1. building-architect：最值得吸收的建築設計 skill

- [SKILL.md](https://github.com/chapmanjw/minecraft-bedrock-claude-plugin/blob/main/skills/building-architect/SKILL.md)
- [立面、半磚、拱與屋頂技巧](https://github.com/chapmanjw/minecraft-bedrock-claude-plugin/blob/main/skills/building-architect/reference/techniques.md)
- [構件重用](https://github.com/chapmanjw/minecraft-bedrock-claude-plugin/blob/main/skills/building-architect/reference/modules.md)
- [比例與驗收](https://github.com/chapmanjw/minecraft-bedrock-claude-plugin/blob/main/skills/building-architect/reference/blueprints.md)
- [MIT 授權](https://github.com/chapmanjw/minecraft-bedrock-claude-plugin/blob/main/LICENSE)已讀。

它把可辨認特徵、比例、內裝深度列為設計前提，再拆成窗跨、柱、拱、尖塔等構件重用；特徵或對稱性錯誤必須回修。值得採用三段立面深度與階梯／半磚收邊。限制：它面向 Bedrock、專用 MCP 與自己的分工流程；結構尺寸上限、指令及工作檔格式不可套用到本專案。它建議的材質混搭與背光也不是硬規則：復刻乾淨金屬建築時不能任意加入斑駁或不存在的燈。

### 2. Schematica：幾何與地景方法最接近我們的方向

- [SKILL.md](https://github.com/layercloud-dev/schematica/blob/main/SKILL.md)（舊 tester2024 連結轉址至 layercloud-dev）
- [設計手冊](https://github.com/layercloud-dev/schematica/blob/main/references/design_playbook.md)

文件列出布林形體、曲線、薄殼、局部變換、地形、道路及多視角預覽，並區分密集與分塊儲存。這適合從「矩形樓閣」進步到曲面建築與整體地景。文件設定預設版本 1.20.1，但設計範例仍提及較新材質；不能把範例當版本白名單。WFC 適合局部材質／規律，不會保證照片輪廓或房間連通。平均色預覽也不等同遊戲光影。本輪未找到可核實的根目錄 LICENSE（該路徑回傳 404，不代表已證明整個倉庫無授權），只研究方法，不搬入套件原碼。

### 3. mciwb minecraft-build：可執行建造與回讀驗證

- [SKILL.md](https://github.com/gilesknap/mciwb/blob/main/.claude/skills/minecraft-build/SKILL.md)
- [作者使用說明](https://gilesknap.github.io/mciwb/main/how-to/claude-skill.html)
- [Apache-2.0 授權](https://github.com/gilesknap/mciwb/blob/main/LICENSE)已讀。

核心循環是勘測、備份、腳本建造、影像檢視與方塊回讀。屋頂、樓梯、基礎等應封裝成可檢查的生成單元。限制：需要 Python／RCON／遊戲伺服器；skill 明確說預覽不表現樓梯及半磚真實形狀，必須另查 state。因此適合借鑑驗證流程，不能替代我們的形狀渲染與照片比對，也不應執行其清場與玩家權限命令。

### 4. deepslate minecraft-building-design：輸出格式研究候選

- [SKILL.md](https://github.com/Philogag/deepslate-mcp/blob/main/skill/minecraft-building-design/SKILL.md)
- [已檢查的 design_helpers.py](https://github.com/Philogag/deepslate-mcp/blob/main/skill/minecraft-building-design/scripts/design_helpers.py)

skill 標示 MIT，提供 NBT／Create／Litematica 產製與預覽流程，適合之後研究匯出。原碼檢查發現 apply_rotate_y 與 mirror helpers 保留原 val，只轉位置，不重映射其內方塊 states；直接用在樓梯、門或床會有問題。palette_stats 統計格數，也不能直接當門／床物品備料數。本輪沒有採用其程式或認證匯出結果。

### 5. 其他找到的真實 skills

- [pofice/minecraft-builder](https://github.com/pofice/minecraft-builder)：Java 存檔操作、幾何與家具預設；版本偵測／備份思路有用，但直接寫世界不適合目前瀏覽器編輯器。已讀 README，未完整審核執行腳本與授權，列為次要候選。
- [wzhaoMS/mc-builder SKILL.md](https://github.com/wzhaoMS/mc-builder/blob/master/SKILL.md)：Mineflayer／Paper 建造與截圖回饋。已讀 skill，發現要求 1.21.1、連線範例卻填 1.21.11，面向 Linux／WSL；只採納批次結構與細節分離的觀念，不採其安裝、版本及方位範例。
- [minecraft-modding-workbench](https://github.com/adhi-jp/agent-skills/blob/main/skills/minecraft-modding-workbench/SKILL.md)：是模組開發與 API 查證 skill，不是建築造型專長；本需求不優先。

## 補充：工具／函式庫，不冒稱為 skills

- [GDPC 幾何](https://gdpc.readthedocs.io/en/stable/api/gdpc.geometry.html)、[局部座標變換](https://gdpc.readthedocs.io/en/stable/overview/transformation.html)、[高度圖](https://gdpc.readthedocs.io/en/stable/overview/world-slice.html)：可借鑑幾何生成與放置分離、構件定位和基礎順應地形；高度圖值與方塊 Y 的差一問題須顯式處理。[MIT](https://github.com/avdstaaij/gdpc/blob/master/LICENSE)。版本相容必須依官方 installation 文件另驗，不假設可直連我們的 1.20.1。
- [WorldEdit clipboard](https://worldedit.enginehub.org/en/latest/usage/clipboard/) 與 [generation](https://worldedit.enginehub.org/en/latest/usage/generation/)：參考 anchor、遮罩貼上及曲面構造。研究方法即可，不把 GPL 程式複製進專案。
- [JustBuild](https://github.com/MrSeizy/justbuild)：README 展示幽靈預覽、區域鎖定、逐層差異、版本與村落配置。是模組，不是本輪找到的獨立 skill；其 Minecraft 26.3／Fabric 需求與我們不同。[LGPL-3.0](https://github.com/MrSeizy/justbuild/blob/main/LICENSE)。功能僅讀文件，未執行驗證。
- [minecraft-agentic](https://github.com/NoblerWorks-HQ/minecraft-agentic)：MIT 專案，README 描述程序預設及多視角建造回饋；可參考驗收循環，不把多代理或模型評分本身當品質證明。

## 吸收後的本專案工作流程（原創整合）

這些是接下來建模／生成器改進的採用準則，尚未實作的項目不要呈現為網站已有功能。

1. **先列特徵，再決定解析度。** 記錄參考來源、正背面、主要輪廓、關鍵高度、層帶數、材料、入口和不確定區域。不能只從總格數推論相似度；增加空心內部填充不會改善輪廓。
2. **以固定視角驗收。** 保存相機投影、位置、目標、視野角、畫面尺寸及模型原點。先用外框與地面基準對齊參考；不為每次結果各自調整鏡頭掩蓋比例誤差。以正、背、側、頂與原圖相近透視分開檢查。
3. **按結構分解生成。** 概念上區分主體、外殼、骨架、樓板、窗跨、基座、園景、照明；重複窗跨用局部座標與明確 anchor。這是生成邏輯分解，最後仍合併成單一 Canonical Block Model／單棟 JSON，符合使用者不分檔要求。
4. **曲率與厚度分開。** 先定每個高度的外殼截面和開口邊線，再定骨架中心線與厚度。外殼、窗框、玻璃不共用一條輪廓，避免所有層次貼成同一平面；用剖面檢查遮擋。
5. **方塊形狀必須真實。** 半磚用合法 type，樓梯用 facing／half／shape；整數 XYZ 不因半磚改成小數。旋轉／鏡像必須同時變換 states 和多格結構。模型正確性、畫面正確性分開驗證。
6. **修大形，再補細節。** 順序為外框比例 → 輪廓曲率 → 開口與層帶 → 立面深度 → 材料與細窗 → 光源與植栽。不要拿材質雜訊、強光或密植遮掩形體偏差。
7. **預覽與交易保護。** 所有生成結果先通過版本、座標、碰撞、體積與狀態驗證；預覽不改模型，參數修改使舊預覽失效，套用仍可整體撤銷。大型生成應另外設計有上限的背景處理，不能直接把現有 5,000 格限制刪掉。
8. **建築能走，資料能回讀。** 入口、樓梯淨空、平台和指定房間連通都需驗收。材料從同一資料統計，區分模型格數與物品數；匯出再匯入逐格／state 比較。瀏覽器檢查仍不等於 Minecraft 遊戲內驗收。

## 金葉塔的下一輪驗收表

以下是依使用者既有需求制定的工作表，不是本輪已量測或已修好的結論。

| 部位 | 必須量測／比較 | 不可使用的替代做法 |
| --- | --- | --- |
| 金殼 | 每個 Y 截面左右邊界、最寬高度、前後開口、兩葉交疊與尖端 | 一個對稱橢球直接充當兩片葉子 |
| 灰骨架 | 中心線、不同高度寬度、交叉高度、曲率、與玻璃前後距離 | 全高等寬直線 X、與白外框混為同材質平面 |
| 樓板與窗 | 可見層帶逐一標記、板厚、玻璃內退、細框節奏 | 以樓層數代替可見裝飾層帶數；為湊數降低必要淨空 |
| 基座 | 長方形中段與兩端半圓、入口寬高、台階、與塔身比例 | 整個底座換成圓盤 |
| 左右園景 | 月牙外緣與內側扣除形狀、柱列、樹冠、步道 | 兩個實心圓柱／滿鋪樹葉 |
| 光源 | 參考可見螢石與入口燈帶的實際座標、材質 | 只提高 renderer 發光值，模型沒有燈塊 |
| 尺寸 | 含基座及尖端的 maxY-minY+1 ≤ 100；頂視輪廓另驗 | 以增加總格數取代視覺比對，或超過高度上限 |

相似度檢查要記錄「參考觀察／模型量測／差異／修正／剩餘不確定性」。輪廓重疊率、關鍵點偏移可作輔助，不能單靠像素顏色評分；原圖光影、透視與被遮擋部分限制了逐格真值的可得性，不宣稱任何差異都不存在。

## 與目前程式的落點與優先順序

已查看 `src/features/generator/core.ts`：目前是矩形周牆、規律窗、直梯和平屋頂的基本參數式生成器，不具上述曲殼或立面構件設計能力。既有碰撞保護、100 格高度上限及單次 5,000 格上限應保留。

- P1：建立可重現相機與特徵量測清單，作為金葉塔修正的證據；先固定輪廓再修裝飾。
- P2：擴充原創幾何／構件生成器，具 anchor、曲率剖面、厚度及合法半磚／階梯狀態；由既有交易管線接入。
- P3：加入入口至樓層的連通檢查與局部鎖定，避免細節 pass 破壞已通過的骨架。
- P4：地景組合採建築邊界、入口連線與地形基礎；一棟一檔保留，地景另以引用／變換描述。
- P5：評估 NBT／Schematic 匯出；需獨立 round-trip 與遊戲驗收，不能因外部 skill 聲稱支援就宣布完成。

本輪成果：來源核查、相容性及原碼缺陷分析、可重用建模與驗收準則。沒有修改生成器、金葉塔或網站互動；不重跑與文件無關的整站測試，也不沿用上次測試數字冒稱本輪結果。
