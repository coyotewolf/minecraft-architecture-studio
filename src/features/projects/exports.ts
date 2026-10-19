import type { Project } from '../../core/contracts.ts';
import { MAX_BLOCKS, MAX_IMPORT_BYTES, object, parseProject, stableJson } from '../../core/model.ts';

function bounded(text: string): void {
  if (text.length > MAX_IMPORT_BYTES || new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) throw new Error('模型 CSV 超過 32 MiB 上限');
}
function quote(value: string): string { return '"' + value.replaceAll('"', '""') + '"'; }
/** JSON strings keep user-controlled labels from becoming spreadsheet formulas. */
export function modelToCsv(project: Project): string {
  const valid = parseProject(project);
  const { blocks, ...metadata } = valid;
  const rows = [['record', 'x', 'y', 'z', 'json'], ['project', '', '', '', stableJson(metadata)],
    ...blocks.map(b => ['block', String(b.pos.x), String(b.pos.y), String(b.pos.z), stableJson(b)])];
  const csv = rows.map(row => row.map(quote).join(',')).join('\r\n') + '\r\n';
  bounded(csv);
  return csv;
}
function parseCsv(input: string): string[][] {
  bounded(input);
  const rows: string[][] = [];
  let row: string[] = [], value = '', quoted = false, closed = false, started = false;
  function field() { row.push(value); value = ''; closed = false; started = false; if (row.length > 5) throw new Error('CSV 欄位過多'); }
  function line() { field(); rows.push(row); row = []; if (rows.length > MAX_BLOCKS + 2) throw new Error('CSV 列數過多'); }
  for (let i = 0; i < input.length; i++) {
    const char = input[i]!;
    if (quoted) {
      if (char === '"') {
        if (input[i + 1] === '"') { value += '"'; i++; }
        else { quoted = false; closed = true; }
      } else value += char;
    } else if (char === ',') field();
    else if (char === '\n' || char === '\r') { if (char === '\r' && input[i + 1] === '\n') i++; line(); }
    else if (char === '"' && !started && !closed) { quoted = true; started = true; }
    else { if (closed || char === '"') throw new Error('CSV 引號格式錯誤'); value += char; started = true; }
  }
  if (quoted) throw new Error('CSV 引號未關閉');
  if (row.length || started || closed) line();
  return rows;
}
export function csvToModel(text: string): Project {
  const rows = parseCsv(text);
  if (stableJson(rows[0]) !== stableJson(['record', 'x', 'y', 'z', 'json'])) throw new Error('未知的模型 CSV 欄位');
  const metadataRow = rows[1];
  if (!metadataRow || metadataRow.length !== 5 || metadataRow[0] !== 'project' || metadataRow.slice(1, 4).some(Boolean)) throw new Error('缺少或無效的專案中繼資料');
  const metadata = object(JSON.parse(metadataRow[4]!) as unknown, ['schemaVersion', 'minecraftVersion', 'coordinateConvention', 'id', 'title', 'designRevision', 'logicalStructures']);
  const blocks = rows.slice(2).map(row => {
    if (row.length !== 5 || row[0] !== 'block') throw new Error('無效的方塊列');
    const block: unknown = JSON.parse(row[4]!);
    if (!block || typeof block !== 'object' || !('pos' in block) || !block.pos || typeof block.pos !== 'object') throw new Error('缺少方塊座標');
    const pos = block.pos as Record<string, unknown>;
    for (const [index, axis] of ['x', 'y', 'z'].entries()) {
      if (!/^-?(0|[1-9]\d*)$/.test(row[index + 1]!) || typeof pos[axis] !== 'number' || Number(row[index + 1]) !== pos[axis]) throw new Error('CSV 座標與方塊記錄不一致');
    }
    return block;
  });
  return parseProject({ ...metadata, blocks });
}
