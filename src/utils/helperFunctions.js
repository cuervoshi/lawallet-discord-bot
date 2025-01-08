import NDK, { NDKEvent, NDKRelaySet } from "@nostr-dev-kit/ndk";
import { connectedNdk, knownRelays } from "../../Bot.js";
import { log } from "../handlers/log.js";
import SimpleCache from "../handlers/SimpleCache.js";

export const signupCache = new SimpleCache();

export const requiredEnvVar = (key) => {
  const envVar = process.env[key];
  if (undefined === envVar) {
    throw new Error(`Environment process ${key} must be defined`);
  }
  return envVar;
};

const validateAmountAndBalance = (amount, balance) => {
  if (amount <= 0)
    return {
      status: false,
      content: "No puedes usar números negativos o flotantes",
    };

  if (amount > balance)
    return {
      status: false,
      content: `No tienes saldo suficiente para realizar esta acción. \nRequerido: ${amount} - balance en tu billetera: ${balance}`,
    };

  return {
    status: true,
    content: "",
  };
};

export const normalizeLNDomain = (domain) => {
  try {
    const iURL = new URL(domain);
    return iURL.hostname;
  } catch {
    return "";
  }
};

const handleBotResponse = async (Interaction, objConfig) => {
  Interaction.deferred
    ? await Interaction.editReply(objConfig)
    : await Interaction.reply(objConfig);
};

const EphemeralMessageResponse = async (Interaction, content) => {
  const objectResponse = {
    content,
    ephemeral: true,
  };

  await handleBotResponse(Interaction, objectResponse);
};
const TimedMessage = (message, channel, duration) => {
  channel
    .send(message)
    .then((m) =>
      setTimeout(
        async () => (await channel.messages.fetch(m)).delete(),
        duration
      )
    );
  return;
};
const FollowUpEphemeralResponse = async (Interaction, content) => {
  await Interaction.deleteReply();

  return Interaction.followUp({
    content: content,
    ephemeral: true,
  });
};

const relaysProfileList = [
  "wss://relay.damus.io",
  "wss://relay.hodl.ar",
  "wss://nostr-pub.wellorder.net",
  "wss://nos.lol",
  "wss://relay.primal.net",
  "wss://nostr.wine",
];

const publishProfile = async (wallet, user) => {
  if (!wallet || !user) throw new Error("Wallet or Discord User not found");

  try {
    const tmpNdk = new NDK({
      explicitRelayUrls: relaysProfileList,
      autoConnectUserRelays: false,
      signer: wallet.signer,
    });

    // await tmpNdk.connect();

    let profileContent = {
      pubkey: wallet.pubkey,
      name: user.globalName,
      about: `This nostr account was created by LNBot for the discord user @${user.username}`,
      picture: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}`,
      banner: "https://m.primal.net/HIPQ.gif",
      website: "lnbot.io",
    };

    if (wallet.walias) {
      profileContent.nip05 = wallet.walias;
      profileContent.lud16 = wallet.walias;
    }

    let eventProfile = {
      kind: 0,
      created_at: Math.floor(Date.now() / 1000),
      content: JSON.stringify(profileContent),
    };

    const ndkEvent = new NDKEvent(tmpNdk, eventProfile);
    await ndkEvent.sign();

    let relaySet = NDKRelaySet.fromRelayUrls(relaysProfileList, tmpNdk, true);
    await ndkEvent.publish(relaySet);

    return;
  } catch (err) {
    console.log(err);
    return;
  }
};

async function validateRelaysStatus() {
  let connectedRelays = connectedNdk.pool.connectedRelays();

  await Promise.all(
    knownRelays.map(async (relayUrl) => {
      let isRelayConnected = connectedRelays.find(
        (relay) => relay.url === relayUrl
      );

      if (!isRelayConnected) {
        let disconnectedRelay = connectedNdk.pool.relays.get(relayUrl);

        if (disconnectedRelay) {
          log(`reconectando relay: ${disconnectedRelay.url}`, "done");
          await disconnectedRelay.connect();
        }
      }
    })
  );

  return;
}

async function getSignupInfo(federation) {
  const infoFromCache = signupCache.get(`signup:${federation.id}`);
  if (infoFromCache) return infoFromCache;

  const signupInfo = await federation.signUpInfo();

  let ttl = 86400 * 1000; // 24 hours
  signupCache.set(`signup:${federation.id}`, signupInfo, ttl);

  return signupInfo;
}

async function existIdentity(federation, username) {
  const infoFromCache = signupCache.get(`signup:${federation.id}:${username}`);

  if (infoFromCache) {
    return infoFromCache;
  } else {
    const existIdentity = await federation.existIdentity(username);

    if (existIdentity) {
      let ttl = 86400 * 1000; // 24 hours
      signupCache.set(`signup:${federation.id}:${username}`, true, ttl);
      return true;
    }

    return false;
  }
}

export {
  EphemeralMessageResponse,
  TimedMessage,
  FollowUpEphemeralResponse,
  handleBotResponse,
  publishProfile,
  validateAmountAndBalance,
  validateRelaysStatus,
  getSignupInfo,
  existIdentity,
};
