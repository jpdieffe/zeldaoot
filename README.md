# Ocarina of Time Together

Browser co-op for the supplied Ocarina of Time US 1.2 ROM. The project uses Ship of Harkinian's native engine with its Anchor player/progression synchronization, compiled to WebAssembly with project-owned co-op hooks.

Create an adventure and send the invite or four-character code to your friend. Both players have their own Link, camera and health. Items and quest flags are shared. The guest joins the host's location; Meet up lets either player travel to the other where the native location and age rules allow it. When either hero dies, both restart at the failed area's entrance with full health, retaining inventory and progression.

**Shared combat milestone:** the host controls supported enemies when both players are together. Both players can attack the same health pool, and Queen Gohma's defeat gives both players the native heart container, blue warp and room-clear progression. The initial roster covers Deku Babas, Withered Deku Babas, Skulltulas, Skullwalltulas, Deku Scrubs, Gohma larvae, Keese and Queen Gohma. Other enemy types and bosses still run locally; this is not full-game enemy synchronization. Stay together in the same room for shared fights. Water Temple water-level and Forest Temple elevator flags remain local Anchor exceptions. Ordinary nonfatal pit falls retain Zelda's normal damage/respawn behavior.

## Phones and controls

Android/iPhone: use landscape for the largest view. The touch stick moves; A acts/rolls, B attacks, Z targets, R shields, yellow C buttons use equipped items, and Inventory pauses. Enable sound after loading. Expand uses fullscreen where available; on iPhone use landscape or Add to Home Screen. Portrait keeps the game above the controls. Keep both game tabs visible because phones suspend background tabs.

Keyboard: WASD moves, X acts, C attacks, Z targets, Space opens inventory, arrow keys use C items. Escape opens engine settings. The upstream engine also supports gamepads.

The browser needs WebAssembly, WebGL 2 and enough memory for a native 3D game. Device emulation validates layouts and touch events, but does not certify physical Android/iPhone performance.

## Networking and progress

PeerJS provides signaling; WebRTC carries game packets directly between the two browsers. A small Anchor-compatible relay runs in the host tab. No upstream PartyKit room is contacted or advertised. Room codes are invitations, not account authentication. The host controls room membership, save snapshots and reset epochs; friendly damage is disabled.

Strict NAT/carrier/corporate networks may require a TURN relay. Both players can enter their own relay URL and credentials in Connection options. These stay in session storage; no relay account is bundled. Guests can rejoin while the host remains open. There is no host migration.

Save using Zelda's normal inventory/save screen. Native save files persist in IndexedDB, separately for host and guest, and separately from other projects on the same GitHub origin. The host's save establishes the shared adventure. Clearing browser data/private browsing can remove progress. Team resets keep the current in-memory progress; they do not reload an older disk save.

## Development

Node 22+ and Python 3.10+. Run `npm ci`, then `npm start` and open http://localhost:4206/.

- `npm test`: room routing, enemy authority, exact 64-bit identities, shared items, simultaneous deaths and stale combat packets after a team reset.
- `npm run check`: JavaScript syntax, HTML assets, engine and game archive checksums.
- `npm run test:browser`: two installed Chrome instances, native visible players, movement, separate health, shared inventory, team death from either peer, cross-scene resets and guest rejoining. Uses real WebRTC with local signaling by default.
- Set `PUBLIC_SIGNALING=1` for the real PeerJS service; set `TEST_URL` to check a deployed site and `ROOM` for a fresh test code.
- `node tests/mobile.mjs`: Android/iPhone viewport and actual touch-event checks (Chromium emulation).
- `node tests/enemies.mjs`: real guest touch-sword input against a host-controlled Deku Baba, targeting the guest, exact dynamic Gohma-child identities, freezing during a host stall, and joining an active boss fight after guest reload.
- `node tests/combat.mjs`: both players damage Gohma, closed-eye/body contacts are rejected, and both receive defeat rewards. This test skips the intro and injects collider contacts through the native damage/request path; it never sets enemy HP to simulate damage. Test-only healing prevents player deaths from interrupting the boss protocol checks.

`?debug` enables native developer test commands. Normal URLs do not allow them. Screenshots/logs live under ignored `test-results/`.

## Validation

Verified with two Chrome browsers over real WebRTC, both local and public signaling: native player actors, controlled movement from an idle state, independent health, shared sword acquisition, death from either player, cross-scene team restart and guest reload/rejoin. Android and iPhone-sized Chromium tests cover touch-stick movement, reachable controls, sound activation, portrait layout and help. Windows WebKit can initialize the runtime but lacks WebRTC in this test environment; physical iOS Safari and Android hardware are not verified.

The shared-combat build additionally passes real guest touch-sword damage against the host's Deku Baba, guest targeting, exact dynamic child identities, frozen mirrors during delayed snapshots, automatic rejoining of an active Gohma fight, and collision-driven host/guest Gohma damage. Invalid body/closed-eye hits stay rejected; a guest killing blow produces a heart container, blue warp and room clear on both clients. This is targeted milestone coverage, not an exhaustive playthrough of every supported enemy interaction.

## Engine build and assets

Pinned source: [zalo/Shipwright `f81ff64afdd8e0489237bd03c6b026582f6dc70d`](https://github.com/zalo/Shipwright/tree/f81ff64afdd8e0489237bd03c6b026582f6dc70d), including its pinned submodules. `.github/workflows/build-engine.yml` builds it with Emscripten 3.1.64, explicit static dependency settings and preserved pinned compiler-header timestamps and adds `native/together.cpp` via `scripts/patch-engine.py`. Native changes are reviewed and compiled independently from Pages publication.

The native bridge creates a normal empty save, loads it automatically, exposes gameplay telemetry and implements queued team restarts at the end of a frame. Anchor owns native player animation and progression packets; `site/relay.js` routes its protocol over `site/network.js` WebRTC rooms. `native/engine` and the small engine patches add host-authoritative combat, adapted from [bghill95/OOT-True-Co-op at 6cd4c47](https://github.com/bghill95/OOT-True-Co-op/tree/6cd4c47eb4ed9d30cba5b129275d2f91c94a44aa). See `native/COMBAT-NOTICES.txt`.

Enemy identities travel as decimal strings so JavaScript preserves all 64 bits. Hit requests identify the precise collider/element and damage effect; rejected requests never turn into forced HP deductions. Snapshots carry animation, per-collider exposure and geometry. Native enemy logic decides vulnerability and damage. Regrowing enemies regain shared control; established mirrors freeze during a host stall instead of starting a second fight. Combat packets carry the team-reset epoch. The v2 room namespace prevents older independent-combat tabs from joining these rooms silently.

The supplied ROM has SHA-1 `41b3bdc48d98c48529219919015a1af22f5057c2` (33,554,432 bytes). `scripts/import-rom.py` validates it. The upstream native extractor produces `.build/oot.o2r`; `scripts/prepare-game.py` packages that archive without altering its gameplay assets. `tests/extract.mjs` performs extraction by routing the untrimmed engine from `.build/compiled/`, with the temporarily staged ROM under `site/roms/oot.z64`.

Download a successful `zelda-engine` Actions artifact, then run `python scripts/install-engine.py .build/artifact-ID.zip`. It installs the compiled game and strips the 35 MB XML/extraction preload from the runtime package, since extraction has already happened. `python scripts/prepare-shell.py` adapts the pinned upstream shell. `site/engine-manifest.json` records the exact project build commit and packaged hashes; `site/game-manifest.json` records ROM and archive identity.

Original game/assets © Nintendo. See `site/credits.html` and `site/THIRD_PARTY_NOTICES.txt` for upstream credits and library notices.
