#include "EnemyPackets.h"
#include "Anchor.h"
namespace TogetherEnemy {
bool HandlePacket(const nlohmann::json& payload) {
    const std::string type = payload.value("type", "");
    if (type.rfind("ENEMY_", 0) != 0) return false;
    const auto sender = payload.value("clientId", UINT32_MAX);
    bool request = type == ENEMY_HIT_REQUEST || (type == ENEMY_ROSTER && payload.value("request", false));
    if (request ? !EnemySync::IsLocalAuthority() : sender != EnemySync::CurrentAuthorityId()) return true;
    if (type == ENEMY_STATE) HandlePacket_EnemyState(payload);
    if (type == ENEMY_HIT) HandlePacket_EnemyHit(payload);
    if (type == ENEMY_HIT_REQUEST) HandlePacket_EnemyHitRequest(payload);
    if (type == ENEMY_DIED) HandlePacket_EnemyDied(payload);
    if (type == ENEMY_SPAWN) HandlePacket_EnemySpawn(payload);
    if (type == ENEMY_DESPAWN) HandlePacket_EnemyDespawn(payload);
    if (type == ENEMY_ROSTER) HandlePacket_EnemyRoster(payload);
    return true;
}
}
