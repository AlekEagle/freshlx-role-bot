import { config } from 'dotenv';
import { Client, Constants, Member } from 'oceanic.js';

import {
  startCacheRefresh,
  getSupporterByDiscordID,
  emitter as PatreonEmitter,
  cached as CachedPatreonMembers,
} from './utils/Patreon.ts';

config();

// The server to manage roles for.
const SERVER_ID = '785688843982471209',
  // The role to assign to supporters.
  ROLE_ID = '855933610778296330';

const client = new Client({
  auth: `Bot ${process.env.TOKEN}`,
  gateway: {
    intents: [Constants.Intents.GUILD_MEMBERS],
    presence: {
      status: 'online',
      activities: [
        {
          name: 'Assigning Your Roles',
          type: Constants.ActivityTypes.GAME,
        },
      ],
    },
    connectionProperties: {
      browser: 'Discord Android',
      device: 'Samsung Galaxy Z Flip5',
      os: 'Android',
    },
  },
});

// Leave a server if it is not the target server.
client.on('guildCreate', async (guild) => {
  if (guild.id !== SERVER_ID) {
    console.log(`Leaving guild: ${guild.name} (${guild.id})`);
    await guild.leave();
  }
});

client.on('ready', () => {
  console.log(`Logged in as ${client.user.username}`);
  // Start the Patreon cache refresh process.
  startCacheRefresh();
});

client.on('guildMemberAdd', async (member) => {
  if (member.guildID !== SERVER_ID) {
    return;
  }
  console.log(`Member joined: ${member.user.username} (${member.id})`);
  await checkAndAssignRoles(member);
});

PatreonEmitter.on('refreshed', async () => {
  console.log('Patreon cache refreshed event received.');
  // Iterate through all supporters and check if they are in the server.
  for (const member of CachedPatreonMembers) {
    if (!member.discord_id) {
      console.log(`Supporter ${member.full_name} has no linked Discord ID.`);
      continue;
    }
    const guildMember = await client.rest.guilds.getMember(
      SERVER_ID,
      member.discord_id,
    );
    if (guildMember) {
      console.log(
        `Checking roles for supporter ${guildMember.user.username} (${guildMember.id})`,
      );
      await checkAndAssignRoles(guildMember);
    } else {
      console.log(
        `Supporter with Discord ID ${member.discord_id} is not in the server.`,
      );
    }
  }
});

async function checkAndAssignRoles(member: Member): Promise<void> {
  if (member.guildID !== SERVER_ID) {
    console.log(`Member ${member.user.username} is not in the target server.`);
    return;
  }
  const supporter = getSupporterByDiscordID(member.id);
  if (supporter && supporter.lifetime_amount > 0) {
    console.log(
      `${member.user.username} has supported and will receive the role.`,
    );
    // Do they already have the role?
    if (member.roles.includes(ROLE_ID)) {
      console.log(`Role already assigned to ${member.user.username}`);
      return;
    }
    await member.addRole(ROLE_ID, 'Patreon supporter joined the server');
    console.log(`Assigned role to ${member.user.username}`);
  } else {
    console.log(
      `${member.user.username} is not a supporter or has no lifetime support.`,
    );
  }
}

client.on('error', (error) => {
  console.error('An error occurred:', error);
});

client.connect();
