#include "soh/Network/Anchor/BossAdapters/ActorSyncAdapter.h"
#include "soh/OTRGlobals.h"
extern "C" {
#include "src/overlays/actors/ovl_En_St/z_en_st.h"
s32 EnSt_CheckHitLink(EnSt*, PlayState*);
}
extern "C" void TogetherEnemy_SkulltulaContact(Actor* actor, PlayState* play) {
    auto* st = (EnSt*)actor;
    if (st->stunTimer == 0 && st->takeDamageSpinTimer == 0) EnSt_CheckHitLink(st, play);
}
void RegisterSkulltulaAdapter() {
    ActorSyncAdapter adapter;
    adapter.SerializeExtras = [](Actor* actor, nlohmann::json& x) {
        auto* st = (EnSt*)actor;
        x["stun"] = st->stunTimer; x["hurtSpin"] = st->takeDamageSpinTimer;
        x["sway"] = st->swayTimer; x["contactSpin"] = st->gaveDamageSpinTimer;
    };
    adapter.DeserializeExtras = [](Actor* actor, const nlohmann::json& x) {
        auto* st = (EnSt*)actor;
        st->stunTimer = x.value("stun", 0); st->takeDamageSpinTimer = x.value("hurtSpin", 0);
        st->swayTimer = x.value("sway", 0); st->gaveDamageSpinTimer = x.value("contactSpin", 0);
    };
    EnemySync::RegisterAdapter(ACTOR_EN_ST, adapter);
}
