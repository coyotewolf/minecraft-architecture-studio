# Pinned Java 1.20.1 registry

## Source and attribution

The committed projection `src/data/java-1.20.1.json` is derived from [PrismarineJS/minecraft-data](https://github.com/PrismarineJS/minecraft-data/tree/15411f050f040e4c5df09352a75a9912ad8c3eeb), data commit `15411f050f040e4c5df09352a75a9912ad8c3eeb`. The `minecraft-data@3.117.0` wrapper points to this data submodule; the app does not install that wrapper.

| Source path | Pinned Git blob SHA |
| --- | --- |
| data/pc/1.20/blocks.json | f265dc1be54a0b7d6ee60a541c5c5df2c075a51d |
| data/pc/1.20/items.json | d00049aa169472e75bc3a953ba5e960995f397d1 |
| data/dataPaths.json | b6c1eb84c9f291e81599f0ed40d774569a05059b |
| data/pc/1.20.1/version.json | bab0091809bfd4a4d2c2899d72afe94b14f735ff |

The source mapping explicitly maps 1.20.1 blocks/items to pc/1.20; version metadata identifies 1.20.1, protocol 763. The projection contains 1,003 source block IDs and 1,255 item stack maxima. Runtime registry lookup excludes air/cave_air/void_air (1,000 entries). Canonical model ingress additionally rejects pitcher_crop pending its conditional multi-cell growth rule (999 IDs potentially admitted, subject to logical pairing).

Upstream [README license section](https://github.com/PrismarineJS/minecraft-data/blob/15411f050f040e4c5df09352a75a9912ad8c3eeb/README.md#license) declares MIT and states:

> Some of the data was extracted manually or automatically from wiki.vg and minecraft.gamepedia.com.

Upstream additionally cautions that the license may need to change if a source requires it. This attribution preserves that caveat; it is not independent legal clearance or permission to redistribute Minecraft textures. No texture, game jar, mesh or other game asset is included.

## Reproduction

Node >=22.12; no extra package dependency:

```sh
node scripts/generate-registry.mjs
```

This fetches only four pinned raw GitHub files, verifies Git blob hashes before parsing, checks version/source mappings/counts/state spans and writes the deterministic projection. Network access is needed only for regeneration, not runtime or tests.

For an offline source directory containing exact UTF-8 bytes named blocks.json, items.json, dataPaths.json and version.json:

```sh
node scripts/generate-registry.mjs /path/to/source-directory
```

In the audited Windows session the GitHub connector retrieved the bytes; the executed command was `node scripts/generate-registry.mjs ../work/registry-source`. These source-cache files are not committed or required for normal application installation.

Expected output: 1,003 blocks, 1,255 items, 183,226 bytes; SHA-256 `01c9906b95f817f05b1bf3246eb8368bac058f259841122ff310452a4fe92099`. The projection also records each input's SHA-256 and Git blob hash. No timestamp is embedded, so identical inputs produce identical bytes.

Property domains preserve upstream order. Boolean domains are true,false. Default decoding uses defaultState minus minStateId with the last property changing fastest; every state span must equal the product of domain lengths. Tests assert actual stone/stair/door/bed/slab/snow defaults and validate all admitted registry defaults.

## Scope of the runtime API

- `getRegistryEntry(id)`: immutable property domains/defaults and a conservative placement-item rule; unknown IDs and all air variants throw.
- `normalizeBlockState(id,state)`: rejects unknown property names/values and fills every omitted property from the pinned default.
- `itemStackSize(id)`: the item's actual stack maximum, or an error for an unknown item.
- `BLOCK_IDS`: frozen list for registry consumers; state-domain membership does not override model-level pair validation.

Item mappings use same-ID placement items only. Mining drops are deliberately excluded: stone must map to stone even though its drops list contains cobblestone, and a bed's empty drops list does not mean zero inventory. Slabs have a dedicated rule; doors, beds and supported tall plants have a logical-structure rule. M6 must count only valid pairs once and double slabs twice.

Blocks with no same-ID item, or state-dependent quantities (candles, pickles, layers, eggs, flower_amount), remain explicitly unresolved. Same-ID rules identify base placement items; waterlogging, charged contents, growth, survival obtainability, supporting blocks and other construction operations are not a promise of complete build materials. M6 must resolve these semantics before advertising accurate total requirements. No inventory aggregation is implemented in M1.

The registry validates IDs and property domains. It does not simulate world physics, neighbor connections, redstone or legal placement survival. Full game compatibility and in-game exporter verification remain later gates.
