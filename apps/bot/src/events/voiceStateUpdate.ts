import type { VoiceState } from "discord.js";
import { prisma } from "@beacon/db";

/**
 * Fired when a user's voice state changes (joins, leaves, moves channels, mutes, etc.)
 * We only care about JOIN (null -> channel) and LEAVE (channel -> null).
 */
export async function onVoiceStateUpdate(
  oldState: VoiceState,
  newState: VoiceState
): Promise<void> {
  // Ignore bots
  if (newState.member?.user.bot || oldState.member?.user.bot) return;

  const guildId = newState.guild?.id ?? oldState.guild?.id;
  const userId = newState.member?.user.id ?? oldState.member?.user.id;

  if (!guildId || !userId) return;

  const joined = !oldState.channelId && newState.channelId;
  const left = oldState.channelId && !newState.channelId;

  if (!joined && !left) return; // Just muted, deafened, or moved — not a join/leave

  const channelId = joined ? newState.channelId! : oldState.channelId!;
  const type = joined ? "JOIN" : "LEAVE";

  try {
    await prisma.voiceEvent.create({
      data: { guildId, userId, channelId, type },
    });
  } catch (error) {
    console.error(
      `[VoiceStateUpdate] Failed to record voice event (${type}) for user ${userId}:`,
      error
    );
  }
}
