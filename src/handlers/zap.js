import { getOrCreateAccount } from "../handlers/accounts.js";
import { updateUserRank } from "../handlers/donate.js";
import { log } from "../handlers/log.js";
import {
  validateAmountAndBalance,
  validateRelaysStatus,
} from "../utils/helperFunctions.js";

const zap = async (
  sender,
  receiver,
  amount,
  onSuccess,
  onError,
  zapMessage
) => {
  try {
    if (amount <= 0)
      return { success: false, message: "No se permiten saldos negativos" };
    const msatsAmount = amount * 1000;
    await validateRelaysStatus();
    const senderWallet = await getOrCreateAccount(sender.id, sender.username);

    const receiverWallet = await getOrCreateAccount(
      receiver.id,
      receiver.username
    );

    if (!senderWallet || !receiverWallet)
      return {
        success: false,
        message: "Ocurrió un error al obtener la información del usuario",
      };

    if (senderWallet.pubkey === receiverWallet.pubkey)
      return {
        success: false,
        message: "No puedes enviarte sats a vos mismo.",
      };

    const senderBalance = await senderWallet.getBalance("BTC");
    const isValidAmount = validateAmountAndBalance(
      amount,
      senderBalance / 1000
    );

    if (!isValidAmount.status)
      return { success: false, message: isValidAmount.content };

    const invoiceDetails = await receiverWallet.generateInvoice({
      milisatoshis: msatsAmount,
      comment: zapMessage,
    });

    log(
      `@${sender.username} va a pagar la factura ${invoiceDetails.pr}`,
      "info"
    );

    await senderWallet.payInvoice({
      paymentRequest: invoiceDetails.pr,
      onSuccess,
      onError,
    });

    return { success: true, message: "Pago realizado con exito" };
  } catch (err) {
    log(
      `Error al enviar zap de @${sender.username} - Código de error ${err.code} Mensaje: ${err.message}`,
      "err"
    );

    return { success: false, message: "Ocurrió un error al realizar el pago" };
  }
};

export { zap };
