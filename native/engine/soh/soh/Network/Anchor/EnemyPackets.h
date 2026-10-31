#pragma once
#include "EnemySync.h"
#include <string>
namespace TogetherEnemy {
inline uint64_t ReadKey(const nlohmann::json& value) { return std::stoull(value.get<std::string>()); }
bool HandlePacket(const nlohmann::json& payload);
inline const std::string ENEMY_STATE = "ENEMY_STATE";
inline const std::string ENEMY_HIT = "ENEMY_HIT";
inline const std::string ENEMY_HIT_REQUEST = "ENEMY_HIT_REQUEST";
inline const std::string ENEMY_DIED = "ENEMY_DIED";
inline const std::string ENEMY_SPAWN = "ENEMY_SPAWN";
inline const std::string ENEMY_DESPAWN = "ENEMY_DESPAWN";
inline const std::string ENEMY_ROSTER = "ENEMY_ROSTER";
void SendPacket_EnemyState(nlohmann::json& enemies);
void HandlePacket_EnemyState(nlohmann::json payload);
void SendPacket_EnemyHit(Actor* actor, uint64_t enemyKey, uint8_t damage, uint32_t dmgFlags, Vec3s hitPos,
                                 uint8_t health);
void HandlePacket_EnemyHit(nlohmann::json payload);
void SendPacket_EnemyHitRequest(Actor* actor, uint64_t enemyKey, uint8_t damage, uint32_t dmgFlags,
                                        Vec3s hitPos, int colliderIndex, int elementIndex, uint8_t effect);
void HandlePacket_EnemyHitRequest(nlohmann::json payload);
void SendPacket_EnemyDied(Actor* actor, uint64_t enemyKey, bool permanent);
void HandlePacket_EnemyDied(nlohmann::json payload);
void SendPacket_EnemySpawn(uint64_t enemyKey, int16_t actorId, uint16_t params, Vec3f pos, Vec3s rot,
                                   int16_t roomNum, uint64_t parentKey);
void HandlePacket_EnemySpawn(nlohmann::json payload);
void SendPacket_EnemyDespawn(uint64_t enemyKey);
void HandlePacket_EnemyDespawn(nlohmann::json payload);
void SendPacket_EnemyRosterRequest(int16_t roomNum);
void HandlePacket_EnemyRoster(nlohmann::json payload);
}
