// Project-owned hooks; the pinned upstream engine provides original Zelda gameplay.
#include <emscripten.h>
#include <nlohmann/json.hpp>
#include <string>
#include <cstring>
#include "soh/ShipInit.hpp"
#include "soh/SaveManager.h"
#include "soh/Network/Anchor/Anchor.h"
#include "soh/Enhancements/game-interactor/GameInteractor.h"
#include <libultraship/libultraship.h>
extern "C" {
#include "global.h"
#include "file_choose.h"
#include "functions.h"
#include "variables.h"
extern PlayState* gPlayState;
void FileChoose_LoadGame(GameState* state);
void Sram_InitSave(FileChooseContext* state);
}

namespace {
bool started = false, deathPending = false;
int deathSerial = 0, resetEpoch = 0, queuedEntrance = -1, grace = 0;
unsigned ticks = 0;
bool loaded() { return Anchor::Instance && Anchor::Instance->IsSaveLoaded(); }
EM_JS(void, notifyDeath, (int serial, int entrance), {
    if (window.ZeldaNative) window.ZeldaNative.onDeath(serial, entrance);
});
EM_JS(int, debugEnabled, (), { return new URLSearchParams(location.search).has('debug') ? 1 : 0; });
void requestDeath() {
    if (grace > 0) { gSaveContext.health = gSaveContext.healthCapacity; return; }
    if (!deathPending) {
        deathPending = true;
        notifyDeath(++deathSerial, gSaveContext.entranceIndex);
    }
    gSaveContext.health = 1;
}

void registerTogether() {
    CVarSetInteger("gRemote.Anchor.RoomSettings.PvpMode", 0);
    CVarSetInteger("gRemote.Anchor.RoomSettings.SyncItemsAndFlags", 1);
    GameInteractor::Instance->RegisterGameHook<GameInteractor::OnFileChooseMain>([](void* value) {
        if (started) return;
        started = true;
        auto* file = static_cast<FileChooseContext*>(value);
        file->buttonIndex = 0;
        gSaveContext.fileNum = 0;
        if (!SaveManager::Instance->SaveFile_Exist(0)) {
            const uint8_t name[8] = {0xB6, 0xB3, 0xB8, 0xB5, 0xDF, 0xDF, 0xDF, 0xDF};
            std::memcpy(SaveManager::Instance->fileMetaInfo[0].playerName, name, 8);
            file->questType[0] = QUEST_NORMAL;
            file->n64ddFlag = 0;
            Sram_InitSave(file);
        }
        FileChoose_LoadGame(reinterpret_cast<GameState*>(file));
        gSaveContext.cutsceneIndex = 0;
    });
    GameInteractor::Instance->RegisterGameHook<GameInteractor::OnPlayerHealthChange>([](int16_t amount) {
        if (loaded() && gSaveContext.health <= 0) requestDeath();
    });
    GameInteractor::Instance->RegisterGameHook<GameInteractor::OnGameFrameUpdate>([]() {
        ++ticks;
        if (!loaded()) return;
        if (queuedEntrance >= 0 && gPlayState->state.running) {
            // Reinitialize PlayState to clear death, dialogue and pause state,
            // keeping the in-memory inventory and completed quest flags.
            Play_SaveSceneFlags(gPlayState);
            gSaveContext.health = gSaveContext.healthCapacity;
            gSaveContext.healthAccumulator = 0;
            gSaveContext.entranceIndex = queuedEntrance;
            gSaveContext.respawnFlag = 0;
            gSaveContext.cutsceneIndex = 0;
            gSaveContext.nextCutsceneIndex = 0xFFEF;
            gSaveContext.cutsceneTrigger = 0;
            gSaveContext.nextTransitionType = TRANS_TYPE_FADE_BLACK;
            gPlayState->state.running = false;
            SET_NEXT_GAMESTATE(&gPlayState->state, Play_Init, PlayState);
            queuedEntrance = -1;
            deathPending = false;
            grace = 60;
            return;
        }
        if (grace > 0) { --grace; gSaveContext.health = gSaveContext.healthCapacity; return; }
        if (deathPending || gSaveContext.health <= 0) requestDeath();
    });
}
static RegisterShipInitFunc registration(registerTogether);
}

extern "C" {
EMSCRIPTEN_KEEPALIVE const char* together_state() {
    static std::string result;
    nlohmann::json state = {{"loaded", loaded()}, {"epoch", resetEpoch}, {"dead", deathPending}, {"ticks", ticks}};
    if (loaded()) {
        auto* player = GET_PLAYER(gPlayState);
        state["health"] = deathPending ? 0 : gSaveContext.health;
        state["maxHealth"] = gSaveContext.healthCapacity;
        state["scene"] = gPlayState->sceneNum;
        state["entrance"] = gSaveContext.entranceIndex;
        state["age"] = gSaveContext.linkAge;
        state["equipment"] = gSaveContext.inventory.equipment;
        state["questItems"] = gSaveContext.inventory.questItems;
        state["x"] = player->actor.world.pos.x;
        state["y"] = player->actor.world.pos.y;
        state["z"] = player->actor.world.pos.z;
        state["peers"] = nlohmann::json::array();
        for (const auto& [id, client] : Anchor::Instance->clients) {
            if (client.self || !client.online) continue;
            state["peers"].push_back({{"id", id}, {"scene", client.sceneNum}, {"visible", client.player != nullptr && client.isSaveLoaded && client.sceneNum == gPlayState->sceneNum}});
        }
    }
    result = state.dump();
    return result.c_str();
}
EMSCRIPTEN_KEEPALIVE void together_restart(int entrance, int epoch) {
    if (epoch <= resetEpoch || entrance < 0 || entrance > 0x613) return;
    resetEpoch = epoch;
    queuedEntrance = entrance;
}
EMSCRIPTEN_KEEPALIVE int together_meet() {
    if (!loaded()) return 0;
    const auto other = Anchor::Instance->ownClientId == 1 ? 2 : 1;
    if (!Anchor::Instance->CanTeleportTo(other)) return 0;
    Anchor::Instance->SendPacket_RequestTeleport(other);
    return 1;
}
EMSCRIPTEN_KEEPALIVE void together_debug(int command, int value) {
    if (!debugEnabled() || !loaded()) return;
    if (command == 1) { gSaveContext.health = value; grace = 0; }
    if (command == 2) { gSaveContext.health = 0; grace = 0; }
    if (command == 3) { queuedEntrance = value; }
    if (command == 4) { Item_Give(gPlayState, ITEM_SWORD_KOKIRI); }
}
}
