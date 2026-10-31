#include "soh/Network/Anchor/BossAdapters/ActorSyncAdapter.h"
#include "soh/OTRGlobals.h"
extern "C" {
#include "src/overlays/actors/ovl_En_Karebaba/z_en_karebaba.h"
void EnKarebaba_SetupDying(EnKarebaba*);
#define KARE_ACTION(name) void EnKarebaba_##name(EnKarebaba*, PlayState*);
KARE_ACTION(Grow) KARE_ACTION(Idle) KARE_ACTION(Awaken) KARE_ACTION(Upright)
KARE_ACTION(Spin) KARE_ACTION(Dying) KARE_ACTION(DeadItemDrop) KARE_ACTION(Retract)
KARE_ACTION(Dead) KARE_ACTION(Regrow)
#undef KARE_ACTION
}
namespace {
const EnKarebabaActionFunc actions[] = {
    EnKarebaba_Grow, EnKarebaba_Idle, EnKarebaba_Awaken, EnKarebaba_Upright,
    EnKarebaba_Spin, EnKarebaba_Dying, EnKarebaba_DeadItemDrop, EnKarebaba_Retract,
    EnKarebaba_Dead, EnKarebaba_Regrow
};
uint8_t Phase(Actor* actor) {
    auto f = ((EnKarebaba*)actor)->actionFunc;
    return f == EnKarebaba_Dying || f == EnKarebaba_DeadItemDrop || f == EnKarebaba_Dead;
}
void Serialize(Actor* actor, nlohmann::json& x) {
    auto* b = (EnKarebaba*)actor;
    for (int i = 0; i < 10; ++i) if (b->actionFunc == actions[i]) x["action"] = i;
    x["timer"] = actor->params; x["offset"] = actor->shape.yOffset;
    x["shadow"] = actor->shape.shadowScale;
}
void Deserialize(Actor* actor, const nlohmann::json& x) {
    int action = x.value("action", -1);
    if (action >= 0 && action < 10) ((EnKarebaba*)actor)->actionFunc = actions[action];
    actor->params = x.value("timer", actor->params);
    actor->shape.yOffset = x.value("offset", actor->shape.yOffset);
    actor->shape.shadowScale = x.value("shadow", actor->shape.shadowScale);
}
}
void RegisterKarebabaAdapter() {
    ActorSyncAdapter adapter;
    adapter.GetPhase = Phase;
    adapter.SerializeExtras = Serialize;
    adapter.DeserializeExtras = Deserialize;
    // Run the native death and collectible locally. Once the host regrows,
    // resume mirroring under the SAME identity instead of latching death forever.
    adapter.ShouldMirror = [](Actor*, uint8_t phase) { return phase == 0; };
    adapter.OnPhaseChange = [](Actor* actor, uint8_t, uint8_t to) {
        if (to == 1) EnKarebaba_SetupDying((EnKarebaba*)actor);
        return false;
    };
    EnemySync::RegisterAdapter(ACTOR_EN_KAREBABA, adapter);
}
