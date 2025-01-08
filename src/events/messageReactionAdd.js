import { zap } from "../handlers/zap.js";
import { TimedMessage } from "../utils/helperFunctions.js";
import { updateUserRank } from "../handlers/donate.js";
import { log } from "../handlers/log.js";

const once = false;
const name = "messageReactionAdd";

async function invoke(reaction, user) {
  try {
    if (user.partial) {
      try {
        await user.fetch();
      } catch (err) {
        throw new Error("Fetch partial user error: " + err);
      }
    }

    if (user.bot) return;

    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch (error) {
        throw new Error("Fetch partial message error: " + err);
      }
    }

    let amount = 0;
    switch (reaction.emoji.name) {
      case "⚡":
        log(
          `${user.username} reaccionó con ⚡ al mensaje: "${reaction.message.content}"`,
          "info"
        );
        amount = 21;
        break;
      case "🚀":
        log(
          `${user.username} reaccionó con 🚀 al mensaje: "${reaction.message.content}"`,
          "info"
        );
        amount = 210;
        break;
    }

    if (!amount) return;

    const receiver = reaction.message.author;
    const onSuccess = async () => {
      try {
        await updateUserRank(user.id, "comunidad", amount);

        log(
          `@${user.username} pago la factura del zap hacia @${receiver.username}`,
          "info"
        );

        await reaction.message.channel.send({
          content: `${user.toString()} envió ${amount} satoshis a ${receiver.toString()}`,
        });
      } catch (err) {
        console.log(err);
        TimedMessage("Ocurrió un error", reaction.message.channel, 5000);
      }
    };

    const onError = () => {
      log(
        `@${user.username} tuvo un error al realizar el pago del zap hacia @${receiver.user.username}`,
        "err"
      );

      TimedMessage("Ocurrió un error", reaction.message.channel, 5000);
    };

    const { success, message } = await zap(
      user,
      reaction.message.author,
      amount,
      onSuccess,
      onError,
      `${user.username} reaccionó con ⚡ a un mensaje tuyo`
    );

    if (!success) TimedMessage(message, reaction.message.channel, 5000);
  } catch (err) {
    log(
      `Error al enviar zap por reacción del usuario @${user.username} a @${reaction.message.author.username} - Código de error ${err.code} Mensaje: ${err.message}`,
      "err"
    );
    TimedMessage("Ocurrió un error", reaction.message.channel, 5000);
  }
}

export { once, name, invoke };
